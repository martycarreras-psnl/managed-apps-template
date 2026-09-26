#!/usr/bin/env node
/**
 * node .github/skills/managed-apps-devkit/scripts/doctor.mjs [--remote]
 *
 * One-shot, read-only health check for a Managed Apps project built on the
 * ALM template: tools, sign-in, per-clone git setup, branch <-> environment
 * binding, remotes, and provisioning state. --remote also checks remote drift
 * and whether a newer scaffold release exists.
 *
 * Exit code 1 when any ✗ check fails, so it can gate other steps.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const remoteChecks = process.argv.includes('--remote')
const shell = process.platform === 'win32'
let failures = 0

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', D = '\x1b[2m', B = '\x1b[1m', O = '\x1b[0m'
const pass = (m) => console.log(`${G}✓${O} ${m}`)
const warn = (m, hint) => console.log(`${Y}!${O} ${m}${hint ? `\n  ${D}${hint}${O}` : ''}`)
const bad = (m, hint) => {
  failures++
  console.log(`${R}✗${O} ${m}${hint ? `\n  ${D}${hint}${O}` : ''}`)
}
const section = (m) => console.log(`\n${B}${m}${O}`)

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      cwd: ROOT,
      shell,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    }).trim()
  } catch {
    return null
  }
}
const git = (...a) => sh('git', a)
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null)

section('Tools')
const nodeMajor = Number(process.versions.node.split('.')[0])
nodeMajor >= 22
  ? pass(`node ${process.versions.node}`)
  : bad(`node ${process.versions.node}`, 'The ms CLI requires Node 22+.')
for (const [label, cmd, probe, required, hint] of [
  ['git', 'git', ['--version'], true, 'Install git.'],
  ['ms', 'ms', ['--version'], true, 'npm install -g @microsoft/managed-apps-cli'],
  ['git-credential-manager', 'git', ['credential-manager', '--version'], true, 'Needed to push to platform-managed repos.'],
  ['pac', 'pac', ['help'], false, 'Optional: lists environments. dotnet tool install -g Microsoft.PowerApps.CLI.Tool'],
  ['dataverse', 'dataverse', ['--help'], false, 'Required by alm:solution, alm:role and alm:deploy above dev. Install via the Dataverse plugin (dv-connect skill) and make sure it is on PATH.'],
]) {
  const out = sh(cmd, probe)
  const version = out?.match(/\d+\.\d+\.\d+[^\s)]*/)?.[0]
  if (out != null) pass(`${label} ${version ?? ''}`.trim())
  else if (required) bad(`${label} not found`, hint)
  else warn(`${label} not found`, hint)
}

section('Sign-in')
const auth = sh('ms', ['auth', 'status'])
auth && !/not (signed|logged) in/i.test(auth)
  ? pass(auth.split('\n').find((l) => /@/.test(l))?.trim() ?? 'signed in')
  : bad('ms CLI is not signed in', 'Run: ms auth login')

section('Project')
if (!git('rev-parse', '--is-inside-work-tree')) {
  bad('Not inside a git repository.')
  process.exit(1)
}
const alm = readJson(resolve(ROOT, 'alm.config.json'))
const ms = readJson(resolve(ROOT, 'ms.config.json'))
if (!alm) {
  warn('No alm.config.json — not an ALM-template project.', 'Only standalone ms commands apply here.')
  if (ms) pass(`ms.config.json → app ${ms.appId} in ${ms.environmentId}`)
  process.exit(failures ? 1 : 0)
}
pass(
  `app "${alm.app?.displayName}", solution ${alm.solution?.uniqueName ?? '(none)'}, scaffold v${alm.scaffold?.version ?? '?'}`
)

git('config', '--get', 'merge.ours.driver')
  ? pass('merge driver registered')
  : bad('merge driver missing — promotions would overwrite ms.config.json', 'Run: npm run alm:setup')
git('config', '--get', 'core.hooksPath') === '.githooks'
  ? pass('git hooks installed')
  : bad('git hooks not installed', 'Run: npm run alm:setup')

