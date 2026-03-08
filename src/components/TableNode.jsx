import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { useStore } from '../store/index.js';
import ContextMenu from './ContextMenu.jsx';
import InsertFieldModal from './InsertFieldModal.jsx';

const GROUP_COLORS = {
  default: null,
  blue: '#1e3a5f',
  green: '#1a3a2a',
  rose: '#3a1a2a',
  violet: '#2a1a3a',
  amber: '#3a2a1a',
  cyan: '#1a2f3a',
};

const ACCENT_COLORS = {
  default: '#3b82f6',
  blue: '#3b82f6',
  green: '#10b981',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  cyan: '#06b6d4',
};

export default function TableNode({ id, data, selected }) {
  const { setNodeCollapsed, setNodeColor, insertFieldInDBML } = useStore();
  const { table, color } = data;

  // Read collapsed directly from data (kept in sync by CanvasPane effect)
  const collapsed = data.collapsed || false;

  const [colorMenu, setColorMenu] = useState(false);
  const [fieldCtx, setFieldCtx] = useState(null);   // { fieldName, x, y }
  const [insertModal, setInsertModal] = useState(null); // { fieldName, position }

  const accentColor = ACCENT_COLORS[color || 'default'];
  const bgColor = GROUP_COLORS[color || 'default'];

  const fields = table?.fields || [];
  const pkFields = fields.filter(f => f.pk);
  const regularFields = fields.filter(f => !f.pk);

  // ── Collapse ──────────────────────────────────────────────────────────────
  const handleToggleCollapse = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setNodeCollapsed(id, !collapsed);
  }, [id, collapsed, setNodeCollapsed]);

  // ── Field right-click ─────────────────────────────────────────────────────
  const handleFieldContextMenu = useCallback((e, fieldName) => {
    e.preventDefault();
    e.stopPropagation();
    setFieldCtx({ fieldName, x: e.clientX, y: e.clientY });
  }, []);

  const closeFieldCtx = useCallback(() => setFieldCtx(null), []);

  const buildFieldMenuSections = (fieldName) => [
    [
      {
        label: 'Insert field above',
        icon: <InsertAboveIcon />,
        onClick: () => setInsertModal({ fieldName, position: 'above' }),
      },
      {
        label: 'Insert field below',
        icon: <InsertBelowIcon />,
        onClick: () => setInsertModal({ fieldName, position: 'below' }),
      },
    ],
  ];

  return (
    <>
      <div
        className={`table-node ${selected ? 'selected' : ''}`}
        style={{
          borderColor: selected ? accentColor : undefined,
          background: bgColor || '#161b27',
          boxShadow: selected
            ? `0 0 0 2px ${accentColor}40, 0 4px 32px ${accentColor}20`
            : '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{
            borderColor: selected ? accentColor : '#2a3349',
            background: bgColor
              ? `${bgColor}cc`
              : `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`,
            borderTopLeftRadius: 9,
            borderTopRightRadius: 9,
          }}
        >
          {/* Table name */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accentColor }} />
            <span
              className="font-semibold text-primary text-sm truncate"
              style={{ fontFamily: 'Space Grotesk', letterSpacing: '0.01em' }}
              title={table?.name}
            >
              {table?.name}
            </span>
            {table?.alias && (
              <span className="text-xs text-muted font-mono">({table.alias})</span>
            )}
          </div>

          {/* Header controls */}
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {/* Field count badge */}
            <span className="text-xs text-muted bg-surface-4 px-1.5 py-0.5 rounded-full font-mono">
              {fields.length}
            </span>

            {/* Color picker */}
            <div className="relative">
              <button
                className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-secondary hover:bg-surface-4 transition-colors"
                onClick={(e) => { e.stopPropagation(); setColorMenu(v => !v); }}
                title="Set color"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </button>
              {colorMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setColorMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-surface-2 border border-border rounded-lg p-2 shadow-2xl flex gap-1.5">
                    {Object.entries(ACCENT_COLORS).map(([name, clr]) => (
                      <button
                        key={name}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ background: clr, borderColor: color === name ? '#fff' : 'transparent' }}
                        onClick={(e) => { e.stopPropagation(); setNodeColor(id, name); setColorMenu(false); }}
                        title={name}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Collapse toggle — use onPointerDown for reliable ReactFlow capture */}
            <button
              className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-secondary hover:bg-surface-4 transition-colors"
              onPointerDown={handleToggleCollapse}
              title={collapsed ? 'Expand fields' : 'Collapse fields'}
            >
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                style={{
                  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Table note ───────────────────────────────────────────────────── */}
        {!collapsed && table?.note && (
          <div className="px-3 py-1.5 text-xs text-muted italic border-b border-border/50">
            {table.note}
          </div>
        )}

        {/* ── Fields ───────────────────────────────────────────────────────── */}
        {!collapsed && (
          <div className="py-1.5">
            {pkFields.map(field => (
              <FieldRow
                key={field.name}
                field={field}
                accentColor={accentColor}
                isPK
                onContextMenu={(e) => handleFieldContextMenu(e, field.name)}
              />
            ))}
            {pkFields.length > 0 && regularFields.length > 0 && (
              <div className="mx-3 my-1 border-t border-border/50" />
            )}
            {regularFields.map(field => (
              <FieldRow
                key={field.name}
                field={field}
                accentColor={accentColor}
                onContextMenu={(e) => handleFieldContextMenu(e, field.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Field context menu (rendered outside node div to avoid z-index clip) */}
      {fieldCtx && (
        <ContextMenu
          x={fieldCtx.x}
          y={fieldCtx.y}
          onClose={closeFieldCtx}
          sections={buildFieldMenuSections(fieldCtx.fieldName)}
        />
      )}

      {/* ── Insert field modal */}
      {insertModal && (
        <InsertFieldModal
          tableName={id}
          relativeFieldName={insertModal.fieldName}
          position={insertModal.position}
          onConfirm={(newField) => {
            insertFieldInDBML(id, insertModal.fieldName, insertModal.position, newField);
            setInsertModal(null);
          }}
          onCancel={() => setInsertModal(null)}
        />
      )}
    </>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ field, accentColor, isPK, onContextMenu }) {
  return (
    <div
      className="relative flex items-center px-3 py-1 hover:bg-surface-3 group transition-colors cursor-default"
      style={{ minHeight: 32 }}
      onContextMenu={onContextMenu}
    >
      {/* Left handle */}
      <Handle
        id={`field-left-${field.name}`}
        type="target"
        position={Position.Left}
        style={{ top: '50%', left: -4, background: accentColor, width: 8, height: 8, border: '2px solid #0f1117' }}
      />

      {/* PK / FK icon */}
      <div className="w-4 shrink-0 mr-1.5 flex items-center justify-center">
        {isPK && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="4" r="2.5" stroke="#f59e0b" strokeWidth="1.2"/>
            <path d="M5 6.5v2.5M3.5 8h3" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        )}
        {field.ref && !isPK && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5h6M6 3l2 2-2 2" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Field name */}
      <span
        className={`flex-1 text-xs truncate font-mono ${isPK ? 'text-amber-300' : 'text-primary'}`}
        title={field.name}
      >
        {field.name}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1 ml-1">
        {field.unique && !isPK && (
          <span className="text-xs text-violet-400 font-mono opacity-70" title="Unique">U</span>
        )}
        {field.notNull && !isPK && (
          <span className="text-xs text-muted font-mono opacity-60" title="Not null">!</span>
        )}
      </div>

      {/* Right-click hint — shown on hover */}
      <span className="hidden group-hover:inline-flex items-center text-[10px] text-muted/50 ml-1 mr-1 font-mono shrink-0">
        ⋮
      </span>

      {/* Field type */}
      <span
        className="text-xs font-mono shrink-0"
        style={{ color: '#06b6d4', opacity: 0.8 }}
        title={field.type}
      >
        {field.type.length > 12 ? field.type.substring(0, 10) + '…' : field.type}
      </span>

      {/* Right handle */}
      <Handle
        id={`field-right-${field.name}`}
        type="source"
        position={Position.Right}
        style={{ top: '50%', right: -4, background: accentColor, width: 8, height: 8, border: '2px solid #0f1117' }}
      />
    </div>
  );
}

// Icons
const InsertAboveIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 4.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 1.5"/>
    <rect x="2" y="6" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M6 1v3M4.5 2.5L6 1l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InsertBelowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="2" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M2 7.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 1.5"/>
    <path d="M6 11V8M4.5 9.5L6 11l1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
