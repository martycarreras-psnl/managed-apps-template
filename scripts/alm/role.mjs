/**
 * npm run alm:role -- create
 * npm run alm:role -- show [env]
 *
 * Creates the "Managed App Inventory Manager" security role in dev and adds it
 * to the solution so it promotes to test and prod as a managed component.
 *
 * Dataverse roles do not inherit privileges from one another — "inherits from
 * Basic User" means the Basic User privilege set is copied as the baseline,
 * which is what the Copy Role action does in the UI. On top of that baseline we
 * grant full CRUD on the inventory table.
 *
 * Idempotent: re-running updates privileges on the existing role.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  almConfig,
  fail,
  ok,
  step,
  resolveEnv,
  ROOT,
  BOLD,
  DIM,
  OFF,
  YELLOW,
} from './lib.mjs'

/**
 * Role shape comes from alm.config.json -> app.securityRole so this script is
 * project-agnostic and can ship in the shared scaffolding.
 *
 * Depth defaults to Global: a shared organisational table where every holder
 * sees and maintains every record. Assign/Share are excluded by default —
 * record ownership is not part of the reference app's model.
 */
function roleSpec() {
  const cfg = almConfig()
  const app = cfg.app
  if (!app?.table || !app?.securityRole?.name) {
    fail(
      'alm.config.json is missing app.table or app.securityRole.name.',
      'Add an "app" section describing the table and role.'
    )
  }
  return {
    cfg,
    roleName: app.securityRole.name,
    baselineRole: app.securityRole.baselineRole ?? 'Basic User',
    table: app.table,
    privileges: (app.securityRole.privileges ?? [
      'prvCreate', 'prvRead', 'prvWrite', 'prvDelete', 'prvAppend', 'prvAppendTo',
    ]).map((prefix) => ({ prefix, depth: app.securityRole.depth ?? 'Global' })),
  }
}

function dv(args, envUrl) {
  try {
    return execFileSync(
      'dataverse',
      ['api', 'request', '--target', 'dataverse', '--environment', envUrl, ...args],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
    )
  } catch (error) {
    fail(
      'Dataverse request failed',
      (error.stderr?.toString().trim() || error.message).slice(0, 600)
    )
  }
}

function get(path, envUrl) {
  const raw = dv(['--path', path], envUrl)
  try {
    return JSON.parse(raw)
  } catch {
    fail('Unexpected Dataverse response', raw.slice(0, 400))
  }
}

function send(method, path, body, envUrl, headers = []) {
  const tmp = resolve(tmpdir(), `role-${Date.now()}.json`)
  writeFileSync(tmp, JSON.stringify(body))
  const headerArgs = headers.flatMap((h) => ['-H', h])
  try {
    return dv(['--method', method, '--path', path, '--body-file', tmp, ...headerArgs], envUrl)
  } finally {
    rmSync(tmp, { force: true })
  }
}

function findRole(name, envUrl) {
  const data = get(
    `api/data/v9.2/roles?$select=roleid,name,ismanaged&$filter=name eq '${name.replace(/'/g, "''")}'`,
    envUrl
  )
  return data.value?.[0] ?? null
}

function rootBusinessUnit(envUrl) {
  const data = get(
    'api/data/v9.2/businessunits?$select=businessunitid&$filter=_parentbusinessunitid_value eq null',
    envUrl
  )
  const bu = data.value?.[0]
  if (!bu) fail('Could not find the root business unit.')
  return bu.businessunitid
}

// ---------------------------------------------------------------- create ----

