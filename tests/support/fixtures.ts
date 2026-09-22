import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { PROFILE_DIR, playerUrl } from './env'
import { InventoryPage } from './inventory-page'

type Fixtures = {
  context: BrowserContext
  page: Page
  app: InventoryPage
}

/**
 * Every test runs inside a persistent Chromium profile so the Microsoft sign-in
 * captured by `npm run test:e2e:login` is reused. The App Player hosts the app
 * in an iframe, so `app` wraps that frame.
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: process.env.E2E_HEADED ? false : true,
      viewport: { width: 1440, height: 900 },
      args: ['--disable-features=WebAuthenticationPlatformAuthenticator'],
    })
    await use(context)
    await context.close()
  },

  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage())
    await use(page)
  },

  app: async ({ page }, use) => {
    const app = new InventoryPage(page)
    await page.goto(playerUrl(), { waitUntil: 'domcontentloaded' })
    await app.waitForReady()
    await use(app)
  },
})

export { expect }
