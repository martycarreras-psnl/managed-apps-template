#!/usr/bin/env node
/**
 * node .github/skills/managed-apps-devkit/scripts/apps-inventory.mjs [--csv <file>] [--json]
 *
 * Every Managed App the signed-in user can open or edit, joined to the Power
 * Platform environment it is registered in. Read-only.
 *
 *   ms app list --json      -> apps (tenant-wide, but only ones shared with you)
 *   ms app info --app <id>  -> environmentId, repoType, connectors per app
 *   pac admin list --json   -> environment display names/types (optional)
 *
 * Apps listed in ./alm.config.json are tagged with their ALM environment key.
 */
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const args = process.argv.slice(2)
const csvIndex = args.indexOf('--csv')
const csvPath = csvIndex === -1 ? null : args[csvIndex + 1]
const asJson = args.includes('--json')
const shell = process.platform === 'win32'

async function runJson(cmd, cmdArgs) {
  try {
    // Neutral cwd: inside a project, `ms app info` defaults to the environment
    // in ./ms.config.json and fails for apps registered anywhere else.
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

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
}

const [list, pacEnvs] = await Promise.all([
  runJson('ms', ['app', 'list', '--json', '--non-interactive']),
  runJson('pac', ['admin', 'list', '--json']),
])

if (!list?.items) {
  console.error('✗ `ms app list` failed. Check `ms auth status` and retry.')
  process.exit(1)
}

const envNames = Object.fromEntries(
  (Array.isArray(pacEnvs) ? pacEnvs : []).map((e) => [e.EnvironmentId, e])
)

const almTags = {}
const almPath = resolve(process.cwd(), 'alm.config.json')
if (existsSync(almPath)) {
  const cfg = JSON.parse(readFileSync(almPath, 'utf8'))
  for (const [key, env] of Object.entries(cfg.environments ?? {})) {
    if (env.appId) almTags[env.appId] = key
  }
}

const rows = await mapLimit(list.items, 3, async (app) => {
  // Concurrent `ms` calls intermittently fail on token refresh; retry.
  let info = null
  for (let attempt = 0; attempt < 4 && !info?.environmentId; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 750 * attempt))
    info = await runJson('ms', ['app', 'info', '--app', app.appId, '--json', '--non-interactive'])
  }
  info ??= {}
  const env = envNames[info.environmentId] ?? {}
  return {
    app: app.displayName,
    appId: app.appId,
    almEnv: almTags[app.appId] ?? '',
    environment: env.DisplayName ?? (info.environmentId ? '(name unavailable)' : '(unknown)'),
    environmentId: info.environmentId ?? '',
    environmentType: env.Type ?? '',
    environmentUrl: env.EnvironmentUrl ?? '',
    repoType: info.repoType ?? '',
    connectors: (info.connectors ?? [])
      .map((c) => c.displayName ?? c.apiId ?? c.name ?? '')
      .filter(Boolean)
      .join('; '),
    editAccess: app.hasEditAccess ?? '',
    lastDeployed: app.lastDeployedTime ?? 'never',
    playUrl: app.appPlayUri ?? '',
  }
})

rows.sort((a, b) => a.environment.localeCompare(b.environment) || a.app.localeCompare(b.app))

if (csvPath) {
  const q = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const headers = Object.keys(rows[0] ?? { app: '' })
  writeFileSync(
    csvPath,
    [headers.join(','), ...rows.map((r) => headers.map((h) => q(r[h])).join(','))].join('\n') + '\n'
  )
  console.error(`✓ wrote ${rows.length} apps to ${csvPath}`)
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2))
} else {
  const cols = ['app', 'almEnv', 'environment', 'environmentType', 'repoType', 'lastDeployed']
  const width = Object.fromEntries(
    cols.map((c) => [c, Math.min(40, Math.max(c.length, ...rows.map((r) => String(r[c]).length)))])
  )
  const line = (r) => cols.map((c) => String(r[c]).slice(0, 40).padEnd(width[c])).join('  ')
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))))
  console.log(cols.map((c) => '-'.repeat(width[c])).join('  '))
  rows.forEach((r) => console.log(line(r)))
  if (!pacEnvs) {
    console.error('\n! pac CLI not available — environment names omitted (IDs are still correct).')
  }
}
