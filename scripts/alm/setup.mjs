/**
 * npm run alm:setup
 *
 * Per-clone setup. Git attributes are committed, but the merge *driver* they
 * reference is local config — so every fresh clone must run this once or
 * promotion merges will silently clobber ms.config.json.
 */
import { almConfig, git, ok, step, DIM, OFF, YELLOW } from './lib.mjs'

step('Registering the "ours" merge driver')
git(['config', 'merge.ours.driver', 'true'])
ok('merge.ours.driver = true')
console.log(
  `${DIM}  ms.config.json is pinned per branch via .gitattributes${OFF}`
)

step('Installing git hooks')
git(['config', 'core.hooksPath', '.githooks'])
ok('core.hooksPath = .githooks')
console.log(
  `${DIM}  pre-push blocks direct pushes to test/prod${OFF}`
)

step('Checking git remotes')
const cfg = almConfig()
const remotes = git(['remote']).split('\n').filter(Boolean)

for (const [name, env] of Object.entries(cfg.environments)) {
  if (remotes.includes(env.remote)) {
    ok(`${name} -> remote "${env.remote}"`)
  } else if (env.provisioned) {
    console.log(
      `${YELLOW}!${OFF} ${name} is provisioned but remote "${env.remote}" is missing`
    )
  } else {
    console.log(`${DIM}·${OFF} ${name} not provisioned yet (no remote needed)`)
  }
}

if (!remotes.includes('github')) {
  console.log(`${YELLOW}!${OFF} no "github" remote — code source of truth`)
} else {
  ok('github remote present')
}

step('Checking branches')
const branches = git(['branch', '--format=%(refname:short)'])
  .split('\n')
  .filter(Boolean)
for (const env of Object.values(cfg.environments)) {
  if (branches.includes(env.branch)) ok(`branch ${env.branch}`)
  else console.log(`${YELLOW}!${OFF} missing branch ${env.branch}`)
}

console.log('\nSetup complete.\n')
