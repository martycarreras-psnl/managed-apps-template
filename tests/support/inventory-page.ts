import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test'

export type AppInput = {
  name: string
  description?: string
  valueProvided?: string
  shared?: boolean
  sharedWith?: string
  coreDataSource?: string
  status?: string
  appGuid?: string
  environment?: string
  notes?: string
}

/**
 * Page object for the Managed Apps Inventory UI as hosted inside the App
 * Player iframe. All locators are scoped to that frame.
 */
export class InventoryPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** The app iframe inside the App Player shell. */
  get frame(): FrameLocator {
    return this.page.frameLocator('iframe').first()
  }

  // ----- readiness -------------------------------------------------------

  async waitForReady(): Promise<void> {
    await this.frame
      .getByRole('heading', { name: 'Managed Apps Inventory' })
      .waitFor({ timeout: 120_000 })
    // The list does its first Dataverse read on mount.
    await this.frame
      .getByText('Loading your inventory…')
      .waitFor({ state: 'hidden', timeout: 60_000 })
      .catch(() => {
        /* fast loads never show the spinner */
      })
  }

  // ----- summary ---------------------------------------------------------

  statValue(label: 'Apps tracked' | 'Shared' | 'Private'): Locator {
    return this.frame
      .locator('.stat', { hasText: label })
      .locator('.stat-value')
  }

  async statCount(
    label: 'Apps tracked' | 'Shared' | 'Private'
  ): Promise<number> {
    return Number((await this.statValue(label).innerText()).trim())
  }

  breakdownChip(source: string): Locator {
    return this.frame.locator('.summary-breakdown li', { hasText: source })
  }

  // ----- list ------------------------------------------------------------

  get cards(): Locator {
    return this.frame.locator('.card')
  }

  card(name: string): Locator {
    return this.frame.locator('.card').filter({
      has: this.frame.getByRole('heading', { name, exact: true }),
    })
  }

  get resultCount(): Locator {
    return this.frame.locator('.result-count')
  }

  get emptyState(): Locator {
    return this.frame.locator('.state.empty')
  }

  get errorBanner(): Locator {
    return this.frame.locator('.banner.error')
  }

  // ----- filters ---------------------------------------------------------

  get search(): Locator {
    return this.frame.locator('input.search')
  }

  private get toolbarSelects(): Locator {
    return this.frame.locator('.toolbar select')
  }

  get dataSourceFilter(): Locator {
    return this.toolbarSelects.nth(0)
  }

  get statusFilter(): Locator {
    return this.toolbarSelects.nth(1)
  }

  get sharedFilter(): Locator {
    return this.toolbarSelects.nth(2)
  }

  get clearFilters(): Locator {
    return this.frame.getByRole('button', { name: 'Clear', exact: true })
  }

  // ----- form ------------------------------------------------------------

  get modal(): Locator {
    return this.frame.locator('.modal')
  }

  get formError(): Locator {
    return this.frame.locator('.form-error')
  }

  async openCreateForm(): Promise<void> {
    await this.frame.getByRole('button', { name: '+ Add app' }).first().click()
    await expect(this.modal).toBeVisible()
  }

  async openEditForm(name: string): Promise<void> {
    await this.card(name).getByRole('button', { name: 'Edit' }).click()
    await expect(this.modal).toBeVisible()
  }

  /** Fills the create/edit form without submitting. */
  async fillForm(input: AppInput): Promise<void> {
    const m = this.modal

    await m.locator('label', { hasText: 'App name' }).locator('input').fill(input.name)

    if (input.description !== undefined) {
      await m
        .locator('label', { hasText: 'Description' })
        .locator('textarea')
        .fill(input.description)
    }

    if (input.valueProvided !== undefined) {
      await m
        .locator('label', { hasText: 'Value provided' })
        .locator('textarea')
        .fill(input.valueProvided)
    }

    if (input.coreDataSource !== undefined) {
      await m
        .locator('label', { hasText: 'Core data source' })
        .locator('select')
        .selectOption({ label: input.coreDataSource })
    }

    if (input.status !== undefined) {
      await m
        .locator('label', { hasText: 'Status' })
        .locator('select')
        .selectOption({ label: input.status })
    }

    if (input.shared !== undefined) {
      const checkbox = m.locator('.checkbox input')
      if ((await checkbox.isChecked()) !== input.shared) {
        await checkbox.setChecked(input.shared)
      }
    }

    if (input.sharedWith !== undefined) {
      await m
        .locator('label', { hasText: 'Shared with' })
        .locator('input')
        .fill(input.sharedWith)
    }

    if (input.appGuid !== undefined) {
      await m.locator('label', { hasText: 'App GUID' }).locator('input').fill(input.appGuid)
    }

    if (input.environment !== undefined) {
      await m
        .locator('label', { hasText: 'Environment' })
        .locator('input')
        .fill(input.environment)
    }

    if (input.notes !== undefined) {
      await m.locator('label', { hasText: 'Notes' }).locator('textarea').fill(input.notes)
    }
  }

  async submitForm(): Promise<void> {
    await this.modal
      .getByRole('button', { name: /Add app|Save changes/ })
      .click()
  }

  async cancelForm(): Promise<void> {
    await this.modal.getByRole('button', { name: 'Cancel' }).click()
  }

  /** Create + wait for the record to appear in the list. */
  async createApp(input: AppInput): Promise<void> {
    await this.openCreateForm()
    await this.fillForm(input)
    await this.submitForm()
    await expect(this.modal).toBeHidden({ timeout: 45_000 })
    await expect(this.card(input.name)).toBeVisible({ timeout: 45_000 })
  }

  // ----- delete ----------------------------------------------------------

  async requestDelete(name: string): Promise<void> {
    await this.card(name).getByRole('button', { name: 'Delete' }).click()
    await expect(this.frame.locator('.modal-sm')).toBeVisible()
  }

  async confirmDelete(): Promise<void> {
    await this.frame
      .locator('.modal-sm')
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(this.frame.locator('.modal-sm')).toBeHidden({ timeout: 45_000 })
  }

  async cancelDelete(): Promise<void> {
    await this.frame
      .locator('.modal-sm')
      .getByRole('button', { name: 'Cancel' })
      .click()
    await expect(this.frame.locator('.modal-sm')).toBeHidden()
  }

  /** Best-effort teardown helper — never fails the test. */
  async deleteIfPresent(name: string): Promise<void> {
    try {
      if (await this.card(name).isVisible()) {
        await this.requestDelete(name)
        await this.confirmDelete()
      }
    } catch {
      /* already gone */
    }
  }
}
