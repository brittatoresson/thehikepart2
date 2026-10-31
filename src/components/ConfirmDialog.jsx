// Bekräftelsedialog för borttagning, delad av admin- och musikvyn.
export default function ConfirmDialog({ message, confirmLabel = 'Ta bort', onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <p className="confirm-msg">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>Avbryt</button>
          <button className="confirm-delete" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
