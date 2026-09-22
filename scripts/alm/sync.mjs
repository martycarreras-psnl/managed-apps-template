/**
 * npm run alm:sync            — push every provisioned branch to github + its env remote
 * npm run alm:sync -- --check — report drift without pushing
 *
 * Keeps the GitHub mirror and every platform-managed repo aligned with local
 * branches, so "which remote has what" never has to be reasoned about.
 */
import {
  almConfig,
  assertCleanTree,
  currentBranch,
  git,
  ok,
  step,
  BOLD,
  DIM,
  GREEN,
  OFF,
  YELLOW,
} from './lib.mjs'

const checkOnly = process.argv.includes('--check')
const cfg = almConfig()
const remotes = git(['remote']).split('\n').filter(Boolean)
const startingBranch = currentBranch()

if (!checkOnly) assertCleanTree()

step(checkOnly ? 'Checking remote sync' : 'Syncing remotes')

let drift = 0

for (const name of cfg.promotionOrder) {
  const env = cfg.environments[name]
  const branch = env.branch

  const localSha = git(['rev-parse', '--verify', branch], { allowFail: true })
  if (!localSha) {
    console.log(`${branch.padEnd(6)} ${YELLOW}no local branch${OFF}`)
    continue
  }

  const targets = []
  if (remotes.includes('github')) targets.push({ remote: 'github', ref: branch })
  if (env.provisioned && remotes.includes(env.remote)) {
    targets.push({ remote: env.remote, ref: 'main' })
  } else if (env.provisioned) {
    console.log(
      `${branch.padEnd(6)} ${YELLOW}remote "${env.remote}" missing${OFF}`
    )
  }

  for (const { remote, ref } of targets) {
    git(['fetch', '--quiet', remote, ref], { allowFail: true })
    const remoteSha = git(['rev-parse', '--verify', `${remote}/${ref}`], {
      allowFail: true,
    })

    const label = `${branch} -> ${remote}/${ref}`

    if (remoteSha === localSha) {
      console.log(`${GREEN}✓${OFF} ${label} ${DIM}(${localSha.slice(0, 8)})${OFF}`)
      continue
    }

    drift++

    if (checkOnly) {
      const ahead = remoteSha
        ? git(['rev-list', '--count', `${remote}/${ref}..${branch}`], {
            allowFail: true,
          })
        : '?'
      const behind = remoteSha
        ? git(['rev-list', '--count', `${branch}..${remote}/${ref}`], {
            allowFail: true,
          })
        : '?'
      console.log(
        `${YELLOW}!${OFF} ${label} ${DIM}ahead ${ahead}, behind ${behind}${OFF}`
      )
      continue
    }

    // Never force. A remote ahead of local is a real signal, not noise.
    const pushed = git(['push', remote, `${branch}:${ref}`], {
      capture: false,
      allowFail: true,
    })
    if (pushed === null) {
      console.log(
        `${YELLOW}!${OFF} ${label} ${DIM}push rejected — remote has work you do not have${OFF}`
      )
    } else {
      console.log(`${GREEN}✓${OFF} ${label} ${DIM}pushed${OFF}`)
      drift--
    }
  }
}

git(['checkout', '--quiet', startingBranch], { allowFail: true })

console.log(
  drift === 0
    ? `\n${BOLD}All remotes in sync.${OFF}\n`
    : `\n${YELLOW}${drift} remote ref(s) out of sync.${OFF}\n`
)

if (checkOnly && drift > 0) process.exit(1)
