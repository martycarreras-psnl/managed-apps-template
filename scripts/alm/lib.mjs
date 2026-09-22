import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(here, '..', '..')

export const RED = '\x1b[31m'
export const GREEN = '\x1b[32m'
export const YELLOW = '\x1b[33m'
export const DIM = '\x1b[2m'
export const BOLD = '\x1b[1m'
export const OFF = '\x1b[0m'

export function fail(message, hint) {
  console.error(`\n${RED}${BOLD}✗ ${message}${OFF}`)
  if (hint) console.error(`${DIM}  ${hint}${OFF}`)
  console.error('')
  process.exit(1)
}

export function ok(message) {
  console.log(`${GREEN}✓${OFF} ${message}`)
}

export function step(message) {
  console.log(`\n${BOLD}${message}${OFF}`)
}

/**
 * Pushing to a platform-managed repo needs an interactive credential prompt.
 * The Copilot CLI harness sets GIT_TERMINAL_PROMPT=0 / GCM_INTERACTIVE=Never,
 * which makes Git Credential Manager fail instead of prompting.
 */
const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '1',
  GCM_INTERACTIVE: '1',
  GCM_GUI_PROMPT: '0',
  // The pre-push hook blocks direct pushes to env branches. These scripts are
  // the sanctioned path, so they opt through it.
  ALM_ALLOW_PUSH: '1',
}

export function git(args, { capture = true, allowFail = false } = {}) {
  try {
    const out = execFileSync('git', args, {
      cwd: ROOT,
      env: GIT_ENV,
      encoding: 'utf8',
      stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    })
    return capture ? out.trim() : ''
  } catch (error) {
    if (allowFail) return null
    const detail = error.stderr?.toString().trim() || error.message
    fail(`git ${args.join(' ')} failed`, detail)
  }
}

export function run(command, args, { allowFail = false } = {}) {
  try {
    execFileSync(command, args, { cwd: ROOT, env: GIT_ENV, stdio: 'inherit' })
    return true
  } catch (error) {
    if (allowFail) return false
    fail(`${command} ${args.join(' ')} failed`, error.message)
  }
}

export function almConfig() {
  const path = resolve(ROOT, 'alm.config.json')
  if (!existsSync(path)) fail('alm.config.json not found.')
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function msConfig() {
  const path = resolve(ROOT, 'ms.config.json')
  if (!existsSync(path)) {
    fail(
      'ms.config.json not found on this branch.',
      'Environment branches must carry their own ms.config.json.'
    )
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function resolveEnv(name) {
  const cfg = almConfig()
  const env = cfg.environments[name]
  if (!env) {
    fail(
      `Unknown environment "${name}".`,
      `Known: ${Object.keys(cfg.environments).join(', ')}`
    )
  }
  return { ...env, name, cfg }
}

export function currentBranch() {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'])
}

export function assertCleanTree() {
  const dirty = git(['status', '--porcelain'])
  if (dirty) {
    fail(
      'Working tree has uncommitted changes.',
      'Commit or stash before deploying — deploys build from a commit.'
    )
  }
}

export function assertRemoteExists(remote) {
  const remotes = git(['remote']).split('\n').filter(Boolean)
  if (!remotes.includes(remote)) {
    fail(
      `Git remote "${remote}" is not configured.`,
      `Add it with: git remote add ${remote} <platform-repo-url>`
    )
  }
}

export function assertMergeDriver() {
  const driver = git(['config', '--get', 'merge.ours.driver'], {
    allowFail: true,
  })
  if (!driver) {
    fail(
      'The "ours" merge driver is not registered in this clone.',
      'Run: npm run alm:setup'
    )
  }
}

/**
 * The single most important guard: the local ms.config.json is what
 * `ms app deploy` uses to choose the target. If it does not match the
 * environment we think we are deploying to, we would silently deploy to the
 * wrong place.
 */
export function assertConfigMatchesEnv(env) {
  const ms = msConfig()
  if (ms.environmentId !== env.environmentId) {
    fail(
      `ms.config.json targets the wrong environment.`,
      `branch "${env.branch}" expects ${env.environmentId}, but ms.config.json has ${ms.environmentId}`
    )
  }
  if (env.appId && ms.appId !== env.appId) {
    fail(
      `ms.config.json targets the wrong app.`,
      `expected appId ${env.appId}, found ${ms.appId}`
    )
  }
  return ms
}

export function assertProvisioned(env) {
  if (!env.provisioned) {
    fail(
      `Environment "${env.name}" is not provisioned yet.`,
      'Create the environment, run `ms app init` on its branch, then fill in alm.config.json.'
    )
  }
}
