/**
 * npm run alm:init -- --name "Expense Tracker" --dev <env-id> [--test <env-id>] [--prod <env-id>]
 *                     [--solution ExpenseTracker] [--prefix contoso] [--fresh]
 *
 * Stands up a new project on this template: writes alm.config.json, creates the
 * dev/test/prod branches with the right binding rules, installs hooks and the
 * merge driver, and registers the dev app.
 *
 * Deliberately staged rather than one silent command. Test and prod cannot be
 * bound until the solution exists and has been imported there, and each new
 * platform repo triggers a credential prompt on first push.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  fail,
  git,
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
                      [--solution ExpenseTracker] [--prefix contoso] [--fresh]

  --name      App display name (required)
  --dev       Dev environment ID (required)
  --test      Test environment ID (optional, can be added later)
  --prod      Prod environment ID (optional, can be added later)
  --solution  Dataverse solution unique name (default: derived from --name)
  --prefix    Publisher prefix (default: derived from --name)
  --fresh     Remove the reference app, leaving an empty src/
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
const fresh = args.includes('--fresh')

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
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
ok(`solution ${solutionName}, prefix ${prefix}`)

// ------------------------------------------------------------ optional reset --

if (fresh) {
  step('Removing the reference app')
  for (const path of ['src/inventory', 'generated', 'tests', 'solutions']) {
    rmSync(resolve(ROOT, path), { recursive: true, force: true })
    ok(`removed ${path}`)
  }
  console.log(
    `${YELLOW}!${OFF} src/App.tsx still imports the reference app — replace it before building.`
  )
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
  if (existsSync(resolve(ROOT, 'ms.config.json'))) {
    git(['rm', '--quiet', '--cached', 'ms.config.json'], { allowFail: true })
    rmSync(resolve(ROOT, 'ms.config.json'), { force: true })
    git(['commit', '--quiet', '-m', `chore(${branch}): no binding until provisioned`], {
      allowFail: true,
    })
    ok(`${branch}: binding removed until provisioned`)
  } else {
    ok(`${branch}: no binding (correct)`)
  }
}

git(['checkout', '--quiet', cfg.promotionOrder[0]])

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

console.log(`
${BOLD}Dev is registered.${OFF} Remaining steps, in order:

  ${DIM}# 1. Create your Dataverse table, then bind it${OFF}
  ms app add data-source --connector shared_commondataserviceforapps \\
    --as table --table ${prefix}_yourtable --use-sso

  ${DIM}# 2. Create the solution in Dataverse and add your table to it,
  #    then update alm.config.json -> app.table / tableLogicalName${OFF}

  ${DIM}# 3. Security role (optional but recommended)${OFF}
  npm run alm:role -- create

  ${DIM}# 4. Export the managed solution into the repo${OFF}
  npm run alm:solution -- export -- --bump build

  ${DIM}# 5. First deploy${OFF}
  git add -A && git commit -m "feat: initial app"
  npm run alm:bootstrap -- dev
  npm run alm:deploy -- dev

  ${DIM}# 6. For test and prod, once their environments exist:
  #    import the solution first, THEN register and bind the app${OFF}
  npm run alm:solution -- import test

See docs/ALM.md for the full model.
`)
