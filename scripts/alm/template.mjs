/**
 * npm run alm:template -- push [--message "..."] [--tag scaffold-v1.1.0]
 * npm run alm:template -- status
 *
 * Promotes shared scaffolding from this project UP to the template repo.
 *
 * Only alm.config.json -> scaffold.paths are copied, and anything in
 * scaffold.neverShare is refused outright, so environment IDs, app bindings,
 * solution artifacts and the memory bank can never leak into a public repo.
 *
 * The template checkout lives outside this repo (default: a sibling directory)
 * so nothing here is disturbed.
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

const checkoutDir =
  process.env.ALM_TEMPLATE_DIR ??
  resolve(dirname(ROOT), 'managed-apps-template')

function ensureCheckout() {
  if (existsSync(join(checkoutDir, '.git'))) {
    gitIn(checkoutDir, ['fetch', '--quiet', 'origin'], { allowFail: true })
    gitIn(checkoutDir, ['checkout', '--quiet', 'main'], { allowFail: true })
    gitIn(checkoutDir, ['pull', '--quiet', '--ff-only', 'origin', 'main'], {
      allowFail: true,
    })
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
  for (const path of scaffold.paths) {
    const from = resolve(ROOT, path)
    const to = resolve(checkoutDir, path)

    // Refuse anything that resolves outside the template checkout.
    if (!to.startsWith(checkoutDir)) fail(`Refusing to write outside the template: ${path}`)

    rmSync(to, { recursive: true, force: true })
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true })
    copied.push(path)
  }
  return copied
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

  copyScaffold()
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

  step('Copying scaffolding')
  for (const path of copyScaffold()) ok(path)

  // Keep the template's alm.config.json in step on version + paths only.
  // The version must land in the SAME commit the tag points at, otherwise
  // consumers see a new tag carrying an unchanged version.
  const templateCfgPath = resolve(checkoutDir, 'alm.config.json')
  if (existsSync(templateCfgPath)) {
    const templateCfg = JSON.parse(readFileSync(templateCfgPath, 'utf8'))
    templateCfg.scaffold = {
      ...templateCfg.scaffold,
      version: version ?? scaffold.version,
      paths: scaffold.paths,
      neverShare: scaffold.neverShare,
      templateRepo: scaffold.templateRepo,
    }
    writeFileSync(templateCfgPath, JSON.stringify(templateCfg, null, 2) + '\n')
    ok(`alm.config.json scaffold block (version ${version ?? scaffold.version})`)
  }

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
