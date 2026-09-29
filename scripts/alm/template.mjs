/**
 * npm run alm:template -- push [--message "..."] [--bump patch|minor|major | --tag scaffold-vX.Y.Z] [--prune]
 * npm run alm:template -- status
 *
 * Publishes the template from the ALM source repo (alm.config.json ->
 * scaffold.source: true). Projects cannot push; they only pull with alm:upgrade.
 *
 * What is copied:
 *   scaffold.paths        shared scaffolding; projects pull these with alm:upgrade
 *   scaffold.publishOnly  template-only files (docs site, reference app, README),
 *                         a path or { "from", "to" }; projects never pull these
 *   alm.config.json       this repo's copy, minus source/publishOnly
 *
 * Anything in scaffold.neverShare is refused outright, so environment IDs, app
 * bindings, solution artifacts and the memory bank can never leak into the
 * public template. Template files neither list accounts for stop the push
 * (--prune deletes them instead), so the template can't drift from this repo.
 *
 * The template checkout lives outside this repo (default: a sibling directory,
 * or $ALM_TEMPLATE_DIR). It is scratch space: each run resets it to the
 * published template.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  fail,
  ok,
  step,
  ROOT,
  BOLD,
  DIM,
  OFF,
  YELLOW,
} from './lib.mjs'
import { assertPathsSafe, gitIn, scaffoldSpec } from './scaffold-lib.mjs'

const args = process.argv.slice(2)
const action = args[0]

const scaffold = scaffoldSpec()
assertPathsSafe(scaffold)

if (!scaffold.templateRepo) fail('alm.config.json has no scaffold.templateRepo.')

const publishOnly = (scaffold.publishOnly ?? []).map((entry) =>
  typeof entry === 'string' ? { from: entry, to: entry } : entry
)
for (const { from, to } of publishOnly) {
  if (!from || !to) fail('scaffold.publishOnly entries must be a path or { "from": ..., "to": ... }.')
  if (!existsSync(resolve(ROOT, from))) fail(`scaffold.publishOnly path "${from}" does not exist in this repo.`)
  if (to === 'alm.config.json') {
    fail('Remove alm.config.json from scaffold.publishOnly; alm:template publishes it itself.')
  }
  for (const forbidden of scaffold.neverShare ?? []) {
    if ([from, to].some((p) => p === forbidden || p.startsWith(forbidden))) {
      fail(`scaffold.publishOnly contains "${from}", which is also in neverShare.`)
    }
  }
}

const covers = (entry, file) => file === entry || file.startsWith(entry.endsWith('/') ? entry : `${entry}/`)

const checkoutDir =
  process.env.ALM_TEMPLATE_DIR ??
  resolve(dirname(ROOT), 'managed-apps-template')

function ensureCheckout() {
  if (existsSync(join(checkoutDir, '.git'))) {
    // The checkout is scratch space owned by this script: every run starts from the published
    // template, so leftovers from an interrupted run (files, commits, unpushed tags) never publish.
    gitIn(checkoutDir, ['fetch', '--quiet', '--tags', '--prune', '--prune-tags', 'origin'])
    gitIn(checkoutDir, ['checkout', '--quiet', '--force', '-B', 'main', 'origin/main'])
    gitIn(checkoutDir, ['clean', '-fdq'])
    return
  }
  mkdirSync(dirname(checkoutDir), { recursive: true })
  step(`Cloning template into ${checkoutDir}`)
  gitIn(dirname(checkoutDir), ['clone', scaffold.templateRepo, checkoutDir], {
    capture: false,
  })
}

function copyScaffold() {
  const copied = []
  const entries = [...scaffold.paths.map((path) => ({ from: path, to: path })), ...publishOnly]
  for (const entry of entries) {
    const from = resolve(ROOT, entry.from)
    const to = resolve(checkoutDir, entry.to)

    // Refuse anything that resolves outside the template checkout.
    if (!to.startsWith(checkoutDir)) fail(`Refusing to write outside the template: ${entry.to}`)

    rmSync(to, { recursive: true, force: true })
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true })
    copied.push(entry.from === entry.to ? entry.to : `${entry.from} -> ${entry.to}`)
  }
  return copied
}

/**
 * The template's alm.config.json is this repo's, minus the source-only settings. It must stay
 * generic: every environment unprovisioned, with no IDs or org URLs.
 */
