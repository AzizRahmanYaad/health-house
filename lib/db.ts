/**
 * PostgreSQL connection (singleton pool) + small query helpers.
 * Mirrors config/db.php of the PHP portal.
 *
 * Queries are written with `?` placeholders exactly as in the original
 * code; they are rewritten to $1, $2 … before being sent to PostgreSQL.
 */
import 'server-only';
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

/* COUNT(*) and SUM() come back as bigint / numeric strings by default —
   the application always wants plain numbers. */
types.setTypeParser(20,   v => parseInt(v, 10));     // int8
types.setTypeParser(1700, v => parseFloat(v));       // numeric
types.setTypeParser(700,  v => parseFloat(v));       // float4
types.setTypeParser(701,  v => parseFloat(v));       // float8

declare global {
  // eslint-disable-next-line no-var
  var __hhPool: Pool | undefined;
}

function makePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  const ssl = process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, ssl, max: 10 });
  pool.on('error', err => console.error('[db] idle client error', err));
  return pool;
}

export function db(): Pool {
  if (!global.__hhPool) global.__hhPool = makePool();
  return global.__hhPool;
}

/** Rewrite `?` placeholders (outside string literals) into $1, $2 … */
export function toPg(sql: string): string {
  let out = '';
  let n = 0;
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      inStr = !inStr;
      out += c;
    } else if (c === '?' && !inStr) {
      out += '$' + (++n);
    } else {
      out += c;
    }
  }
  return out;
}

export type Row = Record<string, unknown>;
type Runner = Pool | PoolClient;

export async function q<T extends QueryResultRow = Row>(sql: string, params: unknown[] = [], client?: Runner) {
  return (client || db()).query<T>(toPg(sql), params);
}

export async function fetchAll<T extends QueryResultRow = Row>(sql: string, params: unknown[] = [], client?: Runner): Promise<T[]> {
  const r = await q<T>(sql, params, client);
  return r.rows;
}

export async function fetchOne<T extends QueryResultRow = Row>(sql: string, params: unknown[] = [], client?: Runner): Promise<T | null> {
  const r = await q<T>(sql, params, client);
  return r.rows[0] ?? null;
}

export async function fetchValue<T = unknown>(sql: string, params: unknown[] = [], def: T | null = null, client?: Runner): Promise<T> {
  const r = await q(sql, params, client);
  const row = r.rows[0];
  if (!row) return def as T;
  const v = Object.values(row)[0];
  return (v === undefined || v === null ? def : v) as T;
}

/** Run a callback inside a transaction. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/* -------- tiny coercion helpers for values that come out of pg -------- */
export const toInt = (v: unknown, d = 0): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};
export const toNum = (v: unknown, d = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : d;
};
