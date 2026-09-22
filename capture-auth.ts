import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { PROFILE_DIR, playerUrl } from './tests/support/env'

/**
 * One-time interactive login.
 *
 *   npm run test:e2e:login
 *
 * Opens a real browser using the same persistent profile the test suite uses.
 * Sign in once here and every later `npm run test:e2e` run reuses the session.
 *
 * Note: pick a password / Authenticator sign-in method. Passkeys (Touch ID)
 * cannot be used inside an automated Chromium.
 */
async function main() {
  const url = playerUrl()
  mkdirSync(PROFILE_DIR, { recursive: true })

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-features=WebAuthenticationPlatformAuthenticator'],
  })

  const page = context.pages()[0] ?? (await context.newPage())

  console.log('\nOpening the App Player. Sign in with your Microsoft account.')
  console.log('If it offers a passkey / Face-Touch ID, choose')
  console.log('"Sign in another way" -> Password or Authenticator app.\n')
  console.log(`   ${url}\n`)

  await page.goto(url, { waitUntil: 'domcontentloaded' })

  console.log('Waiting for the app to render (up to 10 minutes)...')
  await page
    .frameLocator('iframe')
    .first()
    .getByRole('heading', { name: 'Managed Apps Inventory' })
    .waitFor({ timeout: 10 * 60 * 1000 })

  console.log('\nSigned in and app rendered. Profile saved.')
  console.log('   Run the suite with: npm run test:e2e\n')

  await context.close()
}

main().catch((error) => {
  console.error('\nLogin capture failed:', error?.message ?? error)
  console.error(
    '\nIf the window closed during a passkey prompt, re-run and choose' +
      '\n"Sign in another way" -> Password or Authenticator app.\n'
  )
  process.exit(1)
})
