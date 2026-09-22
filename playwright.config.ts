import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { AUTH_STATE_PATH, playerUrl } from './tests/support/env'

if (!existsSync(AUTH_STATE_PATH)) {
  console.warn(
    '\n  No saved session found at playwright/.auth/user.json.' +
      '\n  Run `npm run test:e2e:login` once to sign in.\n'
  )
}

export default defineConfig({
  testDir: './tests',
  // Tests share one live Dataverse table, so they must not race each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: playerUrl(),
    storageState: existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
