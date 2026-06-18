import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

/**
 * CustomSelect — universal themed dropdown component.
 *
 * All colours reference the Forest Finance CSS custom properties
 * declared in index.css (:root) so the component stays in sync
 * with the global design system automatically.
 *
 * Props
 * ─────
 * value       – currently-selected option value
 * onChange    – callback with the new value string
 * options     – array of { value, label }
 * placeholder – text shown when nothing is selected
 * fullWidth   – stretches to fill parent
 * compact     – slightly smaller padding
 * searchable  – shows a search input inside the dropdown
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = '— Select —',
  fullWidth = false,
  compact = false,
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, bottom: 0, left: 0, width: 0, above: false });

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const filtered =
    searchable && query.trim()
      ? options.filter((o) => (o.label ?? '').toLowerCase().includes(query.toLowerCase()))
      : options;

  /* ── Open handler: measure trigger → position the portal menu ── */
  const openMenu = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const searchH = searchable ? 44 : 0;
    const menuH = Math.min(filtered.length * 36 + searchH + 8, 280);
    const spaceBelow = window.innerHeight - r.bottom;
    const above = spaceBelow < menuH + 8 && r.top > menuH + 8;
    setMenuPos({ top: r.bottom + 4, bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, above });
    setQuery('');
    setOpen(true);
  };

  /* ── Auto-focus search after render ── */
  useEffect(() => {
    if (open && searchable) {
      const t = setTimeout(() => searchRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, searchable]);

  /* ── Close on outside click / scroll ── */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('touchstart', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('touchstart', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <div
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
        flex: fullWidth ? 1 : undefined,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          width: '100%',
          background: 'var(--color-surface)',
          border: `1px solid ${open ? 'var(--color-brand)' : 'var(--color-border)'}`,
          borderRadius: 8,
          padding: compact ? '5px 28px 5px 10px' : '7px 30px 7px 12px',
          fontSize: compact ? 11 : 12,
          color: selectedLabel != null ? 'var(--color-text-heading)' : 'var(--color-text-muted)',
          fontFamily: "'Outfit', sans-serif",
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          outline: 'none',
          boxShadow: open
            ? '0 0 0 3px rgba(26, 122, 74, 0.15)'
            : '0 1px 2px rgba(15, 31, 23, 0.06)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 600,
          }}
        >
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: 'var(--color-text-muted)',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {/* ── Dropdown portal ── */}
      {open &&
        createPortal(
          <>
            {/* invisible backdrop to catch stray clicks */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
              onMouseDown={() => setOpen(false)}
            />

            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                ...(menuPos.above ? { bottom: menuPos.bottom } : { top: menuPos.top }),
                left: menuPos.left,
                width: menuPos.width,
                minWidth: 180,
                zIndex: 9999,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(26,48,40,0.08), 0 2px 6px rgba(26,48,40,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 280,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* ── Search input inside dropdown ── */}
              {searchable && (
                <div
                  style={{
                    padding: '8px 10px 6px',
                    borderBottom: '1px solid var(--color-border-light)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--color-surface)',
                  }}
                >
                  <Search size={12} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 12,
                      color: 'var(--color-text-heading)',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  />
                </div>
              )}

              {/* ── Option list ── */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filtered.length === 0 ? (
                  <p
                    style={{
                      padding: '10px 14px',
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      fontFamily: "'Outfit', sans-serif",
                      margin: 0,
                    }}
                  >
                    {query ? 'No matches' : 'No options'}
                  </p>
                ) : (
                  filtered.map((o) => {
                    const isActive = o.value === value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'var(--color-border-light)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 14px',
                          background: isActive ? 'var(--color-border-light)' : 'transparent',
                          color: isActive ? 'var(--color-brand)' : 'var(--color-text-body)',
                          fontSize: 12,
                          fontWeight: isActive ? 600 : 400,
                          fontFamily: "'Outfit', sans-serif",
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          lineHeight: 1.4,
                          borderLeft: isActive ? '3px solid var(--color-brand)' : '3px solid transparent',
                          transition: 'background 0.12s, color 0.12s',
                        }}
                      >
                        {o.label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
