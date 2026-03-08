import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { parseDBMLSync as parseDBML } from '../utils/dbml';
import { buildNodesAndEdges } from '../utils/layout';

const MAX_HISTORY = 50;

const DEFAULT_DBML = `// LocalDiagram — PostgreSQL Schema Designer
// Start typing or use the visual canvas to build your schema

Table users {
  id serial [pk, increment]
  email varchar(255) [unique, not null]
  name varchar(100) [not null]
  role varchar(20) [default: 'member']
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id serial [pk, increment]
  title varchar(255) [not null]
  body text
  author_id integer [ref: > users.id]
  status varchar(20) [default: 'draft']
  created_at timestamp [default: \`now()\`]
  updated_at timestamp
}

Table comments {
  id serial [pk, increment]
  post_id integer [ref: > posts.id]
  user_id integer [ref: > users.id]
  body text [not null]
  created_at timestamp [default: \`now()\`]
}

TableGroup "Content" {
  posts
  comments
}
`;

const createProject = (id, name, dbml = DEFAULT_DBML) => ({
  id,
  name,
  dbml,
  filePath: null,
  dirty: false,
  nodePositions: {},
  nodeColors: {},
  nodeCollapsed: {},
  notes: [],
  history: [dbml],
  historyIndex: 0,
  createdAt: Date.now(),
});

export const useStore = create(immer((set, get) => ({
  // Projects
  projects: [createProject('proj-1', 'My Schema')],
  activeProjectId: 'proj-1',

  // UI state
  sidebarOpen: true,
  editorWidth: 380,
  parseError: null,

  // Getters
  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find(p => p.id === activeProjectId);
  },

  // Project management
  newProject: () => set(state => {
    const id = `proj-${Date.now()}`;
    const proj = createProject(id, `Schema ${state.projects.length + 1}`, '// New schema\n\nTable example {\n  id serial [pk]\n  name varchar(100)\n}\n');
    state.projects.push(proj);
    state.activeProjectId = id;
  }),

  openProject: (fileData) => set(state => {
    const id = `proj-${Date.now()}`;
    let name = fileData.path ? fileData.path.split(/[\\/]/).pop().replace(/\.dbml$/, '') : 'Imported';
    let dbml = fileData.content;
    let extra = {};

    // Try parsing as JSON project
    try {
      const parsed = JSON.parse(fileData.content);
      if (parsed.__localdiagram) {
        dbml = parsed.dbml;
        name = parsed.name || name;
        extra = { nodePositions: parsed.nodePositions || {}, nodeColors: parsed.nodeColors || {}, nodeCollapsed: parsed.nodeCollapsed || {}, notes: parsed.notes || [] };
      }
    } catch {}

    const proj = createProject(id, name, dbml);
    Object.assign(proj, extra, { filePath: fileData.path, history: [dbml], historyIndex: 0 });
    state.projects.push(proj);
    state.activeProjectId = id;
  }),

  closeProject: (id) => set(state => {
    const idx = state.projects.findIndex(p => p.id === id);
    if (idx === -1) return;
    state.projects.splice(idx, 1);
    if (!state.projects.length) {
      const newProj = createProject('proj-1', 'My Schema');
      state.projects.push(newProj);
      state.activeProjectId = 'proj-1';
    } else if (state.activeProjectId === id) {
      state.activeProjectId = state.projects[Math.max(0, idx - 1)].id;
    }
  }),

  setActiveProject: (id) => set(state => { state.activeProjectId = id; }),

  renameProject: (id, name) => set(state => {
    const proj = state.projects.find(p => p.id === id);
    if (proj) { proj.name = name; proj.dirty = true; }
  }),

  // DBML editing
  setDBML: (dbml) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj) return;
    proj.dbml = dbml;
    proj.dirty = true;

    // Push to history
    const newHistory = proj.history.slice(0, proj.historyIndex + 1);
    newHistory.push(dbml);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    proj.history = newHistory;
    proj.historyIndex = newHistory.length - 1;

    // Parse for error checking
    const result = parseDBML(dbml);
    state.parseError = result.error || null;
  }),

  undo: () => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj || proj.historyIndex <= 0) return;
    proj.historyIndex--;
    proj.dbml = proj.history[proj.historyIndex];
    state.parseError = parseDBML(proj.dbml).error || null;
  }),

  redo: () => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj || proj.historyIndex >= proj.history.length - 1) return;
    proj.historyIndex++;
    proj.dbml = proj.history[proj.historyIndex];
    state.parseError = parseDBML(proj.dbml).error || null;
  }),

  // Node layout
  setNodePosition: (nodeId, position) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (proj) proj.nodePositions[nodeId] = position;
  }),

  setNodeColor: (nodeId, color) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (proj) { proj.nodeColors[nodeId] = color; proj.dirty = true; }
  }),

  setNodeCollapsed: (nodeId, collapsed) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (proj) { proj.nodeCollapsed[nodeId] = collapsed; proj.dirty = true; }
  }),

  // Notes
  addNote: (note) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (proj) { proj.notes.push({ id: `note-${Date.now()}`, ...note }); proj.dirty = true; }
  }),

  updateNote: (noteId, updates) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj) return;
    const note = proj.notes.find(n => n.id === noteId);
    if (note) { Object.assign(note, updates); proj.dirty = true; }
  }),

  deleteNote: (noteId) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (proj) { proj.notes = proj.notes.filter(n => n.id !== noteId); proj.dirty = true; }
  }),

  // File operations
  markSaved: (id, filePath) => set(state => {
    const proj = state.projects.find(p => p.id === id);
    if (proj) { proj.dirty = false; if (filePath) proj.filePath = filePath; }
  }),

  // UI
  setSidebarOpen: (v) => set(state => { state.sidebarOpen = v; }),
  setEditorWidth: (w) => set(state => { state.editorWidth = Math.max(260, Math.min(700, w)); }),
  setParseError: (err) => set(state => { state.parseError = err; }),
})));
