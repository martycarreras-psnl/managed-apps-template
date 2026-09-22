import type { InventoryRecord } from './api'
import { dataSourceLabel } from './options'

type Props = {
  records: InventoryRecord[]
}

export function SummaryHeader({ records }: Props) {
  const total = records.length
  const shared = records.filter((r) => r.cr922_shared).length

  const bySource = new Map<string, number>()
  for (const record of records) {
    const label = dataSourceLabel(record.cr922_coredatasource)
    bySource.set(label, (bySource.get(label) ?? 0) + 1)
  }
  const breakdown = [...bySource.entries()].sort((a, b) => b[1] - a[1])

  return (
    <section className="summary">
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{total}</span>
          <span className="stat-label">Apps tracked</span>
        </div>
        <div className="stat">
          <span className="stat-value">{shared}</span>
          <span className="stat-label">Shared</span>
        </div>
        <div className="stat">
          <span className="stat-value">{total - shared}</span>
          <span className="stat-label">Private</span>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="summary-breakdown">
          <h2>By core data source</h2>
          <ul>
            {breakdown.map(([label, count]) => (
              <li key={label}>
                <span className="chip-label">{label}</span>
                <span className="chip-count">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
