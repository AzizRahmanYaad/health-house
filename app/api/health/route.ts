/**
 * GET /api/health — deployment diagnostics (no secrets).
 * Reports which environment variables are set and whether the database
 * answers, so a broken deployment can be diagnosed from the browser.
 */
import { NextResponse } from 'next/server';
import { fetchValue } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = {
    DATABASE_URL:   process.env.DATABASE_URL ? 'set' : 'MISSING',
    DATABASE_SSL:   process.env.DATABASE_SSL || '(not set)',
    SESSION_SECRET: process.env.SESSION_SECRET ? 'set' : 'MISSING (using insecure default)',
    SETUP_TOKEN:    process.env.SETUP_TOKEN ? 'set' : '(not set)',
    NODE_ENV:       process.env.NODE_ENV,
  };

  let database: Record<string, unknown>;
  try {
    const tables = await fetchValue<number>(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('semesters','users','lessons')", [], 0);
    const lessons = tables === 3 ? await fetchValue<number>('SELECT COUNT(*) FROM lessons', [], 0) : null;
    database = {
      status: tables === 3 ? 'ok' : 'connected, but the tables are missing — open /api/setup?token=YOUR_SETUP_TOKEN',
      lessons,
    };
  } catch (e) {
    database = { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: database.status === 'ok', env, database }, { headers: { 'Cache-Control': 'no-store' } });
}
