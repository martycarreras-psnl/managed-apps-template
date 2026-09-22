/**
 * npm run alm:upgrade -- [--tag scaffold-v1.2.0] [--check]
 *
 * Pulls shared scaffolding down from the template repo into this project.
 *
 * Only the paths listed in alm.config.json -> scaffold.paths are touched, so
 * your src/, ms.config.json, solutions/ and memory bank are never at risk.
 * This repo is a consumer too, which is what keeps it from drifting away from
 * what everyone else is running.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertCleanTree,
  fail,
  git,
  ok,
  step,
  ROOT,
  BOLD,
  DIM,
  GREEN,
  OFF,
  YELLOW,
} from './lib.mjs'
import { assertPathsSafe, scaffoldSpec } from './scaffold-lib.mjs'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const tagIndex = args.indexOf('--tag')
const wantedTag = tagIndex !== -1 ? args[tagIndex + 1] : null

const scaffold = scaffoldSpec()
assertPathsSafe(scaffold)

if (!scaffold.templateRepo) {
  fail('alm.config.json has no scaffold.templateRepo.')
}

if (!checkOnly) assertCleanTree()

step(`Upgrading scaffolding from ${BOLD}${scaffold.templateRepo}${OFF}`)
console.log(`${DIM}  local scaffold version: ${scaffold.version}${OFF}`)

// Attach the template as a remote on demand; harmless if it already exists.
const remotes = git(['remote']).split('\n').filter(Boolean)
if (!remotes.includes('template')) {
  git(['remote', 'add', 'template', scaffold.templateRepo])
  ok('added "template" remote')
}

git(['fetch', '--tags', '--quiet', 'template'], { capture: false })

// Prefer an explicit tag, else the newest scaffold-v* tag, else main.
let ref = wantedTag
if (!ref) {
  const tags = git(['tag', '--list', 'scaffold-v*', '--sort=-v:refname'], {
    allowFail: true,
  })
  const newest = tags?.split('\n').filter(Boolean)[0]
  ref = newest ?? 'template/main'
}
ok(`target ref: ${ref}`)

const remoteVersion = (() => {
  const raw = git(['show', `${ref}:alm.config.json`], { allowFail: true })
  if (!raw) return null
  try {
    return JSON.parse(raw).scaffold?.version ?? null
  } catch {
    return null
  }
})()

if (remoteVersion) {
  console.log(`${DIM}  template scaffold version: ${remoteVersion}${OFF}`)
  if (remoteVersion === scaffold.version && !wantedTag) {
    ok('already up to date')
  }
}

// Diff before touching anything.
step('Changes')
const diff = git(['diff', '--stat', `HEAD..${ref}`, '--', ...scaffold.paths], {
  allowFail: true,
})

if (!diff) {
  console.log(`${GREEN}✓${OFF} scaffolding is identical — nothing to do\n`)
  process.exit(0)
}
console.log(diff)

if (checkOnly) {
  console.log(
    `\n${YELLOW}Scaffolding differs from the template.${OFF}` +
      `\n${DIM}Run without --check to apply.${OFF}\n`
  )
  process.exit(1)
}

// Apply only the allowlisted paths.
step('Applying')
execFileSync('git', ['checkout', ref, '--', ...scaffold.paths], {
  cwd: ROOT,
  stdio: 'inherit',
})

for (const path of scaffold.paths) ok(path)

// Record the version we are now on.
if (remoteVersion) {
  const cfgPath = resolve(ROOT, 'alm.config.json')
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  cfg.scaffold.version = remoteVersion
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
  ok(`scaffold.version -> ${remoteVersion}`)
}

console.log(
  `\n${BOLD}Scaffolding updated.${OFF}\n` +
    `${DIM}Review with \`git diff --staged\`, then commit.\n` +
    `Run \`npm run alm:setup\` if hooks or the merge driver changed.${OFF}\n`
)
