/**
 * npm run alm:deploy -- <dev|test|prod>
 *
 * Deploys the current commit of an environment branch to that environment.
 * Every guard here exists because `ms app deploy` has no --environment-id:
 * it trusts whatever ms.config.json happens to be on disk.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertCleanTree,
  assertConfigMatchesEnv,
  assertProvisioned,
  assertRemoteExists,
  currentBranch,
  fail,
  git,
  ok,
  run,
  step,
  resolveEnv,
  ROOT,
  BOLD,
  DIM,
  OFF,
} from './lib.mjs'

/** Reads the installed solution version straight from the target org. */
function installedSolutionVersion(uniqueName, envUrl) {
  try {
    const raw = execFileSync(
      'dataverse',
      [
        'api', 'request', '--target', 'dataverse',
        '--environment', envUrl,
        '--path',
        `api/data/v9.2/solutions?$select=version&$filter=uniquename eq '${uniqueName}'`,
      ],
      { cwd: ROOT, encoding: 'utf8' }
    )
    return JSON.parse(raw).value?.[0]?.version ?? null
  } catch (error) {
    fail(
      'Could not read the installed solution version.',
      error.stderr?.toString().trim().slice(0, 300) || error.message
    )
  }
}

const target = process.argv[2]
if (!target) fail('Usage: npm run alm:deploy -- <dev|test|prod>')

const env = resolveEnv(target)
assertProvisioned(env)

step(`Deploying to ${BOLD}${env.name}${OFF} (${env.displayName})`)

// 1. Right branch.
const branch = currentBranch()
if (branch !== env.branch) {
  fail(
    `You are on "${branch}" but ${env.name} deploys from "${env.branch}".`,
    `Run: git checkout ${env.branch}`
  )
}
ok(`on branch ${env.branch}`)

// 2. Nothing uncommitted — the cloud build uses the pushed commit, so a dirty
//    tree means what you test locally is not what ships.
assertCleanTree()
ok('working tree clean')

// 3. The critical guard: config actually points where we think it does.
const ms = assertConfigMatchesEnv(env)
ok(`ms.config.json -> app ${ms.appId}`)
ok(`ms.config.json -> environment ${ms.environmentId}`)

// 4. Connection references must point at this environment's Dataverse org.
const refs = ms.connectionReferences ?? {}
for (const [refId, ref] of Object.entries(refs)) {
  for (const table of Object.values(ref.dataverseTables ?? {})) {
    if (table.environmentId !== env.environmentId) {
      fail(
        `Connection reference ${refId} points at the wrong environment.`,
        `table "${table.logicalName}" -> ${table.environmentId}, expected ${env.environmentId}. ` +
          `Re-run: ms app add data-source --connector shared_commondataserviceforapps --as table --table ${table.logicalName} --use-sso`
      )
    }
  }
}
ok('connection references match this environment')

// 5. Schema/app lockstep. Every deploy above dev must ship with the managed
//    solution that is committed in the repo, already imported into the target.
const isDev = env.name === env.cfg.promotionOrder[0]
if (!isDev) {
  const manifestPath = resolve(ROOT, 'solutions', 'manifest.json')
  if (!existsSync(manifestPath)) {
    fail(
      'No solutions/manifest.json in the repo.',
      'Run on dev: npm run alm:solution -- export   (then promote)'
    )
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  const zipPath = resolve(ROOT, manifest.artifacts.managed.file)
  if (!existsSync(zipPath)) {
    fail(`Missing solution artifact ${manifest.artifacts.managed.file}`)
  }
  const sha = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
  if (sha !== manifest.artifacts.managed.sha256) {
    fail(
      'Solution artifact does not match its manifest checksum.',
      'Re-export on dev: npm run alm:solution -- export'
    )
  }

  const installed = installedSolutionVersion(
    env.cfg.solution.uniqueName,
    env.dataverseUrl
  )
  if (!installed) {
    fail(
      `Solution "${env.cfg.solution.uniqueName}" is not installed in ${env.name}.`,
      `Run: npm run alm:solution -- import ${env.name}`
    )
  }
  if (installed !== manifest.version) {
    fail(
      `Schema drift: ${env.name} has v${installed} but the repo ships v${manifest.version}.`,
      `Run: npm run alm:solution -- import ${env.name}`
    )
  }
  ok(`solution v${manifest.version} in lockstep with ${env.name}`)
}

// 6. Build before pushing, so a broken build fails locally and fast.
step('Verifying the build')
run('npm', ['run', 'build'])
ok('build succeeded')

// 7. Push to this environment's platform repo — deploy builds from there.
step(`Pushing to platform repo "${env.remote}"`)
assertRemoteExists(env.remote)
run('git', ['push', env.remote, `${env.branch}:main`])
ok(`pushed ${env.branch} -> ${env.remote}/main`)

// 8. Mirror to GitHub when configured. Never fatal — GitHub is not the
//    deploy source, so a mirror failure must not block a release.
const remotes = git(['remote']).split('\n').filter(Boolean)
if (remotes.includes('github')) {
  const mirrored = run('git', ['push', 'github', env.branch], {
    allowFail: true,
  })
  if (mirrored) ok('mirrored to github')
  else console.log(`${DIM}  github mirror push failed (non-fatal)${OFF}`)
}

// 9. Deploy.
const sha = git(['rev-parse', 'HEAD'])
step(`Deploying commit ${sha.slice(0, 8)}`)
run('ms', ['app', 'deploy', '--commit', sha])

console.log(`\n${BOLD}Deployed ${env.name}${OFF} @ ${sha.slice(0, 8)}\n`)
