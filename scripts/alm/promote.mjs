/**
 * npm run alm:promote -- <dev|test|prod> [--from <env>]
 *
 * Merges the previous environment branch into the target and verifies that
 * ms.config.json survived untouched. Promotion only moves code; each branch
 * keeps its own environment binding.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  ROOT,
  BOLD,
  DIM,
  OFF,
  YELLOW,
} from './lib.mjs'

const args = process.argv.slice(2)
const target = args[0]
if (!target) {
  fail('Usage: npm run alm:promote -- <test|prod> [--from <env>]')
}

const fromFlag = args.indexOf('--from')
const cfg = almConfig()
const order = cfg.promotionOrder

const targetEnv = resolveEnv(target)
const targetIndex = order.indexOf(target)

let source
if (fromFlag !== -1) {
  source = args[fromFlag + 1]
  if (!source) fail('--from requires an environment name.')
} else {
  if (targetIndex <= 0) {
    fail(
      `"${target}" is the first environment in the promotion order.`,
      `Merge feature branches into "${target}" directly, or pass --from explicitly.`
    )
  }
  source = order[targetIndex - 1]
}

const sourceEnv = resolveEnv(source)

// Guard against skipping a stage by accident; --from is the deliberate override
// (used by hotfixes, which branch from prod).
const sourceIndex = order.indexOf(source)
if (fromFlag === -1 && sourceIndex !== targetIndex - 1) {
  fail(
    `Promotion order is ${order.join(' -> ')}.`,
    `Pass --from ${source} explicitly if you really mean to skip a stage.`
  )
}

step(`Promoting ${BOLD}${source}${OFF} -> ${BOLD}${target}${OFF}`)

assertMergeDriver()
ok('merge driver registered')

assertCleanTree()
ok('working tree clean')

const startingBranch = currentBranch()

git(['checkout', targetEnv.branch], { capture: false })
ok(`checked out ${targetEnv.branch}`)

// Snapshot the binding so we can prove the merge did not rewrite it.
// Unprovisioned environment branches deliberately have no ms.config.json,
// so its absence is valid — there is simply no binding to protect yet.
const configPath = resolve(ROOT, 'ms.config.json')
const before = existsSync(configPath) ? readFileSync(configPath, 'utf8') : null

const merged = git(
  ['merge', sourceEnv.branch, '--no-edit', '-m', `promote: ${source} -> ${target}`],
  { capture: false, allowFail: true }
)

if (merged === null) {
  console.error(
    `\n${YELLOW}Merge stopped with conflicts.${OFF}\n` +
      `${DIM}Resolve them, commit, then re-run the deploy step.\n` +
      `ms.config.json should NOT be among the conflicts — if it is, the merge\n` +
      `driver is not active; run npm run alm:setup.${OFF}\n`
  )
  process.exit(1)
}

const after = existsSync(configPath) ? readFileSync(configPath, 'utf8') : null

if (before === null && after !== null) {
  fail(
    `The merge added ms.config.json to "${targetEnv.branch}", which is not provisioned.`,
    `That binding belongs to another environment. Run: git reset --hard HEAD~1`
  )
}

if (before !== null && before !== after) {
  fail(
    'The merge modified ms.config.json — this would repoint the app at another environment.',
    'Run `git merge --abort` (or reset), then `npm run alm:setup` to register the merge driver.'
  )
}

if (before === null) {
  ok(`no binding on "${targetEnv.branch}" yet — nothing to protect`)
} else {
  ok('ms.config.json unchanged — environment binding intact')
}

console.log(
  `\n${BOLD}Merged.${OFF} Next: ${DIM}npm run alm:deploy -- ${target}${OFF}`
)
console.log(`${DIM}Started on "${startingBranch}"; now on "${targetEnv.branch}".${OFF}\n`)
