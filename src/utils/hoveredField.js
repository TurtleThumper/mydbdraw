/**
 * hoveredField.js
 *
 * A simple mutable registry that tracks which table field the mouse is
 * currently over. This avoids needing to extract coordinates from inside
 * a ReactFlow node (where the canvas transform makes clientX/Y unreliable).
 *
 * FieldRow writes on mouseenter/mouseleave.
 * CanvasPane's onNodeContextMenu reads it to decide which menu to show,
 * using ReactFlow's already-correct screen coordinates.
 */

export const hoveredField = {
  nodeId: null,
  fieldName: null,
};
