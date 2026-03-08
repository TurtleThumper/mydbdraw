import React, { useCallback, useEffect } from 'react';
import { useStore } from './store/index.js';
import TitleBar from './components/TitleBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import EditorPane from './components/EditorPane.jsx';
import CanvasPane from './components/CanvasPane.jsx';
import ResizeDivider from './components/ResizeDivider.jsx';

export default function App() {
  const { sidebarOpen, editorWidth, undo, redo, projects, activeProjectId } = useStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-0">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <div className="flex flex-1 overflow-hidden">
          <div style={{ width: editorWidth, minWidth: 200, maxWidth: 700, flexShrink: 0 }} className="flex flex-col overflow-hidden border-r border-border">
            <EditorPane project={activeProject} />
          </div>
          <ResizeDivider />
          <div className="flex-1 overflow-hidden">
            <CanvasPane project={activeProject} />
          </div>
        </div>
      </div>
    </div>
  );
}
