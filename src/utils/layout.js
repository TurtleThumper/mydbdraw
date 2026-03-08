// Auto-layout engine for table nodes
// Uses a simple force-directed grid approach without external dependencies

const TABLE_WIDTH = 240;
const TABLE_HEADER_H = 44;
const TABLE_FIELD_H = 32;
const H_GAP = 60;
const V_GAP = 60;

export function buildNodesAndEdges(schema, savedPositions = {}, nodeColors = {}, nodeCollapsed = {}) {
  const { tables, refs, groups } = schema;
  if (!tables.length) return { nodes: [], edges: [] };

  // Group colors
  const groupColorMap = {};
  const groupColors = ['#1e3a5f', '#1a3a2a', '#3a1a2a', '#2a1a3a', '#3a2a1a'];
  groups.forEach((g, i) => {
    g.tables.forEach(tName => {
      groupColorMap[tName] = g.id;
    });
  });

  // Build nodes
  const nodes = tables.map((table, i) => {
    const collapsed = nodeCollapsed[table.name] || false;
    const fieldCount = collapsed ? 0 : table.fields.length;
    const height = TABLE_HEADER_H + fieldCount * TABLE_FIELD_H + (collapsed ? 0 : 12);

    const pos = savedPositions[table.name] || autoPosition(i, tables.length);

    return {
      id: table.name,
      type: 'tableNode',
      position: pos,
      data: {
        table,
        collapsed,
        color: nodeColors[table.name] || null,
        groupId: groupColorMap[table.name] || null,
        fieldCount,
      },
      style: { width: TABLE_WIDTH, height },
    };
  });

  // Build edges
  const edges = refs.map((ref, i) => {
    const [fromTable, fromField] = ref.from.split('.');
    const [toTable, toField] = ref.to.split('.');

    const fromNode = tables.find(t => t.name === fromTable);
    const toNode = tables.find(t => t.name === toTable);
    if (!fromNode || !toNode) return null;

    const fromFieldIdx = fromNode.fields.findIndex(f => f.name === fromField);
    const toFieldIdx = toNode.fields.findIndex(f => f.name === toField);

    return {
      id: ref.id || `edge-${i}`,
      source: fromTable,
      target: toTable,
      sourceHandle: `field-right-${fromField}`,
      targetHandle: `field-left-${toField}`,
      type: 'glowEdge',
      data: { refType: ref.type, fromField, toField },
    };
  }).filter(Boolean);

  return { nodes, edges };
}

function autoPosition(index, total) {
  const cols = Math.ceil(Math.sqrt(total));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: col * (TABLE_WIDTH + H_GAP) + 40,
    y: row * (200 + V_GAP) + 40,
  };
}

// Edge rendering is handled by GlowEdge component

export function autoLayout(nodes, edges) {
  // Simple grid layout - re-positions all nodes
  const cols = Math.ceil(Math.sqrt(nodes.length));
  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: (i % cols) * (TABLE_WIDTH + H_GAP) + 40,
      y: Math.floor(i / cols) * (220 + V_GAP) + 40,
    },
  }));
}
