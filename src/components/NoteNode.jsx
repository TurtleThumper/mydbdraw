import React, { useState } from 'react';
import { useStore } from '../store/index.js';

export default function NoteNode({ id, data, selected }) {
  const { updateNote, deleteNote } = useStore();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.text || '');

  const commit = () => {
    setEditing(false);
    updateNote(id, { text });
  };

  return (
    <div
      className="relative rounded-lg border shadow-lg"
      style={{
        background: '#2a1f00',
        borderColor: selected ? '#f59e0b' : '#3a2e00',
        minWidth: 160,
        maxWidth: 280,
        boxShadow: selected ? '0 0 0 2px rgba(245,158,11,0.3)' : '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5 border-b"
        style={{ borderColor: '#3a2e00', background: '#1f1700', borderRadius: '8px 8px 0 0' }}
      >
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="8" height="8" rx="1.5" fill="#f59e0b" fillOpacity="0.3"/>
            <path d="M3 3.5h4M3 5h4M3 6.5h2.5" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span className="text-xs text-amber-500 font-semibold" style={{ fontFamily: 'Space Grotesk' }}>Note</span>
        </div>
        <button
          className="w-4 h-4 flex items-center justify-center rounded text-muted hover:text-rose-400 transition-colors"
          onClick={() => deleteNote(id)}
          title="Delete note"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-2.5" onDoubleClick={() => setEditing(true)}>
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Escape') commit(); }}
            className="w-full bg-transparent text-xs text-amber-100 outline-none resize-none font-mono leading-relaxed"
            style={{ minHeight: 60, maxHeight: 200 }}
            rows={3}
          />
        ) : (
          <p className="text-xs text-amber-100/80 leading-relaxed font-mono whitespace-pre-wrap">
            {text || <span className="text-muted italic">Double-click to edit</span>}
          </p>
        )}
      </div>
    </div>
  );
}
