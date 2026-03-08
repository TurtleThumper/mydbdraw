import React, { useEffect, useRef } from 'react';

/**
 * Generic context menu. Renders at (x, y) and closes on outside click or Escape.
 * 
 * Props:
 *   x, y       – screen coordinates
 *   onClose    – called when menu should close
 *   sections   – array of section arrays, each section is array of item objects:
 *     { label, icon, shortcut, onClick, danger, disabled, separator }
 */
export default function ContextMenu({ x, y, onClose, sections = [] }) {
  const menuRef = useRef(null);

  // Adjust position so menu never overflows viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 50);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Recalculate after render to avoid bottom overflow
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
    if (rect.right > window.innerWidth - 8) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] animate-fadeIn"
      style={{ left: adjustedX, top: adjustedY }}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        className="rounded-xl overflow-hidden shadow-2xl border border-border min-w-[180px]"
        style={{ background: '#161b27', boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}
      >
        {sections.map((section, si) => (
          <div key={si}>
            {si > 0 && <div className="border-t border-border/60 my-0.5" />}
            {section.map((item, ii) => {
              if (item.separator) return <div key={ii} className="border-t border-border/60 my-0.5" />;
              return (
                <button
                  key={ii}
                  disabled={item.disabled}
                  onClick={() => { if (!item.disabled) { item.onClick?.(); onClose(); } }}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors
                    ${item.disabled
                      ? 'text-muted cursor-not-allowed opacity-50'
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
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-muted text-[10px] font-mono ml-2">{item.shortcut}</span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] bg-surface-4 text-muted px-1.5 py-0.5 rounded-full font-mono">
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
