/**
 * GET /api/setup?token=SETUP_TOKEN[&force=1]
 *
 * One-click installer for hosts without a terminal (the install.php of the
 * PHP portal). Runs database/schema.sql and database/seed.sql against
 * DATABASE_URL. Refuses to touch a database that already has tables unless
 * force=1 is given, and refuses entirely unless SETUP_TOKEN is configured
 * and matches. Remove SETUP_TOKEN from the environment once installed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db, fetchValue } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
     <style>body{font:16px/1.6 system-ui,Segoe UI,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#1B2330}
     pre{background:#F5F7FA;padding:14px;border-radius:10px;overflow:auto}code{background:#F5F7FA;padding:2px 6px;border-radius:6px}</style>
     <h1>${title}</h1>${body}`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const force = url.searchParams.get('force') === '1';
  const expected = process.env.SETUP_TOKEN || '';

  if (!expected) {
    return page('Setup is disabled', '<p>Set a <code>SETUP_TOKEN</code> environment variable (any long random text), redeploy, then open <code>/api/setup?token=THAT_VALUE</code>.</p>', 403);
  }
  if (token !== expected) {
    return page('Wrong token', '<p>The <code>token</code> in the address does not match <code>SETUP_TOKEN</code>.</p>', 403);
  }

  let existing = 0;
  try {
    existing = Number(await fetchValue("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('semesters','users','lessons')", [], 0));
  } catch (e) {
    return page('Cannot reach the database', `<p>Check <code>DATABASE_URL</code> (and <code>DATABASE_SSL=require</code> on Neon/Supabase).</p><pre>${String(e instanceof Error ? e.message : e).replace(/</g, '&lt;')}</pre>`, 500);
  }
  if (existing > 0 && !force) {
    return page('Already installed', '<p>The tables already exist. To wipe everything and reload the seed content, open the same address with <code>&amp;force=1</code> added. <b>This deletes all current data.</b></p>');
  }

  const dir = path.join(process.cwd(), 'database');
  const started = Date.now();
  try {
    const schema = await fs.readFile(path.join(dir, 'schema.sql'), 'utf8');
    const seed   = await fs.readFile(path.join(dir, 'seed.sql'), 'utf8');
    const client = await db().connect();
    try {
      await client.query(schema);
      await client.query(seed);
    } finally {
      client.release();
    }
    const counts = await fetchValue<Record<string, number>>(
      `SELECT json_build_object('semesters',(SELECT COUNT(*) FROM semesters),'subjects',(SELECT COUNT(*) FROM subjects),
                                'lessons',(SELECT COUNT(*) FROM lessons),'users',(SELECT COUNT(*) FROM users)) AS c`, [], {});
    return page('Installed ✓',
      `<p>Tables created and content loaded in ${((Date.now() - started) / 1000).toFixed(1)} s.</p><pre>${JSON.stringify(counts, null, 2)}</pre>
       <p>Sign in at <a href="/login">/login</a> with <code>admin@midwifery.edu</code> / <code>admin123</code> and change the demo passwords.
       Then remove <code>SETUP_TOKEN</code> from the environment.</p>`);
  } catch (e) {
    return page('Setup failed', `<pre>${String(e instanceof Error ? e.message : e).replace(/</g, '&lt;')}</pre>`, 500);
  }
}
