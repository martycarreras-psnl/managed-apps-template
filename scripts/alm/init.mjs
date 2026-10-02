/**
 * npm run alm:init -- --name "Expense Tracker" --dev <env-id> [--test <env-id>] [--prod <env-id>]
 *                     [--solution ExpenseTracker] [--prefix contoso] [--fresh] [--app-only]
 *
 * Stands up a new project on this template: writes alm.config.json, creates the
 * dev/test/prod branches with the right binding rules, installs hooks and the
 * merge driver, and registers the dev app.
 *
 * Deliberately staged rather than one silent command. Test and prod cannot be
 * bound until the solution exists and has been imported there, and each new
 * platform repo triggers a credential prompt on first push.
 *
 * --app-only sets up a project with no Dataverse solution track: only app code
 * moves between stages, and alm:deploy skips the solution check. It implies
 * --fresh, because the reference app depends on a Dataverse table.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  fail,
  git,
  lookupDataverseUrl,
  ok,
  run,
  step,
  ROOT,
  BOLD,
  DIM,
  OFF,
  YELLOW,
} from './lib.mjs'

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1]
}

if (args.includes('--help') || args.length === 0) {
  console.log(`
${BOLD}alm:init${OFF} — stand up a new Managed Apps project

  npm run alm:init -- --name "Expense Tracker" --dev <env-id> \\
                      [--test <env-id>] [--prod <env-id>] \\
                      [--solution ExpenseTracker] [--prefix contoso] [--fresh] [--app-only]

  --name      App display name (required)
  --dev       Dev environment ID (required)
  --test      Test environment ID (optional, can be added later)
  --prod      Prod environment ID (optional, can be added later)
  --solution  Dataverse solution unique name (default: derived from --name)
  --prefix    Publisher prefix (default: derived from --name)
  --fresh     Replace the reference app with a placeholder page
  --app-only  No Dataverse solution: only app code is promoted (implies --fresh)
`)
  process.exit(0)
}

const name = flag('name')
const devEnv = flag('dev')
if (!name) fail('--name is required.')
if (!devEnv) fail('--dev <environment-id> is required.')

const slug = name.replace(/[^A-Za-z0-9]/g, '')
const solutionName = flag('solution') ?? slug
const prefix = (flag('prefix') ?? slug.slice(0, 8)).toLowerCase()
const appOnly = args.includes('--app-only')
const fresh = appOnly || args.includes('--fresh')

// ------------------------------------------------------------ prerequisites --

step('Checking prerequisites')
for (const [cmd, probe] of [
  ['node', ['--version']],
  ['git', ['--version']],
  ['ms', ['--version']],
]) {
  try {
    const v = execFileSync(cmd, probe, { encoding: 'utf8' }).trim().split('\n')[0]
    ok(`${cmd} ${v}`)
  } catch {
    fail(
      `"${cmd}" is not available.`,
      cmd === 'ms'
        ? 'Install it: npm install -g @microsoft/managed-apps-cli'
        : undefined
    )
  }
}

// Init commits on the new branches, which fails silently without an identity.
for (const key of ['user.name', 'user.email']) {
  if (!git(['config', '--get', key], { allowFail: true })) {
    fail(
      `git ${key} is not set.`,
      `Run: git config --global ${key} "<your ${key === 'user.name' ? 'name' : 'email'}>"`
    )
  }
}
ok('git identity set')

try {
  const status = execFileSync('ms', ['auth', 'status'], { encoding: 'utf8' })
  ok(status.trim().split('\n')[0])
} catch {
  fail('Not signed in.', 'Run: ms auth login')
}

// --------------------------------------------------------------- the config --

step('Writing alm.config.json')
const cfgPath = resolve(ROOT, 'alm.config.json')
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))

if (appOnly) {
  cfg.solution = null
  cfg.app = { displayName: name }
} else {
  cfg.solution = {
    ...cfg.solution,
    uniqueName: solutionName,
    friendlyName: name,
    publisherPrefix: prefix,
  }
  cfg.app = {
    ...cfg.app,
    displayName: name,
  }
}
cfg.environments.dev.environmentId = devEnv
cfg.environments.dev.displayName = `${name} (dev)`
for (const [key, value] of [
  ['test', flag('test')],
  ['prod', flag('prod')],
]) {
  if (value) {
    cfg.environments[key].environmentId = value
    cfg.environments[key].displayName = `${name} (${key})`
  }
}

// alm:solution and alm:role talk to Dataverse by URL, so record it now.
for (const key of appOnly ? [] : ['dev', 'test', 'prod']) {
  const env = cfg.environments[key]
  if (!env?.environmentId) continue
  const url = lookupDataverseUrl(env.environmentId)
  if (url) {
    env.dataverseUrl = url
    ok(`${key} Dataverse ${url}`)
  } else if (!env.dataverseUrl) {
    console.log(
      `${YELLOW}!${OFF} Couldn't look up ${key}'s Dataverse URL. Sign in to the Dataverse CLI or pac, ` +
        `or set environments.${key}.dataverseUrl in alm.config.json by hand.`
    )
  }
}
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
ok(appOnly ? 'app-only: no Dataverse solution' : `solution ${solutionName}, prefix ${prefix}`)

// The template repo ignores these so it never publishes a binding or schema.
// A project must commit both, on EVERY environment branch: test and prod are
// provisioned from their own branch, where an ignored ms.config.json would
// silently never be committed. Applied per branch below.
function trackProjectFiles() {
  const ignorePath = resolve(ROOT, '.gitignore')
  if (!existsSync(ignorePath)) return
  const lines = readFileSync(ignorePath, 'utf8').split('\n')
  const kept = lines.filter((l) => !['ms.config.json', '/ms.config.json', 'solutions/', '/solutions/'].includes(l.trim()))
  if (kept.length !== lines.length) writeFileSync(ignorePath, kept.join('\n'))
}

// ------------------------------------------------------------ optional reset --

if (fresh) {
  step('Replacing the reference app with a placeholder')
  for (const path of ['src/inventory', 'generated', 'solutions']) {
    rmSync(resolve(ROOT, path), { recursive: true, force: true })
    ok(`removed ${path}`)
  }
  // playwright.config.ts and capture-auth.ts import tests/support/env.ts.
  const keep = new Set(['support/env.ts'])
  const testsDir = resolve(ROOT, 'tests')
  if (existsSync(testsDir)) {
    for (const entry of readdirSync(testsDir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const rel = resolve(entry.parentPath ?? entry.path, entry.name).slice(testsDir.length + 1).replaceAll('\\', '/')
      if (!keep.has(rel)) rmSync(resolve(testsDir, rel), { force: true })
    }
    for (const entry of readdirSync(testsDir)) {
      const dir = resolve(testsDir, entry)
      if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true })
    }
    ok('removed the example tests (kept tests/support/env.ts)')
  }
  writeFileSync(
    resolve(ROOT, 'src/App.tsx'),
    `import './App.css'

export default function App() {
  return (
    <main className="placeholder">
      <h1>{${JSON.stringify(name)}}</h1>
      <p>Your app is set up. Ask your agent to add data and screens.</p>
    </main>
  )
}
`
  )
  writeFileSync(
    resolve(ROOT, 'src/App.css'),
    `.placeholder {
  max-width: 640px;
  margin: 64px auto;
  padding: 0 24px;
  font-family: system-ui, sans-serif;
}
`
  )
  ok('wrote a placeholder src/App.tsx')

  const indexPath = resolve(ROOT, 'index.html')
  if (existsSync(indexPath)) {
    const title = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    writeFileSync(
      indexPath,
      readFileSync(indexPath, 'utf8').replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    )
    ok('index.html title')
  }

  // One test so `npm run test:e2e` has something to run against the placeholder.
  if (existsSync(resolve(ROOT, 'tests/support/env.ts'))) writeFileSync(
    resolve(ROOT, 'tests/smoke.spec.ts'),
    `import { chromium, expect, test } from '@playwright/test'
import { PROFILE_DIR, playerUrl } from './support/env'

test('app loads inside the App Player', async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !process.env.E2E_HEADED,
    args: ['--disable-features=WebAuthenticationPlatformAuthenticator'],
  })
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(playerUrl(), { waitUntil: 'domcontentloaded' })
    await expect(
      page.frameLocator('iframe').first().getByRole('heading', { level: 1 })
    ).toBeVisible({ timeout: 120_000 })
  } finally {
    await context.close()
  }
})
`
  )
  if (existsSync(resolve(ROOT, 'tests/smoke.spec.ts'))) ok('tests/smoke.spec.ts')
}

// -------------------------------------------------------------- local setup --

step('Installing hooks and the merge driver')
run('npm', ['run', 'alm:setup'])

// ----------------------------------------------------------------- branches --

step('Creating environment branches')
const existing = git(['branch', '--format=%(refname:short)']).split('\n').filter(Boolean)
const current = git(['rev-parse', '--abbrev-ref', 'HEAD'])

for (const branch of cfg.promotionOrder) {
  if (existing.includes(branch)) {
    ok(`${branch} (exists)`)
    continue
  }
  git(['branch', branch, current])
  ok(`created ${branch}`)
}

// Unprovisioned branches must NOT carry a binding: `ms app deploy` trusts
// whatever ms.config.json is on disk, so an inherited one would deploy to the
// wrong environment.
for (const branch of cfg.promotionOrder.slice(1)) {
  git(['checkout', '--quiet', branch])
  const done = []
  if (existsSync(resolve(ROOT, 'ms.config.json'))) {
    git(['rm', '--quiet', '--cached', 'ms.config.json'], { allowFail: true })
    rmSync(resolve(ROOT, 'ms.config.json'), { force: true })
    done.push('binding removed until provisioned')
  }
  trackProjectFiles()
  if (git(['status', '--porcelain', '--', '.gitignore'])) {
    git(['add', '.gitignore'])
    done.push('.gitignore tracks ms.config.json and solutions/')
  }
  if (done.length) {
    git(['commit', '--quiet', '-m', `chore(${branch}): no binding until provisioned`], {
      allowFail: true,
    })
    ok(`${branch}: ${done.join('; ')}`)
  } else {
    ok(`${branch}: no binding (correct)`)
  }
}

git(['checkout', '--quiet', cfg.promotionOrder[0]])
trackProjectFiles()
ok(`${cfg.promotionOrder[0]}: .gitignore tracks ms.config.json and solutions/ (commit with setup)`)

// --------------------------------------------------------------- dev app ----

step(`Registering the dev app in ${devEnv}`)
run('ms', [
  'app', 'init',
  '--display-name', name,
  '--environment-id', devEnv,
  '--repo', 'native',
  '--non-interactive',
])

const ms = JSON.parse(readFileSync(resolve(ROOT, 'ms.config.json'), 'utf8'))
cfg.environments.dev.appId = ms.appId
cfg.environments.dev.provisioned = true
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
ok(`dev app ${ms.appId}`)

// `ms app init` always names its remote "origin"; our convention is env-*.
const remotes = git(['remote']).split('\n').filter(Boolean)
if (remotes.includes('origin') && !remotes.includes('env-dev')) {
  git(['remote', 'rename', 'origin', 'env-dev'])
  ok('origin -> env-dev')
}

// ------------------------------------------------------------------- next ----

if (appOnly) {
  console.log(`
${BOLD}Dev is registered.${OFF} This is an app-only project: only app code moves between stages.

  ${DIM}# 1. Build the app (or copy in your existing src/), then check it locally${OFF}
  ms app dev

  ${DIM}# 2. First deploy. Run the bootstrap in a visible terminal: the first
  #    fetch from the platform repo opens a one-time sign-in.${OFF}
  git add -A && git commit -m "feat: initial app"
  npm run alm:bootstrap -- dev
  npm run alm:deploy -- dev

  ${DIM}# 3. For test and prod, once their environments exist: register the app
  #    from its branch, then promote and deploy${OFF}
  git checkout test
  ms app init --display-name "${name} [TEST]" --environment-id <id> --repo native --non-interactive

See docs/ALM.md → App-only projects.
`)
  process.exit(0)
}

console.log(`
${BOLD}Dev is registered.${OFF} Remaining steps, in order:

  ${DIM}# 1. Create the publisher and solution in dev (before any table)${OFF}
  npm run alm:solution -- create

  ${DIM}# 2. Create your Dataverse table inside that solution, then bind it${OFF}
  ms app add data-source --connector shared_commondataserviceforapps \\
    --as table --table ${prefix}_yourtable --use-sso

  ${DIM}#    then update alm.config.json -> app.table / tableLogicalName${OFF}

  ${DIM}# 3. Security role (optional but recommended)${OFF}
  npm run alm:role -- create

  ${DIM}# 4. Export the managed solution into the repo${OFF}
  npm run alm:solution -- export -- --bump build

  ${DIM}# 5. First deploy. Run the bootstrap in a visible terminal: the first
  #    fetch from the platform repo opens a one-time sign-in.${OFF}
  git add -A && git commit -m "feat: initial app"
  npm run alm:bootstrap -- dev
  npm run alm:deploy -- dev

  ${DIM}# 6. For test and prod, once their environments exist:
  #    import the solution first, THEN register and bind the app${OFF}
  npm run alm:solution -- import test

See docs/ALM.md for the full model.
`)
