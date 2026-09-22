import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { almConfig, fail, ROOT } from './lib.mjs'

/** Git invocation against an arbitrary working directory. */
export function gitIn(cwd, args, { allowFail = false, capture = true } = {}) {
  try {
    const out = execFileSync('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '1',
        GCM_INTERACTIVE: '1',
        GCM_GUI_PROMPT: '0',
        ALM_ALLOW_PUSH: '1',
      },
      encoding: 'utf8',
      stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    })
    return capture ? out.trim() : ''
  } catch (error) {
    if (allowFail) return null
    fail(
      `git ${args.join(' ')} failed`,
      (error.stderr?.toString().trim() || error.message).slice(0, 500)
    )
  }
}

export function scaffoldSpec() {
  const cfg = almConfig()
  const scaffold = cfg.scaffold
  if (!scaffold?.paths?.length) {
    fail(
      'alm.config.json has no scaffold.paths.',
      'Define which paths belong to the shared scaffolding.'
    )
  }
  return scaffold
}

/**
 * Guards the allowlist. A scaffold path must never overlap the neverShare
 * list -- that is what keeps project bindings out of the template and keeps
 * template updates from clobbering a downstream project.
 */
export function assertPathsSafe(scaffold) {
  const never = scaffold.neverShare ?? []
  for (const path of scaffold.paths) {
    for (const forbidden of never) {
      if (path === forbidden || path.startsWith(forbidden)) {
        fail(
          `scaffold.paths contains "${path}", which is also in neverShare.`,
          'Scaffolding must not include project-specific files.'
        )
      }
    }
    if (!existsSync(resolve(ROOT, path))) {
      fail(`scaffold path "${path}" does not exist in this repo.`)
    }
  }
}
