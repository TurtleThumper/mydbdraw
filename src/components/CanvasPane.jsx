import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
import ContextMenu from './ContextMenu.jsx';
import RenameModal from './RenameModal.jsx';
import { InsertAboveIcon, InsertBelowIcon } from './TableNode.jsx';
import { hoveredField } from '../utils/hoveredField.js';

const nodeTypes = { tableNode: TableNode, noteNode: NoteNode };
const ACCENT_COLORS = { default: '#3b82f6', blue: '#3b82f6', green: '#10b981', rose: '#f43f5e', violet: '#8b5cf6', amber: '#f59e0b', cyan: '#06b6d4' };

export default function CanvasPane({ project }) {
  const {
    setNodePosition, addNote, setNodeCollapsed, setNodeColor,
    deleteTableFromDBML, duplicateTableInDBML, renameTableInDBML,
    undo, redo, setDBML,
  } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const containerRef = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);
  const prevDbml = useRef(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renameModal, setRenameModal] = useState(null);

  // Re-parse when DBML or colors change (collapsed handled separately)
  useEffect(() => {
    if (!project) return;
    if (project.dbml === prevDbml.current) return;
    prevDbml.current = project.dbml;
    const schema = parseDBMLSync(project.dbml);
    if (schema.error && !schema.tables.length) return;
    const { nodes: newNodes, edges: newEdges } = buildNodesAndEdges(
      schema, project.nodePositions, project.nodeColors, project.nodeCollapsed
    );
    const noteNodes = (project.notes || []).map(note => ({
      id: note.id, type: 'noteNode',
      position: note.position || { x: 100, y: 100 },
      data: { text: note.text }, style: { zIndex: 10 },
    }));
    setNodes([...newNodes, ...noteNodes]);
    setEdges(newEdges);
  }, [project?.dbml, project?.nodeColors]);

  // Update collapsed state + node height live (no re-parse needed)
  useEffect(() => {
    if (!project) return;
    const nodeCollapsed = project.nodeCollapsed || {};
    const TABLE_HEADER_H = 44;
    const TABLE_FIELD_H = 32;
    setNodes(nds => nds.map(n => {
      if (n.type !== 'tableNode') return n;
      const collapsed = nodeCollapsed[n.id] || false;
      const fieldCount = n.data?.table?.fields?.length || 0;
      const height = TABLE_HEADER_H + (collapsed ? 0 : fieldCount * TABLE_FIELD_H + 12);
      return { ...n, style: { ...n.style, height }, data: { ...n.data, collapsed } };
    }));
  }, [project?.nodeCollapsed]);

  useEffect(() => {
    if (!project) return;
    setNodes(nds => nds.map(n => {
      if (n.type !== 'noteNode') return n;
      const note = project.notes?.find(nt => nt.id === n.id);
      return note ? { ...n, data: { text: note.text } } : n;
    }));
  }, [project?.notes]);

  const onNodeDragStop = useCallback((_, node) => {
    if (node.type === 'tableNode') setNodePosition(node.id, node.position);
    else if (node.type === 'noteNode') useStore.getState().updateNote(node.id, { position: node.position });
  }, [setNodePosition]);

  // ── Context menu event handlers ──────────────────────────────────────────

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    e.stopPropagation();
    // If the cursor is over a specific field row, show the field menu.
    // We use hoveredField (set by FieldRow mouseenter) so we get ReactFlow's
    // already-correct screen coordinates from this callback instead of trying
    // to extract coordinates from inside the scaled canvas node.
    if (node.type === 'tableNode' && hoveredField.nodeId === node.id && hoveredField.fieldName) {
      setCtxMenu({
        type: 'field',
        x: e.clientX,
        y: e.clientY,
        nodeId: node.id,
        fieldName: hoveredField.fieldName,
      });
    } else {
      setCtxMenu({ type: node.type === 'noteNode' ? 'note' : 'node', x: e.clientX, y: e.clientY, target: node });
    }
  }, []);

  const onEdgeContextMenu = useCallback((e, edge) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ type: 'edge', x: e.clientX, y: e.clientY, target: edge });
  }, []);

  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const canvasPos = rfInstance?.project({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0) });
    setCtxMenu({ type: 'canvas', x: e.clientX, y: e.clientY, canvasPos });
  }, [rfInstance]);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  // ── Section builders ─────────────────────────────────────────────────────

  const buildTableMenuSections = (node) => {
    const tableName = node.id;
    const collapsed = node.data?.collapsed;
    const currentColor = node.data?.color || 'default';

    return [
      [
        {
          label: 'Rename table…',
          icon: <PencilIcon />,
          onClick: () => setRenameModal({ tableName }),
        },
        {
          label: collapsed ? 'Expand fields' : 'Collapse fields',
          icon: collapsed ? <ExpandIcon /> : <CollapseIcon />,
          onClick: () => setNodeCollapsed(tableName, !collapsed),
        },
        {
          label: 'Duplicate table',
          icon: <DuplicateIcon />,
          onClick: () => duplicateTableInDBML(tableName),
        },
      ],
      [
        ...Object.entries(ACCENT_COLORS).map(([name, clr]) => ({
          label: (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ background: clr }} />
              <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
              {currentColor === name && <span className="ml-auto text-white/30 text-[10px]">✓</span>}
            </span>
          ),
          onClick: () => setNodeColor(tableName, name),
        })),
      ],
      [
        {
          label: 'Focus on canvas',
          icon: <FocusIcon />,
          onClick: () => rfInstance?.fitView({ nodes: [{ id: tableName }], padding: 0.3, duration: 300 }),
        },
        {
          label: 'Scroll to in editor',
          icon: <EditorIcon />,
          onClick: () => window.dispatchEvent(new CustomEvent('scroll-editor-to-table', { detail: { tableName } })),
        },
      ],
      [
        {
          label: 'Delete table',
          icon: <TrashIcon />,
          danger: true,
          onClick: () => deleteTableFromDBML(tableName),
        },
      ],
    ];
  };

  const buildNoteMenuSections = (node) => [[
    {
      label: 'Delete note',
      icon: <TrashIcon />,
      danger: true,
      onClick: () => useStore.getState().deleteNote(node.id),
    },
  ]];

  const buildFieldMenuSections = (nodeId, fieldName) => [[
    {
      label: `Insert above "${fieldName}"`,
      icon: <InsertAboveIcon />,
      onClick: () => window.dispatchEvent(new CustomEvent('open-insert-field-modal', {
        detail: { nodeId, fieldName, position: 'above' }
      })),
    },
    {
      label: `Insert below "${fieldName}"`,
      icon: <InsertBelowIcon />,
      onClick: () => window.dispatchEvent(new CustomEvent('open-insert-field-modal', {
        detail: { nodeId, fieldName, position: 'below' }
      })),
    },
  ]];

  const buildEdgeMenuSections = (edge) => [
    [{
      label: `${edge.source}  →  ${edge.target}`,
      disabled: true,
      icon: <RefIcon />,
    }],
    [
      {
        label: 'Focus both tables',
        icon: <FocusIcon />,
        onClick: () => rfInstance?.fitView({ nodes: [{ id: edge.source }, { id: edge.target }], padding: 0.25, duration: 300 }),
      },
      {
        label: 'Delete relationship',
        icon: <TrashIcon />,
        danger: true,
        onClick: () => {
          const proj = useStore.getState().getActiveProject();
          if (!proj) return;
          const fromField = edge.data?.fromField;
          const fromTable = edge.source;
          const toTable = edge.target;
          const lines = proj.dbml.split('\n').map(line => {
            if (line.includes(fromField) && line.includes('ref:') && line.includes(toTable))
              return line.replace(/,?\s*ref:\s*[<>-]\s*[\w.]+/g, '').replace(/\[\s*\]/g, '');
            if (line.match(/^\s*[Rr]ef\s*\w*\s*:/) && line.includes(fromTable) && line.includes(toTable))
              return null;
            return line;
          }).filter(l => l !== null);
          setDBML(lines.join('\n'));
        },
      },
    ],
  ];

  const buildCanvasMenuSections = (canvasPos) => [
    [{
      label: 'Add note here',
      icon: <NoteMenuIcon />,
      onClick: () => addNote({ text: 'New note', position: canvasPos || { x: 200, y: 200 } }),
    }],
    [
      {
        label: 'Auto-layout',
        icon: <LayoutMenuIcon />,
        onClick: handleAutoLayout,
      },
      {
        label: 'Fit view',
        icon: <FitMenuIcon />,
        onClick: () => rfInstance?.fitView({ padding: 0.15, duration: 300 }),
      },
    ],
    [
      { label: 'Undo', icon: <UndoIcon />, shortcut: 'Ctrl+Z', onClick: undo },
      { label: 'Redo', icon: <RedoIcon />, shortcut: 'Ctrl+Y', onClick: redo },
    ],
  ];

  // ── Toolbar actions ───────────────────────────────────────────────────────

  const handleAddNote = useCallback(() => {
    const pos = rfInstance
      ? rfInstance.project({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      : { x: 200, y: 200 };
    addNote({ text: 'New note', position: pos });
  }, [rfInstance, addNote]);

  const handleAutoLayout = useCallback(() => {
    const newNodes = autoLayout(nodes.filter(n => n.type === 'tableNode'), edges);
    newNodes.forEach(n => setNodePosition(n.id, n.position));
    setNodes(nds => nds.map(n => newNodes.find(u => u.id === n.id) || n));
    setTimeout(() => rfInstance?.fitView({ padding: 0.1, duration: 300 }), 50);
  }, [nodes, edges, setNodePosition, rfInstance]);

  // Export
  useEffect(() => {
    const handleExportPNG = async () => {
      if (!containerRef.current) return;
      try {
        const el = containerRef.current.querySelector('.react-flow__renderer');
        const dataUrl = await toPng(el || containerRef.current, { quality: 1, pixelRatio: 2, backgroundColor: '#0a0d14' });
        if (window.electronAPI) await window.electronAPI.saveImage({ dataUrl, defaultName: `${project?.name || 'diagram'}.png` });
        else { const a = document.createElement('a'); a.download = 'diagram.png'; a.href = dataUrl; a.click(); }
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
        if (window.electronAPI) await window.electronAPI.savePDF({ dataUrl: pdfDataUrl, defaultName: `${project?.name || 'diagram'}.pdf` });
        else pdf.save(`${project?.name || 'diagram'}.pdf`);
      } catch (e) { console.error('PDF export failed', e); }
    };
    window.addEventListener('export-png', handleExportPNG);
    window.addEventListener('export-pdf', handleExportPDF);
    return () => { window.removeEventListener('export-png', handleExportPNG); window.removeEventListener('export-pdf', handleExportPDF); };
  }, [project]);

  const tableCount = nodes.filter(n => n.type === 'tableNode').length;
  const edgeCount = edges.length;

  if (!project) return <div className="h-full flex items-center justify-center text-muted text-sm">No project open</div>;

  return (
    <div ref={containerRef} className="h-full w-full relative bg-surface-0">
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop} onInit={setRfInstance}
        nodeTypes={nodeTypes}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        fitView fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode={null} minZoom={0.1} maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#3b4a6b', strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2535" />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeColor={(n) => {
            if (n.type === 'noteNode') return '#f59e0b';
            const clrs = { blue: '#3b82f6', green: '#10b981', rose: '#f43f5e', violet: '#8b5cf6', amber: '#f59e0b', cyan: '#06b6d4' };
            return clrs[n.data?.color] || '#3b82f6';
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#0f1117', border: '1px solid #2a3349' }}
        />
        <Panel position="top-right">
          <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-2 py-1.5 shadow-xl">
            <CanvasBtn onClick={handleAutoLayout} title="Auto-layout tables"><LayoutIcon /></CanvasBtn>
            <CanvasBtn onClick={handleAddNote} title="Add annotation note"><NoteIcon /></CanvasBtn>
            <CanvasBtn onClick={() => rfInstance?.fitView({ padding: 0.15, duration: 300 })} title="Fit view"><FitIcon /></CanvasBtn>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Stat label="Tables" value={tableCount} />
            <Stat label="Refs" value={edgeCount} />
          </div>
        </Panel>
      </ReactFlow>

      {/* Context menus */}
      {ctxMenu?.type === 'node' && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu} sections={buildTableMenuSections(ctxMenu.target)} />}
      {ctxMenu?.type === 'note' && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu} sections={buildNoteMenuSections(ctxMenu.target)} />}
      {ctxMenu?.type === 'edge' && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu} sections={buildEdgeMenuSections(ctxMenu.target)} />}
      {ctxMenu?.type === 'canvas' && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu} sections={buildCanvasMenuSections(ctxMenu.canvasPos)} />}
      {ctxMenu?.type === 'field' && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu} sections={buildFieldMenuSections(ctxMenu.nodeId, ctxMenu.fieldName)} />}

      {/* Rename modal */}
      {renameModal && (
        <RenameModal
          title={`Rename "${renameModal.tableName}"`}
          initialValue={renameModal.tableName}
          onConfirm={(newName) => { renameTableInDBML(renameModal.tableName, newName); setRenameModal(null); }}
          onCancel={() => setRenameModal(null)}
        />
      )}
    </div>
  );
}

