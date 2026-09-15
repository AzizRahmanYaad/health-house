/**
 * Serves a lesson's caption track as a real WebVTT file so that
 * <track kind="subtitles" src="/api/subtitle?lesson=3&lang=ps"> works.
 */
import { currentUser } from '@/lib/auth';
import { fetchOne, toInt } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response('Sign in first.', { status: 401 });

  const url = new URL(req.url);
  const lessonId = toInt(url.searchParams.get('lesson'));
  const lang = (url.searchParams.get('lang') || 'ps').replace(/[^a-zA-Z-]/g, '') || 'ps';

  const row = await fetchOne<{ vtt: string }>('SELECT vtt FROM lesson_subtitles WHERE lesson_id = ? AND lang = ?', [lessonId, lang]);
  const headers = {
    'Content-Type': 'text/vtt; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=600',
  };
  if (!row || row.vtt.trim() === '') return new Response('WEBVTT\n', { status: 404, headers });
  return new Response(row.vtt, { headers });
}
