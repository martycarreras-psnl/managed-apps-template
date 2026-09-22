import { expect, test } from './support/fixtures'
import { uniqueName } from './support/data'

test.describe('CRUD against live Dataverse', () => {
  test('creates a record and shows it in the list', async ({ app }) => {
    const name = uniqueName('create')

    const before = await app.statCount('Apps tracked')

    await app.createApp({
      name,
      description: 'Created by the automated suite.',
      valueProvided: 'Proves the create path writes to Dataverse.',
      coreDataSource: 'Dataverse',
      status: 'Local dev',
      environment: 'contoso-dev',
    })

    const card = app.card(name)
    await expect(card).toBeVisible()
    await expect(card).toContainText('Created by the automated suite.')
    await expect(card.locator('.tag-source')).toHaveText('Dataverse')
    await expect(card.locator('.tone-local')).toHaveText('Local dev')
    await expect(card.locator('.tag-private')).toHaveText('Private')

    await expect(app.statValue('Apps tracked')).toHaveText(String(before + 1))

    await app.deleteIfPresent(name)
  })

  test('persists a created record across a full reload', async ({ app, page }) => {
    const name = uniqueName('persist')

    await app.createApp({
      name,
      description: 'Should survive a reload.',
      coreDataSource: 'SharePoint',
      status: 'Draft',
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await app.waitForReady()

    await expect(app.card(name)).toBeVisible({ timeout: 45_000 })

    await app.deleteIfPresent(name)
  })

  test('edits a record and reflects the change', async ({ app }) => {
    const name = uniqueName('edit')

    await app.createApp({
      name,
      description: 'Original description.',
      coreDataSource: 'Teams',
      status: 'Draft',
      shared: false,
    })

    await app.openEditForm(name)
    await app.fillForm({
      name,
      description: 'Updated description.',
      coreDataSource: 'Excel Online',
      status: 'Deployed',
      shared: true,
      sharedWith: 'finance@contoso.com',
    })
    await app.submitForm()
    await expect(app.modal).toBeHidden({ timeout: 45_000 })

    const card = app.card(name)
    await expect(card).toContainText('Updated description.')
    await expect(card.locator('.tag-source')).toHaveText('Excel Online')
    await expect(card.locator('.tone-deployed')).toHaveText('Deployed')
    await expect(card.locator('.tag-shared')).toHaveText('Shared')
    await expect(card).toContainText('finance@contoso.com')

    await app.deleteIfPresent(name)
  })

  test('cancelling delete keeps the record', async ({ app }) => {
    const name = uniqueName('delete-cancel')

    await app.createApp({ name, description: 'Should not be deleted.' })

    await app.requestDelete(name)
    await app.cancelDelete()

    await expect(app.card(name)).toBeVisible()

    await app.deleteIfPresent(name)
  })

  test('confirming delete removes the record and updates the total', async ({
    app,
  }) => {
    const name = uniqueName('delete-confirm')

    await app.createApp({ name, description: 'Will be deleted.' })
    const afterCreate = await app.statCount('Apps tracked')

    await app.requestDelete(name)
    await app.confirmDelete()

    await expect(app.card(name)).toHaveCount(0, { timeout: 45_000 })
    await expect(app.statValue('Apps tracked')).toHaveText(
      String(afterCreate - 1)
    )
  })

  test('shared records increment the Shared stat', async ({ app }) => {
    const name = uniqueName('shared-stat')

    const sharedBefore = await app.statCount('Shared')

    await app.createApp({
      name,
      description: 'Shared with the team.',
      shared: true,
      sharedWith: 'team@contoso.com',
      coreDataSource: 'OneDrive',
    })

    await expect(app.statValue('Shared')).toHaveText(String(sharedBefore + 1))
    await expect(app.card(name).locator('.tag-shared')).toHaveText('Shared')

    await app.deleteIfPresent(name)
  })
})