function doCreate() {
  const { cfg, roleName: ROLE_NAME, baselineRole: BASELINE_ROLE, table: TABLE, privileges: TABLE_PRIVILEGES } = roleSpec()
  const dev = resolveEnv(cfg.promotionOrder[0])
  const url = dev.dataverseUrl
  const solution = cfg.solution.uniqueName

  step(`Creating ${BOLD}${ROLE_NAME}${OFF} in ${dev.name}`)

  // 1. Baseline privileges from Basic User.
  const baseline = findRole(BASELINE_ROLE, url)
  if (!baseline) fail(`Baseline role "${BASELINE_ROLE}" not found.`)
  const baselinePrivs =
    get(`api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=${baseline.roleid})`, url)
      .RolePrivileges ?? []
  ok(`${BASELINE_ROLE} baseline: ${baselinePrivs.length} privileges`)

  // 2. Table privileges.
  const tablePrivs = get(
    `api/data/v9.2/privileges?$select=privilegeid,name&$filter=endswith(name,'${TABLE}')`,
    url
  ).value ?? []
  const byName = new Map(tablePrivs.map((p) => [p.name.toLowerCase(), p.privilegeid]))

  const granted = []
  for (const { prefix, depth } of TABLE_PRIVILEGES) {
    const id = byName.get(`${prefix}${TABLE}`.toLowerCase())
    if (!id) fail(`Privilege ${prefix}${TABLE} not found.`, 'Is the table published?')
    granted.push({ PrivilegeId: id, Depth: depth })
  }
  ok(`${TABLE}: ${granted.map((_, i) => TABLE_PRIVILEGES[i].prefix.replace('prv', '')).join(', ')} @ Global`)

  // 3. Create the role inside the solution, or reuse it.
  let role = findRole(ROLE_NAME, url)
  if (role) {
    console.log(`${DIM}  role already exists (${role.roleid}) — updating privileges${OFF}`)
  } else {
    const bu = rootBusinessUnit(url)
    send(
      'POST',
      'api/data/v9.2/roles',
      {
        name: ROLE_NAME,
        description: `Full access to the Managed Apps Inventory. Baseline copied from ${BASELINE_ROLE}.`,
        'businessunitid@odata.bind': `/businessunits(${bu})`,
      },
      url,
      [`MSCRM.SolutionUniqueName: ${solution}`]
    )
    role = findRole(ROLE_NAME, url)
    if (!role) fail('Role creation reported success but the role is not present.')
    ok(`created role ${role.roleid}`)
  }

  // 4. Apply privileges. Baseline first, then table grants override any overlap.
  const merged = new Map()
  for (const p of baselinePrivs) {
    merged.set(p.PrivilegeId, { PrivilegeId: p.PrivilegeId, Depth: p.Depth })
  }
  for (const p of granted) merged.set(p.PrivilegeId, p)

  send(
    'POST',
    `api/data/v9.2/roles(${role.roleid})/Microsoft.Dynamics.CRM.ReplacePrivilegesRole`,
    { Privileges: [...merged.values()] },
    url
  )
  ok(`applied ${merged.size} privileges`)

  // 5. Ensure the role is a solution component (type 20 = Role).
  send(
    'POST',
    'api/data/v9.2/AddSolutionComponent',
    {
      ComponentId: role.roleid,
      ComponentType: 20,
      SolutionUniqueName: solution,
      AddRequiredComponents: false,
    },
    url
  )
  ok(`added to solution ${solution}`)

  console.log(
    `\n${DIM}Next: npm run alm:solution -- export --bump build${OFF}\n`
  )
}

// ------------------------------------------------------------------ show ----

function doShow(target) {
  const { cfg, roleName: ROLE_NAME, table: TABLE } = roleSpec()
  const names = target ? [target] : cfg.promotionOrder

  step(`Role: ${ROLE_NAME}`)
  for (const name of names) {
    const env = cfg.environments[name]
    if (!env?.dataverseUrl) {
      console.log(`${name.padEnd(6)} ${DIM}not provisioned${OFF}`)
      continue
    }
    const role = findRole(ROLE_NAME, env.dataverseUrl)
    if (!role) {
      console.log(`${name.padEnd(6)} ${YELLOW}not present${OFF}`)
      continue
    }
    const privs =
      get(`api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=${role.roleid})`, env.dataverseUrl)
        .RolePrivileges ?? []
    const tableGrants = privs
      .filter((p) => (p.PrivilegeName ?? '').toLowerCase().endsWith(TABLE.toLowerCase()))
      .map((p) => `${p.PrivilegeName.replace('prv', '').replace(TABLE, '')}:${p.Depth}`)
    console.log(
      `${name.padEnd(6)} ${privs.length} privileges, managed=${role.ismanaged}\n` +
        `       ${DIM}${tableGrants.join(' ') || 'no table privileges'}${OFF}`
    )
  }
  console.log('')
}

const [action, arg] = process.argv.slice(2)
if (action === 'create') doCreate()
else if (action === 'show') doShow(arg)
else fail('Usage: npm run alm:role -- <create|show> [env]')