function templateConfig(version) {
  const cfg = JSON.parse(readFileSync(resolve(ROOT, 'alm.config.json'), 'utf8'))
  for (const [name, env] of Object.entries(cfg.environments ?? {})) {
    if (env.environmentId || env.appId || env.dataverseUrl) {
      fail(
        `alm.config.json -> environments.${name} carries IDs or an org URL.`,
        'The template is public; keep every environment unprovisioned in the ALM source repo.'
      )
    }
  }
  cfg.scaffold = { ...cfg.scaffold, version }
  delete cfg.scaffold.source
  delete cfg.scaffold.publishOnly
  return cfg
}

function writeTemplateConfig(cfg) {
  writeFileSync(resolve(checkoutDir, 'alm.config.json'), JSON.stringify(cfg, null, 2) + '\n')
}

/** Template files that neither scaffold.paths nor scaffold.publishOnly accounts for. */
function unmanagedTemplateFiles() {
  const managed = [...scaffold.paths, ...publishOnly.map((entry) => entry.to), 'alm.config.json']
  const tracked = (gitIn(checkoutDir, ['ls-files']) ?? '').split('\n').filter(Boolean)
  return tracked.filter((file) => !managed.some((entry) => covers(entry, file)))
}

/** Belt and braces: assert no forbidden file made it into the checkout. */
function assertSterile() {
  const leaked = []
  for (const forbidden of scaffold.neverShare ?? []) {
    const tracked = gitIn(checkoutDir, ['ls-files', forbidden], { allowFail: true })
    if (tracked) leaked.push(...tracked.split('\n').filter(Boolean))
  }
  if (leaked.length) {
    fail(
      'The template checkout contains project-specific files.',
      `Refusing to push: ${leaked.join(', ')}`
    )
  }
}

const VERSION_RE = /^\d+\.\d+\.\d+$/
const TAG_RE = /^scaffold-v(\d+\.\d+\.\d+)$/

function bumpVersion(version, part) {
  const seg = version.split('.').map((n) => parseInt(n, 10) || 0)
  while (seg.length < 3) seg.push(0)
  const index = { major: 0, minor: 1, patch: 2 }[part]
  if (index === undefined) {
    fail(`Unknown bump part "${part}".`, 'Use major, minor, or patch.')
  }
  seg[index] += 1
  for (let i = index + 1; i < seg.length; i++) seg[i] = 0
  return seg.join('.')
}

/**
 * A git tag alone does not move the number consumers compare against --
 * scaffold.version must change in the same commit the tag points at, in both
 * the template and this project. Resolving them together here removes the
 * chance of tagging a release nobody detects as new.
 */
function resolveRelease() {
  const bumpIndex = args.indexOf('--bump')
  const tagIndex = args.indexOf('--tag')

  if (bumpIndex !== -1 && tagIndex !== -1) {
    fail('Pass either --bump or --tag, not both.')
  }

  if (bumpIndex !== -1) {
    const part = args[bumpIndex + 1] ?? 'patch'
    const version = bumpVersion(scaffold.version, part)
    return { version, tag: `scaffold-v${version}` }
  }

  if (tagIndex !== -1) {
    const tag = args[tagIndex + 1]
    if (!tag) fail('--tag requires a value.')
    const match = TAG_RE.exec(tag)
    if (!match) {
      fail(
        `Tag "${tag}" does not match scaffold-vX.Y.Z.`,
        'Use --bump patch|minor|major, or a conforming tag.'
      )
    }
    return { version: match[1], tag }
  }

  return { version: null, tag: null }
}

/** Keep this project's recorded version in step with what was published. */
function recordLocalVersion(version) {
  const localPath = resolve(ROOT, 'alm.config.json')
  const local = JSON.parse(readFileSync(localPath, 'utf8'))
  if (local.scaffold.version === version) return false
  local.scaffold.version = version
  writeFileSync(localPath, JSON.stringify(local, null, 2) + '\n')
  return true
}

