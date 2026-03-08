// DBML parsing utilities using @dbml/core
let dbmlCore = null;

async function getDBMLCore() {
  if (!dbmlCore) {
    dbmlCore = await import('@dbml/core');
  }
  return dbmlCore;
}

export function parseDBML(dbmlStr) {
  if (!dbmlStr || !dbmlStr.trim()) return { schema: null, error: null };
  try {
    // Use the Parser class from @dbml/core
    const { Parser } = require('@dbml/core');
    const parser = new Parser();
    const schema = parser.parse(dbmlStr, 'dbml');
    return { schema, error: null };
  } catch (e) {
    // Try alternate import path
    try {
      const core = window.__dbmlCore;
      if (core) {
        const schema = core.Parser.parse(dbmlStr, 'dbml');
        return { schema, error: null };
      }
    } catch {}
    return { schema: null, error: e.message || 'Parse error' };
  }
}

export function parseDBMLSync(dbmlStr) {
  if (!dbmlStr || !dbmlStr.trim()) return { tables: [], refs: [], groups: [], error: null };

  try {
    // Manual lightweight DBML parser for canvas rendering
    const tables = [];
    const refs = [];
    const groups = [];

    const lines = dbmlStr.split('\n');
    let currentTable = null;
    let currentGroup = null;
    let inTable = false;
    let inGroup = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments
      if (line.startsWith('//')) continue;

      // Table definition
      const tableMatch = line.match(/^[Tt]able\s+["']?([^"'\s{]+)["']?\s*(\[.*?\])?\s*\{?/);
      if (tableMatch && !inTable && !inGroup) {
        currentTable = {
          id: tableMatch[1],
          name: tableMatch[1],
          alias: null,
          note: null,
          fields: [],
          headerColor: null,
        };

        // Check for alias
        const aliasMatch = line.match(/as\s+(\w+)/i);
        if (aliasMatch) currentTable.alias = aliasMatch[1];

        inTable = true;
        braceDepth = line.includes('{') ? 1 : 0;
        continue;
      }

      // TableGroup
      const groupMatch = line.match(/^[Tt]able[Gg]roup\s+["']?([^"'\s{]+)["']?\s*\{?/);
      if (groupMatch && !inTable && !inGroup) {
        currentGroup = { id: groupMatch[1], name: groupMatch[1], tables: [] };
        inGroup = true;
        continue;
      }

      if (inGroup) {
        if (line === '}') {
          groups.push(currentGroup);
          currentGroup = null;
          inGroup = false;
        } else if (line && !line.startsWith('//')) {
          const tName = line.replace(/['"]/g, '').trim();
          if (tName) currentGroup.tables.push(tName);
        }
        continue;
      }

      if (inTable) {
        if (line.includes('{')) braceDepth++;
        if (line.includes('}')) braceDepth--;

        if (braceDepth <= 0) {
          tables.push(currentTable);
          currentTable = null;
          inTable = false;
          braceDepth = 0;
          continue;
        }

        // Table note
        const noteMatch = line.match(/^[Nn]ote:\s*["']?(.+?)["']?$/);
        if (noteMatch) {
          if (currentTable) currentTable.note = noteMatch[1];
          continue;
        }

        // Field definition
        if (line && !line.startsWith('}') && !line.startsWith('indexes') && !line.startsWith('Note')) {
          const fieldMatch = line.match(/^["']?(\w+)["']?\s+(\S+)(.*?)$/);
          if (fieldMatch && currentTable) {
            const fieldName = fieldMatch[1];
            const fieldType = fieldMatch[2].replace(/,.*/, '');
            const rest = fieldMatch[3] || '';

            const field = {
              name: fieldName,
              type: fieldType,
              pk: rest.includes('pk') || rest.includes('primary key'),
              notNull: rest.includes('not null'),
              unique: rest.includes('unique'),
              increment: rest.includes('increment'),
              default: null,
              note: null,
              ref: null,
            };

            const defaultMatch = rest.match(/default:\s*[`'""]?([^,`'""\]]+)[`'""]?/);
            if (defaultMatch) field.default = defaultMatch[1].trim();

            const noteMatch2 = rest.match(/note:\s*['""]([^'"\"]+)['"\"]/);
            if (noteMatch2) field.note = noteMatch2[1];

            // Inline ref
            const refMatch = rest.match(/ref:\s*([<>-])\s*([\w.]+)/);
            if (refMatch) {
              field.ref = { type: refMatch[1], target: refMatch[2] };
              const [tbl, col] = refMatch[2].split('.');
              refs.push({
                id: `ref-${currentTable.name}-${fieldName}`,
                from: `${currentTable.name}.${fieldName}`,
                to: `${tbl}.${col || 'id'}`,
                type: refMatch[1],
              });
            }

            currentTable.fields.push(field);
          }
        }
        continue;
      }

      // Standalone Ref
      const standaloneRef = line.match(/^[Rr]ef\s*(?:\w+)?\s*:\s*([\w.]+)\s*([<>-])\s*([\w.]+)/);
      if (standaloneRef) {
        refs.push({
          id: `ref-${Date.now()}-${refs.length}`,
          from: standaloneRef[1],
          to: standaloneRef[3],
          type: standaloneRef[2],
        });
      }
    }

    return { tables, refs, groups, error: null };
  } catch (e) {
    return { tables: [], refs: [], groups: [], error: e.message };
  }
}

export function generatePostgresSQL(dbmlStr) {
  const { tables, refs, error } = parseDBMLSync(dbmlStr);
  if (error) return `-- Parse error: ${error}`;

  let sql = `-- Generated by DBdraw\n-- PostgreSQL DDL\n\n`;

  for (const table of tables) {
    sql += `CREATE TABLE "${table.name}" (\n`;
    const fieldDefs = table.fields.map(f => {
      let def = `  "${f.name}" `;

      // Map types to PostgreSQL
      const typeMap = {
        'serial': 'SERIAL', 'bigserial': 'BIGSERIAL',
        'integer': 'INTEGER', 'int': 'INTEGER', 'bigint': 'BIGINT',
        'smallint': 'SMALLINT', 'boolean': 'BOOLEAN', 'bool': 'BOOLEAN',
        'text': 'TEXT', 'varchar': 'VARCHAR', 'char': 'CHAR',
        'timestamp': 'TIMESTAMP', 'date': 'DATE', 'time': 'TIME',
        'numeric': 'NUMERIC', 'decimal': 'DECIMAL', 'float': 'FLOAT',
        'real': 'REAL', 'json': 'JSON', 'jsonb': 'JSONB',
        'uuid': 'UUID',
      };

      const baseType = f.type.toLowerCase().split('(')[0];
      const pgType = typeMap[baseType] || f.type.toUpperCase();
      const hasSize = f.type.includes('(');
      def += hasSize ? pgType + f.type.slice(f.type.indexOf('(')) : pgType;

      if (f.pk) def += ' PRIMARY KEY';
      if (f.increment && !pgType.includes('SERIAL')) def += ' GENERATED ALWAYS AS IDENTITY';
      if (f.notNull && !f.pk) def += ' NOT NULL';
      if (f.unique && !f.pk) def += ' UNIQUE';
      if (f.default) def += ` DEFAULT ${f.default.startsWith('`') ? f.default.slice(1, -1) : `'${f.default}'`}`;

      return def;
    });

    sql += fieldDefs.join(',\n');
    sql += `\n);\n\n`;
  }

  // Foreign keys
  const fkRefs = refs.filter(r => r.type !== '-');
  if (fkRefs.length) {
    sql += '-- Foreign Keys\n';
    for (const ref of fkRefs) {
      const [fromTable, fromCol] = ref.from.split('.');
      const [toTable, toCol] = ref.to.split('.');
      if (fromTable && fromCol && toTable && toCol) {
        sql += `ALTER TABLE "${fromTable}" ADD CONSTRAINT "fk_${fromTable}_${fromCol}" FOREIGN KEY ("${fromCol}") REFERENCES "${toTable}" ("${toCol}");\n`;
      }
    }
  }

  return sql;
}
