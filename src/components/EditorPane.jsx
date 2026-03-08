import React, { useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../store/index.js';

const DBML_KEYWORDS = [
  'Table', 'TableGroup', 'Ref', 'Enum', 'Note',
  'pk', 'not null', 'null', 'unique', 'increment', 'default', 'ref',
  'varchar', 'integer', 'serial', 'bigserial', 'text', 'boolean',
  'timestamp', 'date', 'time', 'uuid', 'jsonb', 'json', 'numeric',
  'decimal', 'float', 'real', 'char', 'bigint', 'smallint',
];

export default function EditorPane({ project }) {
  const { setDBML, parseError, undo, redo } = useStore();
  const editorRef = useRef(null);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register DBML language basics
    monaco.languages.register({ id: 'dbml' });
    monaco.languages.setMonarchTokensProvider('dbml', {
      keywords: ['Table', 'TableGroup', 'Ref', 'Enum', 'Note', 'as'],
      typeKeywords: ['varchar', 'integer', 'serial', 'bigserial', 'text', 'boolean', 'bool',
        'timestamp', 'date', 'time', 'uuid', 'jsonb', 'json', 'numeric', 'decimal',
        'float', 'real', 'char', 'bigint', 'smallint', 'int'],
      fieldKeywords: ['pk', 'not null', 'unique', 'increment', 'default', 'ref', 'note'],
      tokenizer: {
        root: [
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/"[^"]*"/, 'string'],
          [/'[^']*'/, 'string'],
          [/`[^`]*`/, 'string.backtick'],
          [/\[|\]|\{|\}/, 'delimiter.bracket'],
          [/>|<|-|<>/, 'operator'],
          [/[Tt]able(?=\s)/, 'keyword'],
          [/[Tt]able[Gg]roup(?=\s)/, 'keyword'],
          [/[Rr]ef(?=[\s:])/, 'keyword'],
          [/[Ee]num(?=\s)/, 'keyword'],
          [/\b(pk|not null|unique|increment|default|ref|note|null)\b/, 'keyword.field'],
          [/\b(varchar|integer|serial|bigserial|text|boolean|bool|timestamp|date|time|uuid|jsonb|json|numeric|decimal|float|real|char|bigint|smallint|int)\b/i, 'type'],
          [/\b\d+(\.\d+)?\b/, 'number'],
          [/\w+/, 'identifier'],
        ],
        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment'],
        ],
      },
    });

    monaco.editor.defineTheme('localdiagram', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4a5568', fontStyle: 'italic' },
        { token: 'keyword', foreground: '3b82f6', fontStyle: 'bold' },
        { token: 'keyword.field', foreground: '8b5cf6' },
        { token: 'type', foreground: '06b6d4' },
        { token: 'string', foreground: '10b981' },
        { token: 'string.backtick', foreground: 'f59e0b' },
        { token: 'number', foreground: 'f59e0b' },
        { token: 'operator', foreground: 'f43f5e' },
        { token: 'identifier', foreground: 'e2e8f0' },
        { token: 'delimiter.bracket', foreground: '718096' },
      ],
      colors: {
        'editor.background': '#0f1117',
        'editor.foreground': '#e2e8f0',
        'editorLineNumber.foreground': '#2a3349',
        'editorLineNumber.activeForeground': '#4a5568',
        'editor.selectionBackground': '#1e3a5f',
        'editor.lineHighlightBackground': '#161b27',
        'editorCursor.foreground': '#3b82f6',
        'editor.inactiveSelectionBackground': '#1a2540',
        'editorIndentGuide.background': '#1e2535',
        'editorIndentGuide.activeBackground': '#2a3349',
      },
    });
    monaco.editor.setTheme('localdiagram');

    // Autocomplete
    monaco.languages.registerCompletionItemProvider('dbml', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const suggestions = [
          ...DBML_KEYWORDS.map(kw => ({
            label: kw, kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw, range,
          })),
          {
            label: 'Table snippet',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'Table ${1:name} {\n  id serial [pk, increment]\n  ${2:field} ${3:type}\n  created_at timestamp [default: `now()`]\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'New table with id',
            range,
          },
        ];
        return { suggestions };
      },
    });

    // Override Ctrl+Z/Y to use our store
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => undo());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => redo());
  }, [undo, redo]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        No project open
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0" style={{ background: '#0a0d14' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">DBML</span>
          <span className="text-xs text-border">|</span>
          <span className="text-xs text-secondary font-mono">{project.name}.dbml</span>
        </div>
        {parseError ? (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <span>⚠</span>
            <span className="truncate max-w-xs" title={parseError}>Error</span>
          </span>
        ) : (
          <span className="text-xs text-accent-green flex items-center gap-1">
            <span>✓</span>
            <span>Valid</span>
          </span>
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          language="dbml"
          value={project.dbml}
          onChange={(val) => setDBML(val || '')}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            lineHeight: 22,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            bracketPairColorization: { enabled: true },
            suggest: { showKeywords: true },
            quickSuggestions: true,
            folding: true,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>

      {/* Error detail */}
      {parseError && (
        <div className="px-3 py-2 border-t border-red-900/50 bg-red-950/20 shrink-0">
          <p className="text-xs text-red-400 font-mono leading-relaxed">{parseError}</p>
        </div>
      )}
    </div>
  );
}
