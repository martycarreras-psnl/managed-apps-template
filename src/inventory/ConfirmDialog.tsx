type Props = {
  title: string
  message: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  message,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-sm">
        <header className="modal-head">
          <h2>{title}</h2>
        </header>
        <div className="modal-body">
          <p>{message}</p>
          <footer className="modal-foot">
            <button type="button" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="danger-solid"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}
