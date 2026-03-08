import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useStore } from '../store/index.js';
import { parseDBMLSync } from '../utils/dbml.js';
import { buildNodesAndEdges, autoLayout } from '../utils/layout.js';
import TableNode from './TableNode.jsx';
import NoteNode from './NoteNode.jsx';

const nodeTypes = { tableNode: TableNode, noteNode: NoteNode };

export default function CanvasPane({ project }) {
  const { setNodePosition, addNote } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const flowRef = useRef(null);
  const containerRef = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);
  const prevDbml = useRef(null);

  // Re-parse when DBML changes
  useEffect(() => {
    if (!project) return;
    if (project.dbml === prevDbml.current) return;
    prevDbml.current = project.dbml;

    const schema = parseDBMLSync(project.dbml);
    if (schema.error && !schema.tables.length) return;

    const { nodes: newNodes, edges: newEdges } = buildNodesAndEdges(
      schema,
      project.nodePositions,
      project.nodeColors,
      project.nodeCollapsed
    );

    // Merge notes as note nodes
    const noteNodes = (project.notes || []).map(note => ({
      id: note.id,
      type: 'noteNode',
      position: note.position || { x: 100, y: 100 },
      data: { text: note.text },
      style: { zIndex: 10 },
    }));

    setNodes([...newNodes, ...noteNodes]);
    setEdges(newEdges);
  }, [project?.dbml, project?.nodeColors, project?.nodeCollapsed]);

  // Update notes positions when notes change
  useEffect(() => {
    if (!project) return;
    setNodes(nds => nds.map(n => {
      if (n.type !== 'noteNode') return n;
      const note = project.notes?.find(nt => nt.id === n.id);
      return note ? { ...n, data: { text: note.text } } : n;
    }));
  }, [project?.notes]);

  const onNodeDragStop = useCallback((_, node) => {
    if (node.type === 'tableNode') {
      setNodePosition(node.id, node.position);
    } else if (node.type === 'noteNode') {
      useStore.getState().updateNote(node.id, { position: node.position });
    }
  }, [setNodePosition]);

  const handleAddNote = useCallback(() => {
    const pos = rfInstance
      ? rfInstance.project({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      : { x: 200, y: 200 };
    addNote({ text: 'New note', position: pos });
  }, [rfInstance, addNote]);

  const handleAutoLayout = useCallback(() => {
    const newNodes = autoLayout(nodes.filter(n => n.type === 'tableNode'), edges);
    newNodes.forEach(n => setNodePosition(n.id, n.position));
    setNodes(nds => nds.map(n => {
      const updated = newNodes.find(u => u.id === n.id);
      return updated || n;
    }));
    setTimeout(() => rfInstance?.fitView({ padding: 0.1, duration: 300 }), 50);
  }, [nodes, edges, setNodePosition, rfInstance]);

  // Export handlers
  useEffect(() => {
    const handleExportPNG = async () => {
      if (!containerRef.current) return;
      try {
        const el = containerRef.current.querySelector('.react-flow__renderer');
        const dataUrl = await toPng(el || containerRef.current, { quality: 1, pixelRatio: 2, backgroundColor: '#0a0d14' });
        if (window.electronAPI) {
          await window.electronAPI.saveImage({ dataUrl, defaultName: `${project?.name || 'diagram'}.png` });
        } else {
          const a = document.createElement('a'); a.download = 'diagram.png'; a.href = dataUrl; a.click();
        }
      } catch (e) { console.error('PNG export failed', e); }
    };

    const handleExportPDF = async () => {
      if (!containerRef.current) return;
      try {
        const el = containerRef.current.querySelector('.react-flow__renderer');
        const dataUrl = await toPng(el || containerRef.current, { quality: 1, pixelRatio: 2, backgroundColor: '#0a0d14' });
        const img = new Image(); img.src = dataUrl;
        await new Promise(r => { img.onload = r; });
        const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
        const pdfDataUrl = pdf.output('datauristring');
        if (window.electronAPI) {
          await window.electronAPI.savePDF({ dataUrl: pdfDataUrl, defaultName: `${project?.name || 'diagram'}.pdf` });
        } else {
          pdf.save(`${project?.name || 'diagram'}.pdf`);
        }
      } catch (e) { console.error('PDF export failed', e); }
    };

    window.addEventListener('export-png', handleExportPNG);
    window.addEventListener('export-pdf', handleExportPDF);
    return () => {
      window.removeEventListener('export-png', handleExportPNG);
      window.removeEventListener('export-pdf', handleExportPDF);
    };
  }, [project]);

  const tableCount = nodes.filter(n => n.type === 'tableNode').length;
  const edgeCount = edges.length;

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        No project open
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative bg-surface-0">
      <ReactFlow
        ref={flowRef}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={2.5}
        snapToGrid={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#3b4a6b', strokeWidth: 2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2535" />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeColor={(n) => {
            if (n.type === 'noteNode') return '#f59e0b';
            const color = n.data?.color;
            const colors = { blue: '#3b82f6', green: '#10b981', rose: '#f43f5e', violet: '#8b5cf6', amber: '#f59e0b', cyan: '#06b6d4' };
            return colors[color] || '#3b82f6';
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#0f1117', border: '1px solid #2a3349' }}
        />

        {/* Toolbar panel */}
        <Panel position="top-right">
          <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-2 py-1.5 shadow-xl">
            <CanvasBtn onClick={handleAutoLayout} title="Auto-layout tables">
              <LayoutIcon />
            </CanvasBtn>
            <CanvasBtn onClick={handleAddNote} title="Add annotation note">
              <NoteIcon />
            </CanvasBtn>
            <CanvasBtn onClick={() => rfInstance?.fitView({ padding: 0.15, duration: 300 })} title="Fit view">
              <FitIcon />
            </CanvasBtn>
            <div className="w-px h-4 bg-border mx-0.5" />
            <div className="flex items-center gap-2">
              <Stat label="Tables" value={tableCount} />
              <Stat label="Refs" value={edgeCount} />
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function CanvasBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded text-secondary hover:text-primary hover:bg-surface-3 transition-colors"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted">{label}:</span>
      <span className="text-xs text-secondary font-mono font-semibold">{value}</span>
    </div>
  );
}

const LayoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="8" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="1" y="9" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="8" y="9" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3.5 5v1.5h7V5M7 6.5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const NoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const FitIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 4.5V2h2.5M9.5 2H12v2.5M12 9.5V12H9.5M4.5 12H2V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="4.5" y="4.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
