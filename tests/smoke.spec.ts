import { expect, test } from './support/fixtures'

test.describe('Smoke', () => {
  test('app loads inside the App Player and reaches a data-backed state', async ({
    app,
  }) => {
    await expect(
      app.frame.getByRole('heading', { name: 'Managed Apps Inventory' })
    ).toBeVisible()

    // A Dataverse read failure surfaces as the error banner.
    await expect(app.errorBanner).toHaveCount(0)

    // Either the list rendered or the empty state did — both are valid.
    const hasCards = (await app.cards.count()) > 0
    if (hasCards) {
      await expect(app.resultCount).toBeVisible()
    } else {
      await expect(app.emptyState).toBeVisible()
    }
  })

  test('summary header reports totals consistent with the list', async ({
    app,
  }) => {
    const total = await app.statCount('Apps tracked')
    const shared = await app.statCount('Shared')
    const priv = await app.statCount('Private')

    expect(shared + priv).toBe(total)

    // With no filters applied, the rendered cards equal the tracked total.
    await expect(app.cards).toHaveCount(total)
  })

  test('toolbar exposes search and all three filters', async ({ app }) => {
    await expect(app.search).toBeVisible()
    await expect(app.dataSourceFilter).toBeVisible()
    await expect(app.statusFilter).toBeVisible()
    await expect(app.sharedFilter).toBeVisible()
  })
})
