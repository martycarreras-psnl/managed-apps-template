/**
 * npm run alm:bootstrap -- <test|prod>
 *
 * A freshly provisioned platform-managed repo is created with its own
 * "Initial commit" (a stub README) and therefore shares no history with this
 * repo. The first push is rejected as a non-fast-forward.
 *
 * This reconciles the two histories once, keeping our files. Safe to re-run:
 * it is a no-op when the histories are already joined.
 */
import {
  assertCleanTree,
  assertRemoteExists,
  currentBranch,
  fail,
  git,
  ok,
  step,
  resolveEnv,
  BOLD,
  DIM,
  OFF,
} from './lib.mjs'

const target = process.argv[2]
if (!target) fail('Usage: npm run alm:bootstrap -- <test|prod>')

const env = resolveEnv(target)
assertRemoteExists(env.remote)
assertCleanTree()

const branch = currentBranch()
if (branch !== env.branch) {
  fail(
    `You are on "${branch}" but ${env.name} bootstraps from "${env.branch}".`,
    `Run: git checkout ${env.branch}`
  )
}

step(`Bootstrapping ${BOLD}${env.remote}${OFF} history`)

git(['fetch', env.remote], { capture: false })

const remoteRef = `${env.remote}/main`
const remoteHead = git(['rev-parse', '--verify', remoteRef], { allowFail: true })
if (!remoteHead) {
  ok('remote has no main branch yet — nothing to reconcile')
  process.exit(0)
}

const base = git(['merge-base', 'HEAD', remoteRef], { allowFail: true })
if (base) {
  ok('histories already share a base — nothing to do')
  process.exit(0)
}

console.log(
  `${DIM}  remote has unrelated history (${remoteHead.slice(0, 8)}) — merging${OFF}`
)

const merged = git(
  [
    'merge',
    remoteRef,
    '--allow-unrelated-histories',
    '--no-edit',
    '-m',
    `chore: reconcile ${env.remote} initial commit`,
  ],
  { capture: false, allowFail: true }
)

if (merged === null) {
  // The only expected conflict is the stub README the platform repo ships.
  const conflicts = git(['diff', '--name-only', '--diff-filter=U'])
    .split('\n')
    .filter(Boolean)

  const unexpected = conflicts.filter((f) => f !== 'README.md')
  if (unexpected.length) {
    fail(
      `Unexpected merge conflicts: ${unexpected.join(', ')}`,
      'Resolve manually, commit, then re-run.'
    )
  }

  git(['checkout', '--ours', 'README.md'])
  git(['add', 'README.md'])
  git(['commit', '--no-edit'], { capture: false })
  ok('resolved stub README in our favour')
}

ok(`${env.branch} now shares history with ${env.remote}`)
console.log(`\n${DIM}Next: npm run alm:deploy -- ${target}${OFF}\n`)
