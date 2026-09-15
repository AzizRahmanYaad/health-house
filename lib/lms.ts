/**
 * Timetable, subtitles and bookmarks — the remaining data helpers from
 * config/functions.php.
 */
import 'server-only';
import { fetchAll, fetchOne, fetchValue, q, toInt } from './db';
import { todayDow } from './text';

/* =====================================================================
 *  TIMETABLE  (RECOMMENDATION ONLY — NEVER ATTENDANCE)
 * ===================================================================*/

export interface TimetableRow {
  id: number; semester_id: number; subject_id: number; lesson_id: number | null;
  day_of_week: number; start_time: string; end_time: string; room: string | null; note: string | null;
  subject_title: string; color: string; lesson_title: string | null; lesson_status: string;
}

/** Timetable rows for a semester + whether the student already completed them. */
export async function timetableForSemester(semesterId: number, userId: number | null = null, dow: number | null = null): Promise<TimetableRow[]> {
  let sql = `SELECT t.*, s.title AS subject_title, s.color, l.title AS lesson_title,
                    COALESCE(lp.status, 'not_started') AS lesson_status
               FROM timetable t
               JOIN subjects s ON s.id = t.subject_id
               LEFT JOIN lessons l ON l.id = t.lesson_id
               LEFT JOIN lesson_progress lp ON lp.lesson_id = t.lesson_id AND lp.user_id = ?
              WHERE t.semester_id = ?`;
  const params: unknown[] = [userId || 0, semesterId];
  if (dow !== null) { sql += ' AND t.day_of_week = ?'; params.push(dow); }
  sql += ' ORDER BY t.day_of_week, t.start_time';
  return fetchAll<TimetableRow>(sql, params);
}

/** Lessons recommended by the curriculum for "today", plus what is done. */
export async function todaysRecommendation(userId: number, semesterId: number | null) {
  if (!semesterId) return { items: [] as TimetableRow[], recommended: 0, completed: 0, remaining: 0 };
  const items = await timetableForSemester(semesterId, userId, todayDow());
  const completed = items.filter(i => i.lesson_status === 'completed').length;
  return { items, recommended: items.length, completed, remaining: Math.max(0, items.length - completed) };
}

/* =====================================================================
 *  SUBTITLES  (WebVTT, stored in the database)
 * ===================================================================*/

export interface Subtitle {
  id: number; lesson_id: number; lang: string; label: string; direction: 'rtl' | 'ltr';
  vtt: string; is_default: boolean; updated_at: Date;
}

export async function lessonSubtitles(lessonId: number): Promise<Subtitle[]> {
  return fetchAll<Subtitle>('SELECT * FROM lesson_subtitles WHERE lesson_id = ? ORDER BY is_default DESC, lang', [lessonId]);
}

export async function lessonSubtitle(lessonId: number, lang = 'ps'): Promise<Subtitle | null> {
  return fetchOne<Subtitle>('SELECT * FROM lesson_subtitles WHERE lesson_id = ? AND lang = ?', [lessonId, lang]);
}

/**
 * Normalise pasted caption text into valid WebVTT.
 * Accepts WebVTT already, SubRip (.srt), or plain "00:00 text" lines.
 */
export function normaliseVtt(raw: string): string {
  raw = raw.replace(/\r\n|\r/g, '\n').trim();
  if (raw === '') return '';
  raw = raw.replace(/^﻿/, '');                                        // BOM from Notepad
  raw = raw.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');              // SubRip comma -> dot
  raw = raw.replace(/^\d+\n(?=\d{2}:\d{2})/gm, '');                        // SubRip sequence numbers
  if (!/^WEBVTT/i.test(raw)) raw = 'WEBVTT\n\n' + raw;
  return raw;
}

/** Very light validation so a broken paste is caught before it is saved. */
export function vttCueCount(vtt: string): number {
  return (vtt.match(/\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}\s*-->/g) || []).length;
}

/* =====================================================================
 *  SAVED LESSONS  (bookmarks)
 * ===================================================================*/

export async function isBookmarked(userId: number, lessonId: number): Promise<boolean> {
  return !!(await fetchValue('SELECT 1 FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?', [userId, lessonId], null));
}

/** Save or unsave a lesson. Returns the state it ended up in. */
export async function toggleBookmark(userId: number, lessonId: number): Promise<boolean> {
  if (await isBookmarked(userId, lessonId)) {
    await q('DELETE FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?', [userId, lessonId]);
    return false;
  }
  await q('INSERT INTO lesson_bookmarks (user_id, lesson_id) VALUES (?, ?)', [userId, lessonId]);
  return true;
}

export async function bookmarkCount(userId: number): Promise<number> {
  return toInt(await fetchValue('SELECT COUNT(*) FROM lesson_bookmarks WHERE user_id = ?', [userId], 0));
}

/* =====================================================================
 *  SETTINGS
 * ===================================================================*/

export async function allSettings(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of await fetchAll<{ skey: string; svalue: string | null }>('SELECT * FROM settings')) {
    out[r.skey] = r.svalue ?? '';
  }
  return out;
}
