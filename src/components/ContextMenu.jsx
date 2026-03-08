import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * ContextMenu — renders at screen coordinates (x, y), never overflows viewport.
 *
 * Strategy: render off-screen first (opacity 0), measure actual dimensions,
 * then snap into the correct quadrant relative to the cursor. This guarantees
 * the menu is always fully visible regardless of zoom level or scroll.
 */
export default function ContextMenu({ x, y, onClose, sections = [] }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999, visible: false });

  // After first paint, measure the menu and compute the correct position
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const { width, height } = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // Default: open right-down from cursor
    let left = x;
    let top = y;

    // Flip left if would overflow right edge
    if (left + width + margin > vw) left = x - width;
    // Flip up if would overflow bottom edge
    if (top + height + margin > vh) top = y - height;

    // Final clamp — never go off left or top edge
    left = Math.max(margin, left);
    top = Math.max(margin, top);

    setPos({ left, top, visible: true });
  }, [x, y]);

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    // Use capture so we beat ReactFlow's handlers
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onClick, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999]"
      style={{
        left: pos.left,
        top: pos.top,
        opacity: pos.visible ? 1 : 0,
        pointerEvents: pos.visible ? 'auto' : 'none',
        transition: pos.visible ? 'opacity 0.08s ease' : 'none',
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        className="rounded-xl overflow-hidden shadow-2xl border border-border min-w-[190px]"
        style={{
          background: '#161b27',
          boxShadow: '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {sections.map((section, si) => (
          <div key={si}>
            {si > 0 && <div className="border-t border-border/60 my-0.5" />}
            {section.map((item, ii) => {
              if (item.separator) {
                return <div key={ii} className="border-t border-border/60 my-0.5" />;
              }
              return (
                <button
                  key={ii}
                  disabled={item.disabled}
                  onMouseDown={e => {
                    // Use mousedown so the menu closes before the click propagates
                    e.stopPropagation();
                    if (!item.disabled) {
                      item.onClick?.();
                      onClose();
                    }
                  }}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors
                    ${item.disabled
                      ? 'text-muted cursor-not-allowed opacity-40'
                      : item.danger
                        ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 cursor-pointer'
                        : 'text-secondary hover:text-primary hover:bg-surface-3 cursor-pointer'
                    }
                  `}
                >
                  {item.icon && (
                    <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-70">
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1 text-left leading-snug">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-muted text-[10px] font-mono ml-3 shrink-0">{item.shortcut}</span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] bg-surface-4 text-muted px-1.5 py-0.5 rounded-full font-mono ml-2 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
