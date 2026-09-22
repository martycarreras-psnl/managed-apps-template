import { expect, test } from './support/fixtures'
import { uniqueName } from './support/data'

test.describe('Form validation', () => {
  test('blocks submit when App name is empty', async ({ app }) => {
    await app.openCreateForm()
    await app.fillForm({ name: '', description: 'Has a description.' })
    await app.submitForm()

    await expect(app.formError).toHaveText('App name is required.')
    await expect(app.modal).toBeVisible()

    await app.cancelForm()
  })

  test('blocks submit when Description is empty', async ({ app }) => {
    await app.openCreateForm()
    await app.fillForm({ name: uniqueName('no-description'), description: '' })
    await app.submitForm()

    await expect(app.formError).toHaveText('Description is required.')
    await expect(app.modal).toBeVisible()

    await app.cancelForm()
  })

  test('treats whitespace-only values as empty', async ({ app }) => {
    await app.openCreateForm()
    await app.fillForm({ name: '   ', description: '   ' })
    await app.submitForm()

    await expect(app.formError).toHaveText('App name is required.')

    await app.cancelForm()
  })

  test('marks App name and Description as required in the UI', async ({
    app,
  }) => {
    await app.openCreateForm()

    await expect(
      app.modal.locator('label', { hasText: 'App name' }).locator('.required')
    ).toBeVisible()
    await expect(
      app.modal.locator('label', { hasText: 'Description' }).locator('.required')
    ).toBeVisible()

    await app.cancelForm()
  })

  test('reveals Shared with only when Shared is checked', async ({ app }) => {
    await app.openCreateForm()

    const sharedWith = app.modal
      .locator('label', { hasText: 'Shared with' })
      .locator('input')

    await expect(sharedWith).toHaveCount(0)

    await app.modal.locator('.checkbox input').setChecked(true)
    await expect(sharedWith).toBeVisible()

    await app.modal.locator('.checkbox input').setChecked(false)
    await expect(sharedWith).toHaveCount(0)

    await app.cancelForm()
  })

  test('cancelling the form discards input', async ({ app }) => {
    const name = uniqueName('discarded')

    await app.openCreateForm()
    await app.fillForm({ name, description: 'Should never be saved.' })
    await app.cancelForm()

    await expect(app.modal).toBeHidden()
    await expect(app.card(name)).toHaveCount(0)
  })

  test('edit form pre-populates existing values', async ({ app }) => {
    const name = uniqueName('prefill')

    await app.createApp({
      name,
      description: 'Prefill check.',
      coreDataSource: 'Azure DevOps',
      status: 'Deployed',
      environment: 'contoso-dev',
    })

    await app.openEditForm(name)

    await expect(
      app.modal.locator('label', { hasText: 'App name' }).locator('input')
    ).toHaveValue(name)
    await expect(
      app.modal.locator('label', { hasText: 'Description' }).locator('textarea')
    ).toHaveValue('Prefill check.')
    await expect(
      app.modal.locator('label', { hasText: 'Environment' }).locator('input')
    ).toHaveValue('contoso-dev')

    await app.cancelForm()
    await app.deleteIfPresent(name)
  })
})
