import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { parseDBMLSync as parseDBML } from '../utils/dbml';
import { buildNodesAndEdges } from '../utils/layout';

const MAX_HISTORY = 50;

const DEFAULT_DBML = `// DBdraw — PostgreSQL Schema Designer
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
      if (parsed.__dbdraw) {
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

  // Table DBML operations (used by context menus)
  deleteTableFromDBML: (tableName) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj) return;
    const lines = proj.dbml.split('\n');
    const out = [];
    let inTable = false;
    let depth = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tableMatch = line.match(/^\s*[Tt]able\s+["']?(\w+)["']?/);
      if (tableMatch && tableMatch[1] === tableName && !inTable) {
        inTable = true; depth = 0;
        if (line.includes('{')) depth = 1;
        continue;
      }
      if (inTable) {
        if (line.includes('{')) depth++;
        if (line.includes('}')) depth--;
        if (depth <= 0) { inTable = false; }
        continue;
      }
      const refLine = line.match(/^\s*[Rr]ef\s*\w*\s*:/);
      if (refLine && line.includes(tableName + '.')) continue;
      if (line.trim() === tableName) continue;
      out.push(line);
    }
    const newDBML = out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    proj.dbml = newDBML;
    proj.dirty = true;
    delete proj.nodePositions[tableName];
    delete proj.nodeColors[tableName];
    delete proj.nodeCollapsed[tableName];
    const hist = proj.history.slice(0, proj.historyIndex + 1);
    hist.push(newDBML);
    proj.history = hist;
    proj.historyIndex = hist.length - 1;
    state.parseError = parseDBML(newDBML).error || null;
  }),

  duplicateTableInDBML: (tableName) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj) return;
    const lines = proj.dbml.split('\n');
    const tableLines = [];
    let inTable = false;
    let depth = 0;
    for (const line of lines) {
      const tableMatch = line.match(/^\s*[Tt]able\s+["']?(\w+)["']?/);
      if (tableMatch && tableMatch[1] === tableName && !inTable) {
        inTable = true; depth = 0;
        if (line.includes('{')) depth = 1;
        tableLines.push(line);
        continue;
      }
      if (inTable) {
        if (line.includes('{')) depth++;
        if (line.includes('}')) depth--;
        tableLines.push(line);
        if (depth <= 0) { inTable = false; break; }
      }
    }
    if (!tableLines.length) return;
    let newName = `${tableName}_copy`;
    let counter = 1;
    while (proj.dbml.includes(`Table ${newName}`)) { newName = `${tableName}_copy${counter++}`; }
    const newBlock = tableLines.join('\n').replace(
      new RegExp(`(Table\\s+)${tableName}\\b`), `$1${newName}`
    );
    const newDBML = proj.dbml.trimEnd() + '\n\n' + newBlock + '\n';
    proj.dbml = newDBML;
    proj.dirty = true;
    if (proj.nodePositions[tableName]) {
      proj.nodePositions[newName] = {
        x: proj.nodePositions[tableName].x + 60,
        y: proj.nodePositions[tableName].y + 60,
      };
    }
    const hist = proj.history.slice(0, proj.historyIndex + 1);
    hist.push(newDBML);
    proj.history = hist;
    proj.historyIndex = hist.length - 1;
    state.parseError = parseDBML(newDBML).error || null;
  }),

  renameTableInDBML: (oldName, newName) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj || !newName.trim() || newName === oldName) return;
    const safeName = newName.trim().replace(/\s+/g, '_');
    let newDBML = proj.dbml
      .replace(new RegExp(`\\bTable\\s+${oldName}\\b`, 'g'), `Table ${safeName}`)
      .replace(new RegExp(`\\b${oldName}\\.`, 'g'), `${safeName}.`)
      .replace(new RegExp(`^(\\s*)${oldName}(\\s*)$`, 'gm'), `$1${safeName}$2`);
    proj.dbml = newDBML;
    proj.dirty = true;
    if (proj.nodePositions[oldName]) { proj.nodePositions[safeName] = proj.nodePositions[oldName]; delete proj.nodePositions[oldName]; }
    if (proj.nodeColors[oldName]) { proj.nodeColors[safeName] = proj.nodeColors[oldName]; delete proj.nodeColors[oldName]; }
    if (proj.nodeCollapsed[oldName] !== undefined) { proj.nodeCollapsed[safeName] = proj.nodeCollapsed[oldName]; delete proj.nodeCollapsed[oldName]; }
    const hist = proj.history.slice(0, proj.historyIndex + 1);
    hist.push(newDBML);
    proj.history = hist;
    proj.historyIndex = hist.length - 1;
    state.parseError = parseDBML(newDBML).error || null;
  }),

  // Insert a new field into a table above or below a reference field
  insertFieldInDBML: (tableName, relativeFieldName, position, newField) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj) return;
    const lines = proj.dbml.split('\n');
    const out = [];
    let inTable = false;
    let depth = 0;
    let inserted = false;
    const fieldLine = '  ' + newField.name + ' ' + newField.type + (newField.attrs ? ' [' + newField.attrs + ']' : '');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tableMatch = line.match(/^\s*[Tt]able\s+["\'"]?(\w+)["\'"]?/);
      if (tableMatch && tableMatch[1] === tableName && !inTable) {
        inTable = true; depth = line.includes('{') ? 1 : 0;
        out.push(line); continue;
      }
      if (inTable) {
        if (line.includes('{')) depth++;
        if (line.includes('}')) depth--;
        const isRefField = line.match(new RegExp('^\\s+' + relativeFieldName + '\\s'));
        if (isRefField && !inserted) {
          if (position === 'above') { out.push(fieldLine); out.push(line); }
          else { out.push(line); out.push(fieldLine); }
          inserted = true;
          if (depth <= 0) inTable = false;
          continue;
        }
        if (depth <= 0 && !inserted) { out.push(fieldLine); inserted = true; inTable = false; }
      }
      out.push(line);
    }
    const newDBML = out.join('\n');
    proj.dbml = newDBML; proj.dirty = true;
    const hist = proj.history.slice(0, proj.historyIndex + 1);
    hist.push(newDBML); proj.history = hist; proj.historyIndex = hist.length - 1;
    state.parseError = parseDBML(newDBML).error || null;
  }),

  // Update or remove a table's Note in DBML
  updateTableNoteInDBML: (tableName, noteText) => set(state => {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (!proj) return;
    const lines = proj.dbml.split('\n');
    const out = [];
    let inTarget = false;
    let braceDepth = 0;
    let noteWritten = false;
    let headerLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect Table block start
      if (!inTarget) {
        const tMatch = trimmed.match(/^[Tt]able\s+["']?(\w+)["']?(\s+as\s+\S+)?\s*\{?/);
        if (tMatch && tMatch[1] === tableName) {
          inTarget = true;
          braceDepth = (trimmed.includes('{')) ? 1 : 0;
          headerLineIdx = out.length;
          out.push(line);
          continue;
        }
        out.push(line);
        continue;
      }

      // Inside target table block
      if (trimmed.includes('{')) braceDepth++;
      if (trimmed.includes('}')) braceDepth--;

      if (braceDepth <= 0) {
        // Closing brace — if we haven't written the note yet and there's text, insert before closing
        if (noteText && !noteWritten) {
          out.push(`  Note: '${noteText}'`);
        }
        inTarget = false;
        out.push(line);
        continue;
      }

      // Skip existing Note lines inside this table
      if (trimmed.match(/^[Nn]ote:/)) {
        if (noteText && !noteWritten) {
          out.push(`  Note: '${noteText}'`);
          noteWritten = true;
        }
        // If noteText is empty, just skip the old note (effectively deletes it)
        continue;
      }

      out.push(line);
    }

    const newDBML = out.join('\n');
    proj.dbml = newDBML; proj.dirty = true;
    const hist = proj.history.slice(0, proj.historyIndex + 1);
    hist.push(newDBML); proj.history = hist; proj.historyIndex = hist.length - 1;
    state.parseError = parseDBML(newDBML).error || null;
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
