# DBdraw

A local, offline PostgreSQL schema diagram tool — a self-hosted alternative to dbdiagram.io built with Electron + React.

## Features

- **Split-pane interface** — DBML editor with live canvas preview
- **Visual drag-and-drop canvas** — Move tables, see relationships
- **Smart DBML editor** — Monaco Editor with syntax highlighting, autocomplete, error detection  
- **Auto-layout** — Automatically arrange tables with one click
- **Color coding** — Assign colors to tables by group/category
- **Collapsible tables** — Clean up the canvas by collapsing table fields
- **Annotations** — Add sticky notes to the canvas
- **Multi-project** — Manage multiple schemas in one window
- **Undo / Redo** — Full history with Ctrl+Z / Ctrl+Y
- **Export** — PostgreSQL SQL, PNG image, PDF
- **Save/Open** — `.dbml` files and `.json` project files (with layout saved)
- **Dark mode** — Always dark, easy on the eyes

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install & Run (Development)

```bash
npm install
npm run dev
```

### Build for Windows

```bash
npm run build
```

This produces an installer in `dist-electron/`.

## DBML Syntax Quick Reference

```dbml
Table users {
  id serial [pk, increment]
  email varchar(255) [unique, not null]
  name varchar(100)
  created_at timestamp [default: `now()`]
}

Table posts {
  id serial [pk]
  title varchar(255) [not null]
  author_id integer [ref: > users.id]   // many-to-one
}

// Ref types:
// > = many-to-one  (posts.author_id > users.id)
// < = one-to-many
// - = one-to-one
// <> = many-to-many

TableGroup "Content" {
  posts
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |
| Scroll | Zoom canvas |
| Middle drag | Pan canvas |

## Project Structure

```
dbdraw/
├── electron/
│   ├── main.js          # Electron main process (file I/O, window)
│   └── preload.js       # Secure IPC bridge
├── src/
│   ├── App.jsx           # Root layout
│   ├── store/index.js    # Zustand state management
│   ├── utils/
│   │   ├── dbml.js       # DBML parser + SQL generator
│   │   └── layout.js     # Canvas auto-layout engine
│   └── components/
│       ├── TitleBar.jsx  # App header + file actions
│       ├── Sidebar.jsx   # Project list
│       ├── EditorPane.jsx # Monaco DBML editor
│       ├── CanvasPane.jsx # ReactFlow diagram canvas
│       ├── TableNode.jsx  # Custom table node
│       ├── NoteNode.jsx   # Annotation node
│       └── ResizeDivider.jsx # Pane resize handle
└── package.json
```
