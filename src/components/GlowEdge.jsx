import React, { useState } from 'react';
import { getSmoothStepPath } from 'reactflow';

const EDGE_COLOR_DEFAULT = '#3b4a6b';
const EDGE_COLOR_ACTIVE   = '#3b82f6';

export default function GlowEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data = {},
  selected,
}) {
  const [hovered, setHovered] = useState(false);
  const active = hovered || selected;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 12,
  });

  const color = active ? EDGE_COLOR_ACTIVE : EDGE_COLOR_DEFAULT;
  const strokeWidth = active ? 2.5 : 1.8;
  const gradId = `grad-${id}`;
  const arrowId = `arrow-${id}`;

  const label = getCardinalityLabel(data.refType);

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <defs>
        {/* Arrowhead marker */}
        <marker
          id={arrowId}
          markerWidth="8" markerHeight="8"
          refX="6" refY="3"
          orient="auto"
        >
          <path
            d="M0,0 L0,6 L8,3 z"
            fill={color}
            style={{ transition: 'fill 0.2s' }}
          />
        </marker>

        {/* Animated gradient pulse — only when active */}
        {active && (
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
            x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.1">
              <animate attributeName="offset" values="-0.4;1.4" dur="1.6s" repeatCount="indefinite" />
            </stop>
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85">
              <animate attributeName="offset" values="-0.2;1.6" dur="1.6s" repeatCount="indefinite" />
            </stop>
            <stop offset="0%" stopColor={color} stopOpacity="0.1">
              <animate attributeName="offset" values="0;2" dur="1.6s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        )}
      </defs>

      {/* Wide invisible hit area */}
      <path d={edgePath} stroke="transparent" strokeWidth={16} fill="none" style={{ cursor: 'pointer' }} />

      {/* Base path with arrowhead */}
      <path
        d={edgePath}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        markerEnd={`url(#${arrowId})`}
        style={{
          transition: 'stroke 0.2s, stroke-width 0.2s',
          filter: active ? `drop-shadow(0 0 4px ${color}80)` : 'none',
        }}
      />

      {/* Pulse overlay */}
      {active && (
        <path
          d={edgePath}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth + 1}
          fill="none"
          strokeLinecap="round"
          style={{ opacity: 0.75, pointerEvents: 'none' }}
        />
      )}

      {/* Cardinality label */}
      {label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect x={-16} y={-9} width={32} height={18} rx={4}
            fill="#0f1117"
            stroke={active ? color : '#2a3349'}
            strokeWidth={1}
            style={{ transition: 'stroke 0.2s' }}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fill: active ? color : '#4a5568',
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              transition: 'fill 0.2s',
            }}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

function getCardinalityLabel(refType) {
  switch (refType) {
    case '>':  return '1:N';
    case '<':  return 'N:1';
    case '-':  return '1:1';
    case '<>': return 'N:M';
    default:   return '';
  }
}
