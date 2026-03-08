import React, { useCallback, useRef } from 'react';
import { useStore } from '../store/index.js';

export default function ResizeDivider() {
  const { editorWidth, setEditorWidth } = useStore();
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = editorWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setEditorWidth(startWidth.current + delta);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [editorWidth, setEditorWidth]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 shrink-0 hover:bg-accent-blue/50 transition-colors cursor-col-resize group relative"
      style={{ background: '#1e2535' }}
    >
      <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-accent-blue/10" />
      {/* Drag dots */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {[0,1,2].map(i => (
          <div key={i} className="w-1 h-1 rounded-full bg-accent-blue/60" />
        ))}
      </div>
    </div>
  );
}
