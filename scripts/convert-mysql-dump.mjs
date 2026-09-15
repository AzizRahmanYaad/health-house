#!/usr/bin/env node
/**
 * Convert a phpMyAdmin / mysqldump export of the PHP portal into a
 * PostgreSQL seed file for this application.
 *
 *   node scripts/convert-mysql-dump.mjs <dump.sql> [database/seed.sql]
 *
 * Only the INSERT statements are used — the table structure comes from
 * database/schema.sql. The converter:
 *   · tokenises every VALUES (...) tuple (MySQL escapes, NULL, numbers)
 *   · turns 0/1 into FALSE/TRUE for the columns that are BOOLEAN here
 *   · emits one multi-row INSERT per table, in dependency order
 *   · resets every identity sequence to MAX(id)+1
 */
import fs from 'node:fs';
import path from 'node:path';

const [,, inPath, outPath = 'database/seed.sql'] = process.argv;
if (!inPath) {
  console.error('usage: node scripts/convert-mysql-dump.mjs <mysql-dump.sql> [out.sql]');
  process.exit(1);
}

const BOOL_COLUMNS = {
  semesters:            ['is_active'],
  subjects:             ['is_active'],
  lessons:              ['is_required', 'is_active'],
  quizzes:              ['shuffle', 'is_active'],
  quiz_options:         ['is_correct'],
  quiz_attempts:        ['passed'],
  quiz_attempt_answers: ['is_correct'],
  lesson_subtitles:     ['is_default'],
};

/* parents before children, so the foreign keys are satisfied */
const TABLE_ORDER = [
  'semesters', 'users', 'subjects', 'lessons', 'lesson_materials', 'lesson_subtitles',
  'quizzes', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers',
  'lesson_progress', 'lesson_bookmarks', 'timetable', 'announcements', 'activity_log', 'settings',
];

const sql = fs.readFileSync(inPath, 'utf8');

/* ------------------------------------------------------------------ */
/* 1. find every INSERT INTO `table` (cols) VALUES ... ;               */
/* ------------------------------------------------------------------ */
const inserts = {};          // table -> { columns, rows[] }
let pos = 0;
const re = /INSERT INTO `?(\w+)`?\s*\(([^)]*)\)\s*VALUES\s*/g;
let m;
while ((m = re.exec(sql))) {
  const table = m[1];
  const columns = m[2].split(',').map(c => c.trim().replace(/`/g, ''));
  pos = re.lastIndex;
  const { rows, end } = readTuples(sql, pos);
  re.lastIndex = end;
  if (!inserts[table]) inserts[table] = { columns, rows: [] };
  inserts[table].rows.push(...rows);
}

/**
 * Read "(v, v, v), (v, v, v) ;" starting at `from`. Returns the parsed rows
 * and the index just after the terminating semicolon.
 */
function readTuples(src, from) {
  const rows = [];
  let i = from;
  const n = src.length;

  const skipWs = () => { while (i < n && /\s/.test(src[i])) i++; };

  for (;;) {
    skipWs();
    if (src[i] !== '(') break;
    i++;
    const row = [];
    for (;;) {
      skipWs();
      const ch = src[i];
      if (ch === "'") {
        i++;
        let s = '';
        for (;;) {
          const c = src[i];
          if (c === '\\') {
            const nx = src[i + 1];
            const map = { '0': '\0', "'": "'", '"': '"', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a', '\\': '\\', '%': '%', _: '_' };
            s += map[nx] !== undefined ? map[nx] : nx;
            i += 2;
          } else if (c === "'") {
            if (src[i + 1] === "'") { s += "'"; i += 2; } else { i++; break; }
          } else {
            s += c; i++;
          }
        }
        row.push({ type: 'string', value: s });
      } else if (src.startsWith('NULL', i)) {
        i += 4;
        row.push({ type: 'null' });
      } else {
        let t = '';
        while (i < n && !/[,)]/.test(src[i])) { t += src[i]; i++; }
        row.push({ type: 'raw', value: t.trim() });
      }
      skipWs();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === ')') { i++; break; }
      throw new Error('Unexpected character at ' + i + ': ' + src.slice(i, i + 40));
    }
    rows.push(row);
    skipWs();
    if (src[i] === ',') { i++; continue; }
    if (src[i] === ';') { i++; break; }
    break;
  }
  return { rows, end: i };
}

/* ------------------------------------------------------------------ */
/* 2. emit PostgreSQL                                                  */
/* ------------------------------------------------------------------ */
function pgLiteral(v, isBool) {
  if (v.type === 'null') return 'NULL';
  if (isBool) {
    const raw = v.type === 'raw' ? v.value : v.value;
    return raw === '1' || raw === 'true' ? 'TRUE' : 'FALSE';
  }
  if (v.type === 'raw') return v.value;
  return "'" + v.value.replace(/'/g, "''") + "'";
}

let out = '';
out += '-- =====================================================================\n';
out += '--  HEALTH HOUSE — seed data (PostgreSQL)\n';
out += `--  Generated from ${path.basename(inPath)} by scripts/convert-mysql-dump.mjs\n`;
out += '--  Run AFTER database/schema.sql\n';
out += '-- =====================================================================\n\n';
out += 'BEGIN;\n';
out += "SET TIME ZONE 'UTC';\n\n";

const emitted = new Set();
for (const table of TABLE_ORDER) {
  const t = inserts[table];
  if (!t || !t.rows.length) continue;
  emitted.add(table);
  const bools = BOOL_COLUMNS[table] || [];
  out += `-- ${table} (${t.rows.length} rows)\n`;
  out += `INSERT INTO ${table} (${t.columns.join(', ')}) VALUES\n`;
  out += t.rows.map(row =>
    '(' + row.map((v, idx) => pgLiteral(v, bools.includes(t.columns[idx]))).join(', ') + ')'
  ).join(',\n');
  out += ';\n\n';
}

for (const table of Object.keys(inserts)) {
  if (!emitted.has(table)) console.warn('warning: table not in TABLE_ORDER, skipped:', table);
}

/* identity sequences must start after the highest imported id */
out += '-- reset identity sequences\n';
for (const table of TABLE_ORDER) {
  if (!emitted.has(table)) continue;
  if (!inserts[table].columns.includes('id')) continue;
  out += `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false);\n`;
}
out += '\nCOMMIT;\n';

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');
console.log('wrote', outPath, 'tables:', [...emitted].join(', '));