const dirty = git('status', '--porcelain')
dirty
  ? warn(`working tree has ${dirty.split('\n').length} uncommitted change(s)`)
  : pass('working tree clean')

section('Environments')
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const remotes = (git('remote') ?? '').split('\n').filter(Boolean)
const order = alm.promotionOrder ?? Object.keys(alm.environments)
console.log(`${D}  promotion order: ${order.join(' → ')}${O}`)
for (const key of order) {
  const env = alm.environments[key]
  const here = env.branch === branch ? ` ${B}← current branch${O}` : ''
  if (!env.provisioned) {
    warn(`${key}: not provisioned${here}`, 'See playbooks/environments.md → "Provision a placeholder".')
    continue
  }
  const hasRemote = remotes.includes(env.remote)
  const hasBranch = git('rev-parse', '--verify', '--quiet', env.branch) != null
  const problems = [
    !hasRemote && `remote ${env.remote} missing`,
    !hasBranch && `branch ${env.branch} missing`,
  ].filter(Boolean)
  problems.length
    ? bad(`${key}: ${problems.join(', ')}${here}`)
    : pass(`${key}: ${env.displayName ?? ''} — app ${env.appId?.slice(0, 8)}…${here}`)
}
remotes.includes('github')
  ? pass('github remote present')
  : warn('no "github" remote', 'GitHub is the source of truth: git remote add github <url>')

section('Current branch binding')
const current = Object.entries(alm.environments).find(([, e]) => e.branch === branch)
if (!current) {
  pass(`on "${branch}" (not an environment branch — deploys run from environment branches only)`)
} else if (!ms) {
  current[1].provisioned
    ? bad(`"${branch}" has no ms.config.json but ${current[0]} is provisioned`)
    : pass(`"${branch}" has no ms.config.json (correct while unprovisioned)`)
} else {
  const [key, env] = current
  ms.environmentId === env.environmentId
    ? pass(`ms.config.json environment matches ${key}`)
    : bad(
        `ms.config.json targets ${ms.environmentId}, ${key} expects ${env.environmentId}`,
        "Do NOT deploy. Restore this branch's own ms.config.json."
      )
  !env.appId || ms.appId === env.appId
    ? pass(`ms.config.json app matches ${key} (${ms.appDisplayName ?? ms.appId})`)
    : bad(`ms.config.json app ${ms.appId}, ${key} expects ${env.appId}`)
  const host = env.dataverseUrl?.replace(/^https:\/\//, '').split('.')[0]
  const dataSets = Object.values(ms.connectionReferences ?? {}).flatMap((r) =>
    Object.keys(r.dataSets ?? {})
  )
  if (host && dataSets.length) {
    dataSets.every((d) => d.includes(host))
      ? pass(`connection references point at ${host}`)
      : bad(`a connection reference points outside ${host}`, dataSets.join(', '))
  }
}

if (remoteChecks) {
  section('Remotes (network)')
  const syncScript = resolve(ROOT, 'scripts/alm/sync.mjs')
  if (existsSync(syncScript)) {
    sh('node', [syncScript, '--check']) != null
      ? pass('all provisioned branches in sync with their remotes')
      : warn('remote drift detected', 'Run: npm run alm:sync -- --check   then   npm run alm:sync')
  }
  if (remotes.includes('template')) {
    const tags = (git('ls-remote', '--tags', '--refs', 'template', 'scaffold-v*') ?? '')
      .split('\n')
      .map((l) => l.split('refs/tags/scaffold-v')[1])
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    const latest = tags[0]
    if (latest && latest !== alm.scaffold?.version) {
      warn(`scaffold v${alm.scaffold?.version} — template has v${latest}`, 'Run: npm run alm:upgrade -- --check')
    } else if (latest) pass(`scaffold is current (v${latest})`)
  }
}

console.log(failures ? `\n${R}${failures} problem(s) found.${O}` : `\n${G}Healthy.${O}`)
process.exit(failures ? 1 : 0)
