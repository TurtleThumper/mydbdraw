import React, { useEffect, useRef, useState } from 'react';

export default function RenameModal({ title, initialValue, onConfirm, onCancel }) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    if (value.trim()) onConfirm(value.trim());
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onCancel}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative rounded-xl border border-border shadow-2xl animate-fadeIn p-5 w-72"
        style={{ background: '#161b27', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-primary mb-1" style={{ fontFamily: 'Space Grotesk' }}>
          {title || 'Rename'}
        </h3>
        <p className="text-xs text-muted mb-3">
          All references in your DBML will be updated automatically.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onCancel();
          }}
          className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-primary font-mono outline-none focus:border-accent-blue transition-colors mb-4"
          placeholder="table_name"
          spellCheck={false}
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || value.trim() === initialValue}
            className="px-3 py-1.5 text-xs bg-accent-blue text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
