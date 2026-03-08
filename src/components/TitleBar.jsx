import React, { useState } from 'react';
import { useStore } from '../store/index.js';
import { generatePostgresSQL } from '../utils/dbml.js';

const isElectron = typeof window !== 'undefined' && window.electronAPI;

export default function TitleBar() {
  const { projects, activeProjectId, newProject, openProject, markSaved, getActiveProject } = useStore();
  const [exportMenu, setExportMenu] = useState(false);
  const activeProject = getActiveProject();

  const handleNew = () => newProject();

  const handleOpen = async () => {
    if (!isElectron) return;
    const result = await window.electronAPI.openFile();
    if (result) openProject(result);
  };

  const handleSave = async () => {
    if (!activeProject) return;
    const content = JSON.stringify({
      __dbdraw: true,
      name: activeProject.name,
      dbml: activeProject.dbml,
      nodePositions: activeProject.nodePositions,
      nodeColors: activeProject.nodeColors,
      nodeCollapsed: activeProject.nodeCollapsed,
      notes: activeProject.notes,
      savedAt: new Date().toISOString(),
    }, null, 2);
    if (isElectron) {
      const path = await window.electronAPI.saveFile({ filePath: activeProject.filePath, content });
      if (path) markSaved(activeProject.id, path);
    } else {
      // Browser fallback: download
      const blob = new Blob([activeProject.dbml], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${activeProject.name}.dbml`;
      a.click();
    }
  };

  const handleExportSQL = async () => {
    if (!activeProject) return;
    const sql = generatePostgresSQL(activeProject.dbml);
    if (isElectron) {
      await window.electronAPI.saveSQL({ sql, defaultName: `${activeProject.name}.sql` });
    } else {
      const blob = new Blob([sql], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${activeProject.name}.sql`;
      a.click();
    }
    setExportMenu(false);
  };

  const handleExportPNG = () => {
    window.dispatchEvent(new CustomEvent('export-png'));
    setExportMenu(false);
  };

  const handleExportPDF = () => {
    window.dispatchEvent(new CustomEvent('export-pdf'));
    setExportMenu(false);
  };

  const dirtyCount = projects.filter(p => p.dirty).length;

  return (
    <div
      className="h-9 flex items-center px-4 gap-3 border-b border-border shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag', background: '#0a0d14' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2" style={{ WebkitAppRegion: 'no-drag' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="6" rx="1.5" fill="#3b82f6"/>
          <rect x="13" y="3" width="8" height="6" rx="1.5" fill="#06b6d4"/>
          <rect x="3" y="15" width="8" height="6" rx="1.5" fill="#8b5cf6"/>
          <rect x="13" y="15" width="8" height="6" rx="1.5" fill="#10b981"/>
          <line x1="7" y1="9" x2="7" y2="15" stroke="#3b4a6b" strokeWidth="1.5"/>
          <line x1="17" y1="9" x2="17" y2="15" stroke="#3b4a6b" strokeWidth="1.5"/>
          <line x1="7" y1="12" x2="17" y2="12" stroke="#3b4a6b" strokeWidth="1.5"/>
        </svg>
        <span className="text-xs font-semibold text-primary tracking-wide" style={{ fontFamily: 'Space Grotesk' }}>
          DBdraw
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <TBtn onClick={handleNew} title="New Project">
          <PlusIcon />
        </TBtn>
        {isElectron && (
          <TBtn onClick={handleOpen} title="Open File">
            <OpenIcon />
          </TBtn>
        )}
        <TBtn onClick={handleSave} title="Save (Ctrl+S)" highlight={activeProject?.dirty}>
          <SaveIcon />
          {activeProject?.dirty && <span className="w-1.5 h-1.5 rounded-full bg-accent-amber ml-1 animate-pulse-soft" />}
        </TBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Export */}
        <div className="relative">
          <TBtn onClick={() => setExportMenu(v => !v)} title="Export">
            <ExportIcon />
            <span className="ml-1 text-xs">Export</span>
            <ChevronIcon />
          </TBtn>
          {exportMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportMenu(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-surface-2 border border-border rounded-lg shadow-2xl overflow-hidden animate-fadeIn min-w-[140px]">
                <MenuItem onClick={handleExportSQL} icon="⚡">PostgreSQL SQL</MenuItem>
                <MenuItem onClick={handleExportPNG} icon="🖼">PNG Image</MenuItem>
                <MenuItem onClick={handleExportPDF} icon="📄">PDF</MenuItem>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Project name */}
      <div className="flex-1 flex justify-center" style={{ WebkitAppRegion: 'drag' }}>
        {activeProject && (
          <span className="text-xs text-secondary truncate max-w-xs">
            {activeProject.name}{activeProject.dirty ? ' •' : ''}
          </span>
        )}
      </div>

      {/* Right side hint */}
      <div className="text-xs text-muted" style={{ WebkitAppRegion: 'no-drag' }}>
        Ctrl+Z · Ctrl+Y
      </div>
    </div>
  );
}

function TBtn({ onClick, title, children, highlight }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center px-2 h-6 rounded text-xs gap-0.5 transition-colors ${
        highlight
          ? 'text-accent-amber hover:bg-surface-3'
          : 'text-secondary hover:text-primary hover:bg-surface-3'
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({ onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-secondary hover:text-primary hover:bg-surface-3 transition-colors"
    >
      <span>{icon}</span>
      {children}
    </button>
  );
}

// Icons
const PlusIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const OpenIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3.5h3L6 5h4.5v5.5h-9V3.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
const SaveIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="3.5" y="1.5" width="5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2"/><rect x="3" y="6.5" width="6" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/></svg>;
const ExportIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3.5 5.5L6 8l2.5-2.5M1.5 9v1.5h9V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronIcon = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
