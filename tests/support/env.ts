import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const PROJECT_ROOT = resolve(here, '..', '..')

/**
 * Persistent Chromium profile. Using a real profile (rather than a saved
 * storageState blob) keeps the Microsoft sign-in durable across runs and avoids
 * re-triggering the full auth flow on every suite execution.
 */
export const PROFILE_DIR = resolve(PROJECT_ROOT, 'playwright', '.profile')

/** Vite dev port. Override with E2E_DEV_PORT when dev runs on another port. */
export const DEV_PORT = Number(process.env.E2E_DEV_PORT ?? 5173)

export const DEV_ORIGIN = `http://localhost:${DEV_PORT}`

const PLAYER_HOST =
  process.env.E2E_PLAYER_HOST ??
  'https://play.preview.managedapps.cloud.microsoft'

/**
 * Rebuilds the App Player dev URL that `ms app dev` prints, so the suite keeps
 * working if the dev port changes.
 */
export function playerUrl(): string {
  if (process.env.E2E_PLAYER_URL) return process.env.E2E_PLAYER_URL

  const appUrl = encodeURIComponent(`${DEV_ORIGIN}/`)
  const configUrl = encodeURIComponent(
    `${DEV_ORIGIN}/__vite_managedapps_plugin__/ms.config.json`
  )
  return `${PLAYER_HOST}/apps/dev?ms_appUrl=${appUrl}&ms_appConfigUrl=${configUrl}`
}

type MsConfig = { appDisplayName?: string; environmentId?: string }

export function msConfig(): MsConfig {
  return JSON.parse(
    readFileSync(resolve(PROJECT_ROOT, 'ms.config.json'), 'utf8')
  ) as MsConfig
}
