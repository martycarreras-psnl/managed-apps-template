import { expect, test } from './support/fixtures'
import { uniqueName } from './support/data'

/**
 * Seeds three records with distinct data sources / statuses / shared states,
 * exercises every filter against them, then cleans up.
 */
test.describe('Search and filtering', () => {
  const dataverseApp = uniqueName('filter-dataverse')
  const teamsApp = uniqueName('filter-teams')
  const sharepointApp = uniqueName('filter-sharepoint')

  test.beforeEach(async ({ app }) => {
    await app.createApp({
      name: dataverseApp,
      description: 'Filter fixture backed by Dataverse.',
      coreDataSource: 'Dataverse',
      status: 'Deployed',
      shared: true,
      sharedWith: 'ops@contoso.com',
    })
    await app.createApp({
      name: teamsApp,
      description: 'Filter fixture backed by Teams.',
      coreDataSource: 'Teams',
      status: 'Draft',
      shared: false,
    })
    await app.createApp({
      name: sharepointApp,
      description: 'Filter fixture backed by SharePoint.',
      coreDataSource: 'SharePoint',
      status: 'Local dev',
      shared: false,
    })
  })

  test.afterEach(async ({ app }) => {
    await app.search.fill('')
    await app.deleteIfPresent(dataverseApp)
    await app.deleteIfPresent(teamsApp)
    await app.deleteIfPresent(sharepointApp)
  })

  test('search matches on name', async ({ app }) => {
    await app.search.fill(teamsApp)

    await expect(app.card(teamsApp)).toBeVisible()
    await expect(app.card(dataverseApp)).toHaveCount(0)
    await expect(app.card(sharepointApp)).toHaveCount(0)
  })

  test('search matches on description text', async ({ app }) => {
    await app.search.fill('backed by SharePoint')

    await expect(app.card(sharepointApp)).toBeVisible()
    await expect(app.card(teamsApp)).toHaveCount(0)
  })

  test('search is case-insensitive', async ({ app }) => {
    await app.search.fill('BACKED BY TEAMS')
    await expect(app.card(teamsApp)).toBeVisible()
  })

  test('search with no matches shows the empty state', async ({ app }) => {
    await app.search.fill('zzz-no-such-app-zzz')

    await expect(app.emptyState).toBeVisible()
    await expect(app.emptyState).toContainText('No matches')
    await expect(app.cards).toHaveCount(0)
  })

  test('filters by core data source', async ({ app }) => {
    await app.dataSourceFilter.selectOption({ label: 'Teams' })

    await expect(app.card(teamsApp)).toBeVisible()
    await expect(app.card(dataverseApp)).toHaveCount(0)
    await expect(app.card(sharepointApp)).toHaveCount(0)
  })

  test('filters by status', async ({ app }) => {
    await app.statusFilter.selectOption({ label: 'Local dev' })

    await expect(app.card(sharepointApp)).toBeVisible()
    await expect(app.card(dataverseApp)).toHaveCount(0)
  })

  test('filters by shared only', async ({ app }) => {
    await app.sharedFilter.selectOption({ label: 'Shared only' })

    await expect(app.card(dataverseApp)).toBeVisible()
    await expect(app.card(teamsApp)).toHaveCount(0)
    await expect(app.card(sharepointApp)).toHaveCount(0)
  })

  test('filters by private only', async ({ app }) => {
    await app.sharedFilter.selectOption({ label: 'Private only' })

    await expect(app.card(teamsApp)).toBeVisible()
    await expect(app.card(sharepointApp)).toBeVisible()
    await expect(app.card(dataverseApp)).toHaveCount(0)
  })

  test('combines search with a filter', async ({ app }) => {
    await app.search.fill('Filter fixture')
    await app.dataSourceFilter.selectOption({ label: 'SharePoint' })

    await expect(app.card(sharepointApp)).toBeVisible()
    await expect(app.cards).toHaveCount(1)
  })

  test('Clear resets every filter', async ({ app }) => {
    await app.search.fill('Filter fixture')
    await app.dataSourceFilter.selectOption({ label: 'Teams' })
    await app.sharedFilter.selectOption({ label: 'Private only' })

    await expect(app.clearFilters).toBeVisible()
    await app.clearFilters.click()

    await expect(app.search).toHaveValue('')
    await expect(app.dataSourceFilter).toHaveValue('all')
    await expect(app.sharedFilter).toHaveValue('all')
    await expect(app.card(dataverseApp)).toBeVisible()
    await expect(app.card(teamsApp)).toBeVisible()
    await expect(app.card(sharepointApp)).toBeVisible()
  })

  test('result count reflects the filtered subset', async ({ app }) => {
    const total = await app.statCount('Apps tracked')

    await app.dataSourceFilter.selectOption({ label: 'Teams' })

    const visible = await app.cards.count()
    await expect(app.resultCount).toHaveText(
      `Showing ${visible} of ${total}`
    )
  })

  test('summary breakdown lists the seeded data sources', async ({ app }) => {
    await expect(app.breakdownChip('Dataverse')).toBeVisible()
    await expect(app.breakdownChip('Teams')).toBeVisible()
    await expect(app.breakdownChip('SharePoint')).toBeVisible()
  })
})