function doStatus() {
  ensureCheckout()
  step('Template status')

  const remoteRaw = gitIn(checkoutDir, ['show', 'HEAD:alm.config.json'], {
    allowFail: true,
  })
  let remoteVersion = null
  try {
    remoteVersion = remoteRaw ? JSON.parse(remoteRaw).scaffold?.version : null
  } catch {
    /* template may not carry alm.config.json yet */
  }

  console.log(`${DIM}  local    scaffold ${scaffold.version}${OFF}`)
  console.log(`${DIM}  template scaffold ${remoteVersion ?? 'unknown'}${OFF}`)

  const cfg = scaffold.source ? templateConfig(scaffold.version) : null
  const unmanaged = unmanagedTemplateFiles()
  copyScaffold()
  if (cfg) writeTemplateConfig(cfg)
  if (unmanaged.length) {
    console.log(`\n${YELLOW}Template files this repo doesn't manage (push stops on these; --prune deletes them):${OFF}`)
    for (const file of unmanaged) console.log(`  ${file}`)
  }
  const diff = gitIn(checkoutDir, ['status', '--porcelain'])
  console.log('')
  if (!diff) {
    ok('template already matches this repo')
  } else {
    console.log(`${YELLOW}Pending changes:${OFF}`)
    console.log(diff)
  }
  // Leave the checkout clean so `status` has no side effects.
  gitIn(checkoutDir, ['checkout', '--', '.'], { allowFail: true })
  gitIn(checkoutDir, ['clean', '-fd'], { allowFail: true })
  console.log('')
}

function doPush() {
  if (!scaffold.source) {
    fail(
      'Only the ALM source repo publishes to the template.',
      'Make the change there (its alm.config.json has scaffold.source: true), publish it, then run `npm run alm:upgrade` here.'
    )
  }
  const { version, tag } = resolveRelease()

  const messageIndex = args.indexOf('--message')
  const message =
    messageIndex !== -1
      ? args[messageIndex + 1]
      : version
        ? `chore: scaffolding ${version}`
        : `chore: sync scaffolding from ${scaffold.version}`

  ensureCheckout()

  if (tag) {
    const existing = gitIn(checkoutDir, ['tag', '--list', tag], { allowFail: true })
    if (existing) {
      fail(
        `Tag ${tag} already exists in the template.`,
        'Bump to the next version instead of re-cutting a published release.'
      )
    }
    ok(`release ${scaffold.version} -> ${version} (${tag})`)
  }

  const cfg = templateConfig(version ?? scaffold.version)
  const unmanaged = unmanagedTemplateFiles()
  if (unmanaged.length && !args.includes('--prune')) {
    fail(
      "The template has files this repo doesn't manage.",
      `${unmanaged.join(', ')}\nAdd them here and list them in scaffold.publishOnly, or rerun with --prune to delete them from the template.`
    )
  }
  for (const file of unmanaged) {
    gitIn(checkoutDir, ['rm', '-q', '--', file])
    ok(`pruned ${file}`)
  }

  step('Copying scaffolding')
  for (const path of copyScaffold()) ok(path)

  // The version must land in the SAME commit the tag points at, otherwise
  // consumers see a new tag carrying an unchanged version.
  writeTemplateConfig(cfg)
  ok(`alm.config.json (scaffold ${version ?? scaffold.version})`)

  assertSterile()
  ok('no project-specific files present')

  const pending = gitIn(checkoutDir, ['status', '--porcelain'])
  if (!pending) {
    console.log(`\n${DIM}Template already up to date — nothing to push.${OFF}\n`)
    return
  }

  step('Committing to template')
  console.log(pending)
  gitIn(checkoutDir, ['add', '-A'])
  gitIn(checkoutDir, ['commit', '-m', message], { capture: false })

  if (tag) {
    gitIn(checkoutDir, ['tag', '-a', tag, '-m', message], { allowFail: true })
    ok(`tagged ${tag}`)
  }

  gitIn(checkoutDir, ['push', 'origin', 'main'], { capture: false })
  if (tag) gitIn(checkoutDir, ['push', 'origin', tag], { capture: false })

  if (version && recordLocalVersion(version)) {
    ok(`local alm.config.json scaffold.version -> ${version}`)
    console.log(`${DIM}  commit that change here too${OFF}`)
  }

  console.log(`\n${BOLD}Template updated.${OFF} ${DIM}${checkoutDir}${OFF}\n`)
}

if (action === 'push') doPush()
else if (action === 'status') doStatus()
else {
  fail(
    'Usage: npm run alm:template -- <push|status> [--message "..."] [--bump patch|minor|major | --tag scaffold-vX.Y.Z]'
  )
}
