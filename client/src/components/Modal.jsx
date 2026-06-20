import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Shared modal shell used across the app.
 *  - Click the backdrop (outside the card) to close.
 *  - Press Escape to close.
 *  - Close icon at the top-right.
 *  - Clicks inside the card never close it.
 *
 * Props:
 *  open      — controls visibility
 *  title     — header text
 *  onClose   — called on backdrop click, Escape, or X button
 *  onSave    — (optional) renders Save / Cancel footer
 *  saving    — (optional) disables save button and shows "Saving…"
 *  children  — modal body content
 *  wide      — (optional) wider panel (700px vs 480px)
 *  saveLabel — (optional) custom save button text
 */
export function Modal({ open, title, onClose, onSave, saving, children, wide, saveLabel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="glass-card w-full"
        style={{ maxWidth: wide ? 700 : 480, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — title + close icon */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font)' }}>
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 26, height: 26, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--glass)', border: '1px solid var(--p-line)',
              cursor: 'pointer', color: 'var(--t3)', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 space-y-3">{children}</div>

        {/* Footer (only when onSave is provided) */}
        {onSave && (
          <div className="px-5 pt-2 pb-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              style={{
                fontSize: 10, padding: '5px 12px', borderRadius: 8,
                background: 'var(--glass)', color: 'var(--t3)',
                border: '1px solid var(--p-line)', cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Cancel
            </button>
            <button
              className="f-btn"
              onClick={onSave}
              disabled={saving}
              style={{ fontSize: 11, padding: '5px 14px' }}
            >
              {saving ? 'Saving…' : (saveLabel ?? 'Save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
