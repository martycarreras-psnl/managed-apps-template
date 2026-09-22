/**
 * npm run alm:solution -- export [--bump build|patch|minor|major]
 * npm run alm:solution -- import <test|prod>
 * npm run alm:solution -- status
 *
 * Rule: schema is always exported as MANAGED from dev, committed to the repo,
 * and promoted alongside the app code so the two stay in lockstep.
 *
 * All Dataverse calls go through the `dataverse` CLI with --environment, which
 * works across every org in the tenant on one sign-in.
 */
import { execFileSync } from 'node:child_process'
import {
  createHash,
} from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
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

const SOLUTIONS_DIR = resolve(ROOT, 'solutions')
const MANIFEST = resolve(SOLUTIONS_DIR, 'manifest.json')

function dv(args, envUrl) {
  try {
    return execFileSync(
      'dataverse',
      ['api', 'request', '--target', 'dataverse', '--environment', envUrl, ...args],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
    )
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message
    fail('Dataverse request failed', detail.slice(0, 600))
  }
}

function getJson(path, envUrl) {
  const raw = dv(['--path', path], envUrl)
  try {
    return JSON.parse(raw)
  } catch {
    fail('Unexpected response from Dataverse', raw.slice(0, 400))
  }
}

function postJson(path, body, envUrl) {
  return sendJson('POST', path, body, envUrl)
}

function patchJson(path, body, envUrl) {
  return sendJson('PATCH', path, body, envUrl)
}

