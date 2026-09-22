/**
 * npm run alm:hotfix -- start <name>
 * npm run alm:hotfix -- land  <name>
 *
 * Hotfixes branch from prod, never from dev — that is what excludes in-flight
 * enhancement work. `land` merges to prod and then back-merges into every
 * earlier environment, which is the step that is easy to forget and which
 * silently reverts the fix on the next promotion if skipped.
 */
import {
  almConfig,
  assertCleanTree,
  assertMergeDriver,
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

const [action, name] = process.argv.slice(2)
if (!action || !name) {
  fail('Usage: npm run alm:hotfix -- <start|land> <name>')
}

const cfg = almConfig()
const order = cfg.promotionOrder
const prodName = order[order.length - 1]
const prod = resolveEnv(prodName)
const branchName = `hotfix/${name}`

assertCleanTree()

if (action === 'start') {
  step(`Starting ${BOLD}${branchName}${OFF} from ${prod.branch}`)

  git(['fetch', prod.remote, prod.branch], { allowFail: true })
  git(['checkout', prod.branch], { capture: false })
  git(['checkout', '-b', branchName], { capture: false })

  ok(`created ${branchName} from ${prod.branch}`)
  console.log(
    `\n${DIM}Fix the issue, commit, verify with \`ms app dev\`, then:\n` +
      `  npm run alm:hotfix -- land ${name}${OFF}\n`
  )
  process.exit(0)
}

if (action !== 'land') {
  fail(`Unknown action "${action}". Use "start" or "land".`)
}

const branches = git(['branch', '--format=%(refname:short)'])
  .split('\n')
  .filter(Boolean)
if (!branches.includes(branchName)) {
  fail(`Branch ${branchName} does not exist.`, `Start it with: npm run alm:hotfix -- start ${name}`)
}

assertMergeDriver()

step(`Landing ${BOLD}${branchName}${OFF} into ${prod.branch}`)
git(['checkout', prod.branch], { capture: false })
git(['merge', branchName, '--no-edit', '-m', `hotfix: ${name}`], {
  capture: false,
})
ok(`merged into ${prod.branch}`)

console.log(
  `\n${DIM}Now deploy prod:  npm run alm:deploy -- ${prodName}${OFF}`
)

// Back-merge into every earlier environment so the next promotion does not
// revert the fix.
step('Back-merging into earlier environments')
for (const envName of order.slice(0, -1)) {
  const env = resolveEnv(envName)
  git(['checkout', env.branch], { capture: false })
  git(['merge', prod.branch, '--no-edit', '-m', `back-merge: hotfix ${name}`], {
    capture: false,
  })
  ok(`${env.branch} now contains the hotfix`)
}

git(['checkout', prod.branch], { capture: false })

console.log(
  `\n${BOLD}Hotfix landed.${OFF}\n` +
    `${DIM}Deploy prod, then redeploy any earlier environment you want updated:\n` +
    `  npm run alm:deploy -- ${prodName}\n` +
    `  npm run alm:deploy -- ${order[0]}${OFF}\n`
)
console.log(`${DIM}Currently on "${currentBranch()}".${OFF}\n`)