function CanvasBtn({ onClick, title, children }) {
  return <button onClick={onClick} title={title} className="w-7 h-7 flex items-center justify-center rounded text-secondary hover:text-primary hover:bg-surface-3 transition-colors">{children}</button>;
}
function Stat({ label, value }) {
  return <div className="flex items-center gap-1"><span className="text-xs text-muted">{label}:</span><span className="text-xs text-secondary font-mono font-semibold">{value}</span></div>;
}

// Icons
const LayoutIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="9" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8" y="9" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 5v1.5h7V5M7 6.5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const NoteIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>;
const FitIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 4.5V2h2.5M9.5 2H12v2.5M12 9.5V12H9.5M4.5 12H2V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="4.5" y="4.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>;
const PencilIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
const TrashIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3.5h8M4.5 3.5V2h3v1.5M5 5.5v3M7 5.5v3M3 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const DuplicateIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
const CollapseIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4.5l4-3 4 3M6 1.5V10M2 7.5l4 3 4-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ExpandIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3.5h8M2 6h8M2 8.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const FocusIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 4V2h2M8.5 2H10v2M10 8v2H8.5M3.5 10H2V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>;
const EditorIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 5l1.5 1.5L3.5 8M6.5 8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const RefIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const NoteMenuIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="1.5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 4.5h4M4 6.5h4M4 8.5h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>;
const LayoutMenuIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="1" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="8" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="8" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3 4v2h6V4M6 6V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const FitMenuIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 4V2h2M8.5 2H10v2M10 8v2H8.5M3.5 10H2V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="4" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>;
const UndoIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 5V2L5 5M2 5c0 3 2 5 5 5s4-2 4-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const RedoIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 5V2L7 5M10 5c0 3-2 5-5 5S1 8 1 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
