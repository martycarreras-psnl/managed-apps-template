import { useEffect, useState } from 'react'
import type { InventoryDraft, InventoryRecord } from './api'
import {
  DATA_SOURCE_OPTIONS,
  STATUS_OPTIONS,
  type CoreDataSourceValue,
  type StatusValue,
} from './options'

type Props = {
  record: InventoryRecord | null
  saving: boolean
  onCancel: () => void
  onSave: (draft: InventoryDraft) => void
}

type FormState = {
  appName: string
  description: string
  valueProvided: string
  shared: boolean
  sharedWith: string
  coreDataSource: string
  status: string
  appGuid: string
  environment: string
  notes: string
}

function toFormState(record: InventoryRecord | null): FormState {
  return {
    appName: record?.cr922_appname ?? '',
    description: record?.cr922_description ?? '',
    valueProvided: record?.cr922_valueprovided ?? '',
    shared: record?.cr922_shared ?? false,
    sharedWith: record?.cr922_sharedwith ?? '',
    coreDataSource: record?.cr922_coredatasource?.toString() ?? '',
    status: record?.cr922_status?.toString() ?? '',
    appGuid: record?.cr922_appguid ?? '',
    environment: record?.cr922_environment ?? '',
    notes: record?.cr922_notes ?? '',
  }
}

export function AppFormModal({ record, saving, onCancel, onSave }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(record))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(toFormState(record))
    setError(null)
  }, [record])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.appName.trim()) {
      setError('App name is required.')
      return
    }
    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }

    onSave({
      cr922_appname: form.appName.trim(),
      cr922_description: form.description.trim(),
      cr922_valueprovided: form.valueProvided.trim() || undefined,
      cr922_shared: form.shared,
      cr922_sharedwith: form.shared
        ? form.sharedWith.trim() || undefined
        : undefined,
      cr922_coredatasource: form.coreDataSource
        ? (Number(form.coreDataSource) as CoreDataSourceValue)
        : undefined,
      cr922_status: form.status
        ? (Number(form.status) as StatusValue)
        : undefined,
      cr922_appguid: form.appGuid.trim() || undefined,
      cr922_environment: form.environment.trim() || undefined,
      cr922_notes: form.notes.trim() || undefined,
    })
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-head">
          <h2>{record ? 'Edit app' : 'Add app'}</h2>
          <button type="button" className="icon-button" onClick={onCancel}>
            ✕
          </button>
        </header>

        <form className="modal-body" onSubmit={handleSubmit}>
          <label>
            App name <span className="required">*</span>
            <input
              value={form.appName}
              onChange={(e) => update('appName', e.target.value)}
              placeholder="Managed Apps Inventory"
              autoFocus
            />
          </label>

          <label>
            Description <span className="required">*</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What is this app?"
            />
          </label>

          <label>
            Value provided
            <textarea
              rows={3}
              value={form.valueProvided}
              onChange={(e) => update('valueProvided', e.target.value)}
              placeholder="What problem does it solve?"
            />
          </label>

          <div className="field-row">
            <label>
              Core data source
              <select
                value={form.coreDataSource}
                onChange={(e) => update('coreDataSource', e.target.value)}
              >
                <option value="">— none selected —</option>
                {DATA_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
              >
                <option value="">— none selected —</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.shared}
              onChange={(e) => update('shared', e.target.checked)}
            />
            I have shared this app
          </label>

          {form.shared && (
            <label>
              Shared with
              <input
                value={form.sharedWith}
                onChange={(e) => update('sharedWith', e.target.value)}
                placeholder="alice@contoso.com, Finance team"
              />
            </label>
          )}

          <div className="field-row">
            <label>
              App GUID
              <input
                value={form.appGuid}
                onChange={(e) => update('appGuid', e.target.value)}
                placeholder="d1985433-…"
              />
            </label>

            <label>
              Environment
              <input
                value={form.environment}
                onChange={(e) => update('environment', e.target.value)}
                placeholder="contoso-dev"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Anything else worth remembering"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <footer className="modal-foot">
            <button type="button" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : record ? 'Save changes' : 'Add app'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
