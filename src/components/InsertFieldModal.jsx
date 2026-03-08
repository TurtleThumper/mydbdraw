import React, { useEffect, useRef, useState } from 'react';

const COMMON_TYPES = [
  'serial', 'bigserial', 'integer', 'bigint', 'smallint', 'boolean',
  'varchar(255)', 'varchar(100)', 'varchar(50)', 'text', 'char(1)',
  'timestamp', 'date', 'time', 'uuid', 'jsonb', 'json',
  'numeric', 'decimal', 'float', 'real',
];

const COMMON_ATTRS = [
  { label: 'Not null', value: 'not null' },
  { label: 'Unique', value: 'unique' },
  { label: 'Primary key', value: 'pk' },
  { label: 'Auto increment', value: 'increment' },
];

export default function InsertFieldModal({ tableName, relativeFieldName, position, onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('varchar(255)');
  const [typeInput, setTypeInput] = useState('varchar(255)');
  const [showTypeSuggest, setShowTypeSuggest] = useState(false);
  const [attrs, setAttrs] = useState([]);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const filteredTypes = COMMON_TYPES.filter(t => t.startsWith(typeInput.toLowerCase()) && t !== typeInput);

  const toggleAttr = (val) => {
    setAttrs(prev => prev.includes(val) ? prev.filter(a => a !== val) : [...prev, val]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onConfirm({
      name: name.trim().replace(/\s+/g, '_'),
      type: typeInput.trim() || 'varchar(255)',
      attrs: attrs.join(', '),
    });
  };

  const posLabel = position === 'above' ? `above "${relativeFieldName}"` : `below "${relativeFieldName}"`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-xl border border-border shadow-2xl animate-fadeIn p-5 w-80"
        style={{ background: '#161b27', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: 'Space Grotesk' }}>
            Insert field
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Into <span className="text-accent-blue font-mono">{tableName}</span> · {posLabel}
          </p>
        </div>

        {/* Field name */}
        <div className="mb-3">
          <label className="text-xs text-muted mb-1 block">Field name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
            placeholder="field_name"
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-primary font-mono outline-none focus:border-accent-blue transition-colors"
            spellCheck={false}
          />
        </div>

        {/* Field type */}
        <div className="mb-3 relative">
          <label className="text-xs text-muted mb-1 block">Type</label>
          <input
            type="text"
            value={typeInput}
            onChange={e => { setTypeInput(e.target.value); setShowTypeSuggest(true); }}
            onFocus={() => setShowTypeSuggest(true)}
            onBlur={() => setTimeout(() => setShowTypeSuggest(false), 120)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
            placeholder="varchar(255)"
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-cyan-400 font-mono outline-none focus:border-accent-blue transition-colors"
            spellCheck={false}
          />
          {showTypeSuggest && filteredTypes.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto">
              {filteredTypes.map(t => (
                <button
                  key={t}
                  className="w-full text-left px-3 py-1.5 text-xs font-mono text-cyan-400 hover:bg-surface-3 transition-colors"
                  onMouseDown={() => { setTypeInput(t); setShowTypeSuggest(false); }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attributes */}
        <div className="mb-4">
          <label className="text-xs text-muted mb-1.5 block">Attributes</label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_ATTRS.map(a => (
              <button
                key={a.value}
                onClick={() => toggleAttr(a.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors border ${
                  attrs.includes(a.value)
                    ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                    : 'bg-surface-3 border-border text-muted hover:text-secondary hover:border-subtle'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {name && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-surface-0 border border-border">
            <p className="text-xs font-mono text-muted">Preview:</p>
            <p className="text-xs font-mono text-primary mt-0.5">
              <span className="text-primary">{name || 'field_name'}</span>{' '}
              <span className="text-cyan-400">{typeInput || 'varchar(255)'}</span>
              {attrs.length > 0 && <span className="text-violet-400"> [{attrs.join(', ')}]</span>}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-3 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs bg-accent-blue text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Insert field
          </button>
        </div>
      </div>
    </div>
  );
}
