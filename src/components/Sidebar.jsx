import React, { useState } from 'react';
import { useStore } from '../store/index.js';

export default function Sidebar() {
  const { projects, activeProjectId, setActiveProject, closeProject, renameProject, newProject } = useStore();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const startRename = (proj) => {
    setEditingId(proj.id);
    setEditName(proj.name);
  };

  const commitRename = () => {
    if (editName.trim()) renameProject(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="w-48 flex flex-col border-r border-border shrink-0 overflow-hidden" style={{ background: '#0a0d14' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">Projects</span>
        <button
          onClick={newProject}
          className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-surface-3 transition-colors"
          title="New project"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.map(proj => (
          <ProjectItem
            key={proj.id}
            proj={proj}
            active={proj.id === activeProjectId}
            editing={editingId === proj.id}
            editName={editName}
            onSelect={() => setActiveProject(proj.id)}
            onStartRename={() => startRename(proj)}
            onEditName={setEditName}
            onCommitRename={commitRename}
            onClose={() => closeProject(proj.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted text-center">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </div>
      </div>
    </div>
  );
}

function ProjectItem({ proj, active, editing, editName, onSelect, onStartRename, onEditName, onCommitRename, onClose }) {
  return (
    <div
      className={`group flex items-center px-2 py-1.5 cursor-pointer transition-colors relative ${
        active ? 'bg-surface-3' : 'hover:bg-surface-2'
      }`}
      onClick={onSelect}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent-blue" />
      )}

      {/* Icon */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mr-1.5">
        <rect x="1" y="2" width="10" height="8" rx="1.5" stroke={active ? '#3b82f6' : '#4a5568'} strokeWidth="1.2"/>
        <path d="M3 5h6M3 7.5h4" stroke={active ? '#3b82f6' : '#4a5568'} strokeWidth="1" strokeLinecap="round"/>
      </svg>

      {/* Name */}
      {editing ? (
        <input
          autoFocus
          value={editName}
          onChange={e => onEditName(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={e => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCommitRename(); }}
          className="flex-1 text-xs bg-surface-4 border border-accent-blue rounded px-1 py-0.5 text-primary outline-none min-w-0"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          className={`flex-1 text-xs truncate ${active ? 'text-primary' : 'text-secondary'}`}
          onDoubleClick={(e) => { e.stopPropagation(); onStartRename(); }}
          title={proj.name}
        >
          {proj.name}
          {proj.dirty && <span className="text-accent-amber ml-0.5">•</span>}
        </span>
      )}

      {/* Close */}
      <button
        className="hidden group-hover:flex w-4 h-4 items-center justify-center rounded text-muted hover:text-rose-400 hover:bg-surface-4 ml-1 shrink-0 transition-colors"
        onClick={e => { e.stopPropagation(); onClose(); }}
        title="Close project"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
