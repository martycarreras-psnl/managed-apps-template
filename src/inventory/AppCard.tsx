import type { InventoryRecord } from './api'
import {
  STATUS_TONE,
  dataSourceLabel,
  statusLabel,
  type StatusValue,
} from './options'

type Props = {
  record: InventoryRecord
  onEdit: (record: InventoryRecord) => void
  onDelete: (record: InventoryRecord) => void
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? undefined
    : parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}

export function AppCard({ record, onEdit, onDelete }: Props) {
  const status = record.cr922_status as StatusValue | undefined
  const tone = status !== undefined ? STATUS_TONE[status] : 'unknown'
  const created = formatDate(record.createdon)

  return (
    <article className="card">
      <header className="card-head">
        <div>
          <h3>{record.cr922_appname || 'Untitled app'}</h3>
          <div className="card-tags">
            <span className={`tag tone-${tone}`}>{statusLabel(status)}</span>
            <span className="tag tag-source">
              {dataSourceLabel(record.cr922_coredatasource)}
            </span>
            <span className={record.cr922_shared ? 'tag tag-shared' : 'tag tag-private'}>
              {record.cr922_shared ? 'Shared' : 'Private'}
            </span>
          </div>
        </div>
        <div className="card-actions">
          <button type="button" onClick={() => onEdit(record)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => onDelete(record)}
          >
            Delete
          </button>
        </div>
      </header>

      {record.cr922_description && (
        <p className="card-text">{record.cr922_description}</p>
      )}

      {record.cr922_valueprovided && (
        <div className="card-block">
          <h4>Value provided</h4>
          <p>{record.cr922_valueprovided}</p>
        </div>
      )}

      {record.cr922_shared && record.cr922_sharedwith && (
        <div className="card-block">
          <h4>Shared with</h4>
          <p>{record.cr922_sharedwith}</p>
        </div>
      )}

      {record.cr922_notes && (
        <div className="card-block">
          <h4>Notes</h4>
          <p>{record.cr922_notes}</p>
        </div>
      )}

      <footer className="card-meta">
        {record.cr922_environment && (
          <span>
            <strong>Env</strong> {record.cr922_environment}
          </span>
        )}
        {record.cr922_appguid && (
          <span className="mono">
            <strong>GUID</strong> {record.cr922_appguid}
          </span>
        )}
        {created && (
          <span>
            <strong>Added</strong> {created}
          </span>
        )}
      </footer>
    </article>
  )
}
