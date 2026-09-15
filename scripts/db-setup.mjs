#!/usr/bin/env node
/**
 * Create the tables and load the seed data into the PostgreSQL database
 * named by DATABASE_URL (read from .env.local / .env / the environment).
 *
 *   npm run db:setup           schema + seed  (drops existing tables!)
 *   npm run db:schema          schema only
 *   npm run db:seed            seed only
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    const { config } = await import('dotenv');
    config({ path: p, override: false });
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const schemaOnly = args.includes('--schema-only');
const seedOnly   = args.includes('--seed-only');

const ssl = process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined;
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();

async function runFile(file) {
  const sql = fs.readFileSync(path.resolve('database', file), 'utf8');
  process.stdout.write(`  ${file} … `);
  await client.query(sql);
  console.log('ok');
}

try {
  console.log('Database:', url.replace(/:[^:@/]+@/, ':***@'));
  if (!seedOnly)   await runFile('schema.sql');
  if (!schemaOnly) await runFile('seed.sql');
  const r = await client.query(`SELECT (SELECT COUNT(*) FROM semesters) AS semesters,
                                       (SELECT COUNT(*) FROM subjects)  AS subjects,
                                       (SELECT COUNT(*) FROM lessons)   AS lessons,
                                       (SELECT COUNT(*) FROM users)     AS users`);
  console.log('Done.', r.rows[0]);
  console.log('Sign in with admin@midwifery.edu / admin123 or sara@student.edu / student123');
} catch (e) {
  console.error('\nFailed:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
