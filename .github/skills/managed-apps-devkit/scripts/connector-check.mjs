#!/usr/bin/env node
/**
 * node .github/skills/managed-apps-devkit/scripts/connector-check.mjs <search> [<search>…] [--json]
 *
 * Is a connector (or MCP server) allowed in every environment this project
 * ships to? Read-only. Also reports the environment the current branch's app
 * is pinned to.
 *
 * Stages come from ./alm.config.json: `promotionOrder` first, then any other
 * key in `environments`. A stage added later (QA, UAT, a second prod…) is
 * picked up automatically. Without alm.config.json (standalone app) only the
 * environment in ./ms.config.json is checked.
 *
 *   ms connector list -e <environmentId> --search <text> --json   per environment
 *   pac admin list --json                                        environment names (optional)
 */
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const args = process.argv.slice(2)
const asJson = args.includes('--json')
const terms = args.filter((a) => !a.startsWith('--'))
const shell = process.platform === 'win32'

if (terms.length === 0) {
  console.error('Usage: connector-check.mjs <search> [<search>…] [--json]   e.g. "work iq" outlook')
  process.exit(2)
}

function readJson(file) {
  const path = resolve(process.cwd(), file)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

async function runJson(cmd, cmdArgs) {
  try {
    const { stdout } = await exec(cmd, cmdArgs, {
      cwd: tmpdir(),
      shell,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    })
    const start = stdout.search(/[[{]/)
    return start === -1 ? null : JSON.parse(stdout.slice(start))
  } catch {
    return null
  }
}

const alm = readJson('alm.config.json')
const ms = readJson('ms.config.json')
const pinnedId = ms?.environmentId ?? null

// Every stage, in promotion order, then anything not in the order.
const stages = []
if (alm?.environments) {
  const keys = [
    ...(alm.promotionOrder ?? []).filter((k) => alm.environments[k]),
    ...Object.keys(alm.environments).filter((k) => !(alm.promotionOrder ?? []).includes(k)),
  ]
  for (const key of keys) {
    const env = alm.environments[key]
    stages.push({
      stage: key,
      branch: env.branch ?? key,
      environmentId: env.environmentId ?? null,
      provisioned: Boolean(env.provisioned && env.environmentId),
    })
  }
}
if (pinnedId && !stages.some((s) => s.environmentId === pinnedId)) {
  stages.unshift({ stage: 'this app', branch: null, environmentId: pinnedId, provisioned: true })
}
if (stages.length === 0) {
  console.error('No environments found: alm.config.json has none and ./ms.config.json has no environmentId.')
  process.exit(1)
}

const envIds = [...new Set(stages.filter((s) => s.provisioned).map((s) => s.environmentId))]
const [pac, ...lists] = await Promise.all([
  runJson('pac', ['admin', 'list', '--json']),
  ...envIds.flatMap((id) =>
    terms.map((t) =>
      runJson('ms', ['connector', 'list', '-e', id, '--search', t, '--json', '--non-interactive'])
    )
  ),
])

const envInfo = new Map()
for (const e of Array.isArray(pac) ? pac : []) {
  const id = e.EnvironmentId ?? e.environmentId
  if (id) envInfo.set(id, { name: e.DisplayName ?? e.displayName, type: e.Type ?? e.type })
}

// connectorName -> { displayName, byEnv: Map(envId -> 'Allowed'|'Blocked') }
const connectors = new Map()
const failed = new Set()
envIds.forEach((id, i) => {
  terms.forEach((_, j) => {
    const res = lists[i * terms.length + j]
    if (!res?.items) return failed.add(id)
    for (const c of res.items) {
      const row = connectors.get(c.name) ?? { displayName: c.displayName, byEnv: new Map() }
      row.byEnv.set(id, c.isBlocked ? 'Blocked' : 'Allowed')
      connectors.set(c.name, row)
    }
  })
})

function status(stage, row) {
  if (!stage.provisioned) return 'not provisioned'
  if (failed.has(stage.environmentId)) return 'check failed'
  return row.byEnv.get(stage.environmentId) ?? 'not found'
}

// Several stages can share one environment; prefer the one for this git branch.
let branch = null
try {
  branch = (await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { shell })).stdout.trim()
} catch {}
const matches = stages.filter((s) => s.environmentId && s.environmentId === pinnedId)
const pinned = matches.find((s) => s.branch === branch) ?? matches[0] ?? null
const result = {
  search: terms,
  pinned: pinned && {
    stage: pinned.stage,
    environmentId: pinned.environmentId,
    ...envInfo.get(pinned.environmentId),
  },
  stages: stages.map((s) => ({ ...s, ...envInfo.get(s.environmentId) })),
  connectors: [...connectors].map(([name, row]) => ({
    name,
    displayName: row.displayName,
    status: Object.fromEntries(stages.map((s) => [s.stage, status(s, row)])),
  })),
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

const icon = { Allowed: '✅ Allowed', Blocked: '⛔ Blocked' }
if (result.pinned) {
  const p = result.pinned
  const extra = [p.stage, p.type].filter(Boolean).join(', ')
  console.log(`Pinned environment: ${p.name ?? p.environmentId} (${extra}, ${p.environmentId})\n`)
} else {
  console.log('Pinned environment: unknown (no environmentId in ./ms.config.json on this branch)\n')
}
if (result.connectors.length === 0) {
  console.log(`No connectors match: ${terms.join(', ')}`)
} else {
  console.log(`| Connector | ${stages.map((s) => s.stage).join(' | ')} |`)
  console.log(`| --- |${stages.map(() => ' --- |').join('')}`)
  for (const c of result.connectors) {
    const cells = stages.map((s) => icon[c.status[s.stage]] ?? c.status[s.stage])
    console.log(`| ${c.displayName} (\`${c.name}\`) | ${cells.join(' | ')} |`)
  }
}
if (failed.size) console.log('\n"check failed": run `ms auth status`, then retry.')