function sendJson(method, path, body, envUrl) {
  const tmp = resolve(tmpdir(), `alm-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(tmp, JSON.stringify(body))
  try {
    return dv(['--method', method, '--path', path, '--body-file', tmp], envUrl)
  } finally {
    rmSync(tmp, { force: true })
  }
}

function solutionRecord(uniqueName, envUrl) {
  const data = getJson(
    `api/data/v9.2/solutions?$select=solutionid,uniquename,version,ismanaged&$filter=uniquename eq '${uniqueName}'`,
    envUrl
  )
  return data.value?.[0] ?? null
}

function bumpVersion(version, part) {
  const seg = version.split('.').map((n) => parseInt(n, 10) || 0)
  while (seg.length < 4) seg.push(0)
  const index = { major: 0, minor: 1, build: 2, patch: 3 }[part]
  if (index === undefined) fail(`Unknown bump part "${part}".`, 'Use major, minor, build, or patch.')
  seg[index] += 1
  for (let i = index + 1; i < seg.length; i++) seg[i] = 0
  return seg.join('.')
}

function readManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null
}

// ---------------------------------------------------------------- export ----

function doExport(args) {
  const cfg = almConfig()
  const dev = resolveEnv(cfg.promotionOrder[0])
  const uniqueName = cfg.solution.uniqueName

  step(`Exporting ${BOLD}${uniqueName}${OFF} from ${dev.name} (${dev.displayName})`)

  let record = solutionRecord(uniqueName, dev.dataverseUrl)
  if (!record) fail(`Solution "${uniqueName}" not found in ${dev.name}.`)

  const bumpIndex = args.indexOf('--bump')
  if (bumpIndex !== -1) {
    const part = args[bumpIndex + 1] ?? 'build'
    const next = bumpVersion(record.version, part)
    patchJson(
      `api/data/v9.2/solutions(${record.solutionid})`,
      { version: next },
      dev.dataverseUrl
    )
    ok(`version ${record.version} -> ${next}`)
    record = solutionRecord(uniqueName, dev.dataverseUrl)
  }

  // Publish first so the export captures the latest customizations.
  postJson('api/data/v9.2/PublishAllXml', {}, dev.dataverseUrl)
  ok('customizations published')

  mkdirSync(SOLUTIONS_DIR, { recursive: true })

  const written = {}
  for (const managed of [true, false]) {
    const raw = postJson(
      'api/data/v9.2/ExportSolution',
      { SolutionName: uniqueName, Managed: managed },
      dev.dataverseUrl
    )
    const file = JSON.parse(raw).ExportSolutionFile
    if (!file) fail('Export returned no file.')
    const bytes = Buffer.from(file, 'base64')
    const suffix = managed ? 'managed' : 'unmanaged'
    const name = `${uniqueName}_${suffix}.zip`
    writeFileSync(resolve(SOLUTIONS_DIR, name), bytes)
    written[suffix] = {
      file: `solutions/${name}`,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
    ok(`${name} (${bytes.length} bytes)`)
  }

  const manifest = {
    $comment:
      'Written by scripts/alm/solution.mjs. The managed zip is the artifact promoted to test and prod.',
    uniqueName,
    version: record.version,
    exportedAt: new Date().toISOString(),
    exportedFrom: { environment: dev.name, environmentId: dev.environmentId },
    artifacts: written,
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  ok(`manifest v${record.version}`)

  console.log(
    `\n${DIM}Commit solutions/ with your code so schema and app promote together.${OFF}\n`
  )
}

// ---------------------------------------------------------------- import ----

function doImport(target) {
  if (!target) fail('Usage: npm run alm:solution -- import <test|prod>')

  const cfg = almConfig()
  const env = resolveEnv(target)
  if (!env.dataverseUrl) {
    fail(`No dataverseUrl configured for "${target}" in alm.config.json.`)
  }
  if (target === cfg.promotionOrder[0]) {
    fail(
      'Refusing to import into dev.',
      'Dev is where schema is authored; importing a managed copy there would lock it.'
    )
  }

  const manifest = readManifest()
  if (!manifest) {
    fail(
      'No solutions/manifest.json found.',
      'Run: npm run alm:solution -- export'
    )
  }

  const zipPath = resolve(ROOT, manifest.artifacts.managed.file)
  if (!existsSync(zipPath)) fail(`Missing artifact ${manifest.artifacts.managed.file}`)

  const bytes = readFileSync(zipPath)
  const sha = createHash('sha256').update(bytes).digest('hex')
  if (sha !== manifest.artifacts.managed.sha256) {
    fail(
      'The managed solution zip does not match the manifest checksum.',
      'Re-run: npm run alm:solution -- export'
    )
  }
  ok(`artifact verified (sha256 ${sha.slice(0, 12)}…)`)

  step(
    `Importing ${BOLD}${manifest.uniqueName} v${manifest.version}${OFF} into ${env.name} (${env.displayName})`
  )

  const before = solutionRecord(manifest.uniqueName, env.dataverseUrl)
  if (before) {
    console.log(`${DIM}  currently installed: v${before.version}${OFF}`)
    if (!before.ismanaged) {
      fail(
        `"${manifest.uniqueName}" is installed UNMANAGED in ${env.name}.`,
        'Importing a managed copy over an unmanaged one is not supported. Remove it first.'
      )
    }
  }

  postJson(
    'api/data/v9.2/ImportSolution',
    {
      OverwriteUnmanagedCustomizations: false,
      PublishWorkflows: true,
      CustomizationFile: bytes.toString('base64'),
      ImportJobId: crypto.randomUUID(),
    },
    env.dataverseUrl
  )

  const after = solutionRecord(manifest.uniqueName, env.dataverseUrl)
  if (!after) fail('Import reported success but the solution is not present.')
  ok(`installed v${after.version} (managed: ${after.ismanaged})`)

  console.log(
    `\n${DIM}Next: bind the app in this environment, then npm run alm:deploy -- ${target}${OFF}\n`
  )
}

// ---------------------------------------------------------------- status ----

function doStatus() {
  const cfg = almConfig()
  const manifest = readManifest()

  step('Solution status')
  console.log(
    manifest
      ? `${DIM}repo artifact: v${manifest.version} exported ${manifest.exportedAt}${OFF}`
      : `${YELLOW}no artifact in repo — run: npm run alm:solution -- export${OFF}`
  )
  console.log('')

  for (const name of cfg.promotionOrder) {
    const env = cfg.environments[name]
    if (!env.dataverseUrl) {
      console.log(`${name.padEnd(6)} ${DIM}not provisioned${OFF}`)
      continue
    }
    const record = solutionRecord(cfg.solution.uniqueName, env.dataverseUrl)
    if (!record) {
      console.log(`${name.padEnd(6)} ${YELLOW}not installed${OFF}`)
      continue
    }
    const kind = record.ismanaged ? 'managed' : 'unmanaged'
    const drift =
      manifest && name !== cfg.promotionOrder[0] && record.version !== manifest.version
        ? `${YELLOW}  <- differs from repo (v${manifest.version})${OFF}`
        : ''
    console.log(`${name.padEnd(6)} v${record.version} (${kind})${drift}`)
  }
  console.log('')
}

// ------------------------------------------------------------------ main ----

const [action, ...rest] = process.argv.slice(2)
if (action === 'export') doExport(rest)
else if (action === 'import') doImport(rest[0])
else if (action === 'status') doStatus()
else fail('Usage: npm run alm:solution -- <export|import|status> [args]')
