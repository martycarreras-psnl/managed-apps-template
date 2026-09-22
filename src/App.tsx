import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  createApp,
  deleteApp,
  listApps,
  updateApp,
  type InventoryDraft,
  type InventoryRecord,
} from './inventory/api'
import { DATA_SOURCE_OPTIONS, STATUS_OPTIONS } from './inventory/options'
import { SummaryHeader } from './inventory/SummaryHeader'
import { AppCard } from './inventory/AppCard'
import { AppFormModal } from './inventory/AppFormModal'
import { ConfirmDialog } from './inventory/ConfirmDialog'

type SharedFilter = 'all' | 'shared' | 'private'

function App() {
  const [records, setRecords] = useState<InventoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<InventoryRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRecords(await listApps())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return records.filter((record) => {
      if (sourceFilter !== 'all') {
        if (record.cr922_coredatasource?.toString() !== sourceFilter) return false
      }
      if (statusFilter !== 'all') {
        if (record.cr922_status?.toString() !== statusFilter) return false
      }
      if (sharedFilter === 'shared' && !record.cr922_shared) return false
      if (sharedFilter === 'private' && record.cr922_shared) return false

      if (!needle) return true
      return [
        record.cr922_appname,
        record.cr922_description,
        record.cr922_valueprovided,
        record.cr922_sharedwith,
        record.cr922_environment,
        record.cr922_notes,
      ]
        .filter((field): field is string => Boolean(field))
        .some((field) => field.toLowerCase().includes(needle))
    })
  }, [records, search, sourceFilter, statusFilter, sharedFilter])

  const filtersActive =
    search.trim() !== '' ||
    sourceFilter !== 'all' ||
    statusFilter !== 'all' ||
    sharedFilter !== 'all'

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(record: InventoryRecord) {
    setEditing(record)
    setFormOpen(true)
  }

  async function handleSave(draft: InventoryDraft) {
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await updateApp(editing.cr922_managedappinventoryid, draft)
      } else {
        await createApp(draft)
      }
      setFormOpen(false)
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteApp(pendingDelete.cr922_managedappinventoryid)
      setPendingDelete(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setSourceFilter('all')
    setStatusFilter('all')
    setSharedFilter('all')
  }

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Microsoft Apps</p>
          <h1>Managed Apps Inventory</h1>
          <p className="subtitle">
            Every app you've built with the Managed Apps CLI — what it does, the
            value it delivers, and who it's shared with.
          </p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>
          + Add app
        </button>
      </header>

      <SummaryHeader records={records} />

      <section className="toolbar">
        <input
          className="search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, description, value, notes…"
        />

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">All data sources</option>
          {DATA_SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Any status</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={sharedFilter}
          onChange={(e) => setSharedFilter(e.target.value as SharedFilter)}
        >
          <option value="all">Shared &amp; private</option>
          <option value="shared">Shared only</option>
          <option value="private">Private only</option>
        </select>

        {filtersActive && (
          <button type="button" className="ghost" onClick={clearFilters}>
            Clear
          </button>
        )}
      </section>

      {error && (
        <div className="banner error">
          <span>{error}</span>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="state">Loading your inventory…</p>
      ) : visible.length === 0 ? (
        <div className="state empty">
          <h2>{records.length === 0 ? 'Nothing tracked yet' : 'No matches'}</h2>
          <p>
            {records.length === 0
              ? 'Add your first Managed App to start building the inventory.'
              : 'No apps match the current filters.'}
          </p>
          {records.length === 0 ? (
            <button type="button" className="primary" onClick={openCreate}>
              + Add app
            </button>
          ) : (
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="result-count">
            Showing {visible.length} of {records.length}
          </p>
          <section className="grid">
            {visible.map((record) => (
              <AppCard
                key={record.cr922_managedappinventoryid}
                record={record}
                onEdit={openEdit}
                onDelete={setPendingDelete}
              />
            ))}
          </section>
        </>
      )}

      {formOpen && (
        <AppFormModal
          record={editing}
          saving={saving}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSave={(draft) => void handleSave(draft)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete app?"
          message={`"${pendingDelete.cr922_appname || 'Untitled app'}" will be permanently removed from the inventory.`}
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  )
}

export default App
