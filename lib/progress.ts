/**
 * PROGRESS ENGINE
 * Progress = completed required lessons / total active lessons.
 * Mirrors the PROGRESS ENGINE section of config/functions.php.
 */
import 'server-only';
import { fetchAll, fetchOne, fetchValue, q, toInt } from './db';

export function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export interface SubjectProgress {
  total: number; completed: number; in_progress: number; remaining: number; percent: number;
}

/** Progress for every subject of a semester, keyed by subject id. */
export async function subjectProgressMap(userId: number, semesterId: number | null = null): Promise<Record<number, SubjectProgress>> {
  const params: unknown[] = [userId];
  let where = '';
  if (semesterId) { where = ' AND s.semester_id = ?'; params.push(semesterId); }

  const rows = await fetchAll(
    `SELECT s.id AS subject_id,
            COUNT(l.id) AS total,
            COUNT(*) FILTER (WHERE lp.status = 'completed')   AS completed,
            COUNT(*) FILTER (WHERE lp.status = 'in_progress') AS in_progress
       FROM subjects s
       LEFT JOIN lessons l ON l.subject_id = s.id AND l.is_active = TRUE
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE s.is_active = TRUE${where}
      GROUP BY s.id`, params);

  const map: Record<number, SubjectProgress> = {};
  for (const r of rows) {
    const total = toInt(r.total), done = toInt(r.completed);
    map[toInt(r.subject_id)] = {
      total, completed: done, in_progress: toInt(r.in_progress),
      remaining: Math.max(0, total - done), percent: pct(done, total),
    };
  }
  return map;
}

export async function subjectProgress(userId: number, subjectId: number) {
  const row = await fetchOne(
    `SELECT COUNT(l.id) AS total,
            COUNT(*) FILTER (WHERE lp.status = 'completed') AS completed
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE l.subject_id = ? AND l.is_active = TRUE`, [userId, subjectId]);
  const total = toInt(row?.total), done = toInt(row?.completed);
  return { total, completed: done, remaining: Math.max(0, total - done), percent: pct(done, total) };
}

export interface SemesterProgress {
  total: number; completed: number; remaining: number; percent: number; locked: boolean; status: string;
}

/** Progress for all six semesters, keyed by semester id. */
export async function semesterProgressMap(userId: number): Promise<Record<number, SemesterProgress>> {
  const rows = await fetchAll(
    `SELECT sem.id AS semester_id,
            COUNT(l.id) AS total,
            COUNT(*) FILTER (WHERE lp.status = 'completed') AS completed
       FROM semesters sem
       LEFT JOIN subjects s ON s.semester_id = sem.id AND s.is_active = TRUE
       LEFT JOIN lessons  l ON l.subject_id  = s.id  AND l.is_active = TRUE
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      GROUP BY sem.id`, [userId]);

  const map: Record<number, SemesterProgress> = {};
  for (const r of rows) {
    const total = toInt(r.total), done = toInt(r.completed);
    /* A semester with no published lessons is not "0% complete" — there is
       nothing there to complete. It reads as locked, and unlocks by itself
       as soon as its curriculum is loaded. */
    const locked = total === 0;
    map[toInt(r.semester_id)] = {
      total, completed: done, remaining: Math.max(0, total - done), percent: pct(done, total), locked,
      status: locked ? 'Not yet available' : (done === 0 ? 'Not Started' : (done >= total ? 'Completed' : 'In Progress')),
    };
  }
  return map;
}

export async function overallProgress(userId: number) {
  const row = await fetchOne(
    `SELECT COUNT(l.id) AS total,
            COUNT(*) FILTER (WHERE lp.status = 'completed') AS completed
       FROM lessons l
       JOIN subjects s ON s.id = l.subject_id AND s.is_active = TRUE
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE l.is_active = TRUE`, [userId]);
  const total = toInt(row?.total), done = toInt(row?.completed);
  return { total, completed: done, percent: pct(done, total) };
}

export interface NextLesson {
  id: number; title: string; subject_id: number; subject_title: string; color: string;
  semester_id: number; semester_number: number; semester_title: string; status: string;
  [k: string]: unknown;
}

/**
 * The next lesson the student should study, following the configured
 * sequence: semester order -> subject order -> lesson order.
 * Preference is given to the student's own semester.
 */
export async function nextLesson(userId: number, preferSemesterId: number | null = null): Promise<NextLesson | null> {
  let sql = `SELECT l.*, s.title AS subject_title, s.id AS subject_id, s.color,
                    sem.id AS semester_id, sem.number AS semester_number, sem.title AS semester_title,
                    COALESCE(lp.status, 'not_started') AS status
               FROM lessons l
               JOIN subjects  s   ON s.id = l.subject_id AND s.is_active = TRUE
               JOIN semesters sem ON sem.id = s.semester_id AND sem.is_active = TRUE
               LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
              WHERE l.is_active = TRUE
                AND COALESCE(lp.status, 'not_started') <> 'completed'`;
  const params: unknown[] = [userId];
  if (preferSemesterId) { sql += ' AND sem.id = ?'; params.push(preferSemesterId); }

  // in_progress first, then not started - both in curriculum order
  sql += ` ORDER BY (COALESCE(lp.status,'not_started') = 'in_progress') DESC,
                    sem.sort_order, sem.number, s.sort_order, s.id, l.sort_order, l.id
           LIMIT 1`;

  const row = await fetchOne<NextLesson>(sql, params);
  if (!row && preferSemesterId) return nextLesson(userId, null);   // fall through to later semesters
  return row;
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export async function lessonStatus(userId: number, lessonId: number): Promise<LessonStatus> {
  return fetchValue<LessonStatus>(
    'SELECT status FROM lesson_progress WHERE user_id = ? AND lesson_id = ?', [userId, lessonId], 'not_started');
}

export async function markLessonStatus(userId: number, lessonId: number, status: LessonStatus): Promise<void> {
  if (!['not_started', 'in_progress', 'completed'].includes(status)) return;
  const completedAt = status === 'completed' ? new Date() : null;
  await q(
    `INSERT INTO lesson_progress (user_id, lesson_id, status, started_at, completed_at)
          VALUES (?,?,?,NOW(),?)
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          status       = EXCLUDED.status,
          started_at   = COALESCE(lesson_progress.started_at, NOW()),
          completed_at = EXCLUDED.completed_at`,
    [userId, lessonId, status, completedAt]);
}

/** Touch a lesson as "in progress" the first time a student opens it. */
export async function touchLesson(userId: number, lessonId: number): Promise<void> {
  await q(
    `INSERT INTO lesson_progress (user_id, lesson_id, status, started_at)
          VALUES (?,?,'in_progress',NOW())
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          status     = CASE WHEN lesson_progress.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
          started_at = COALESCE(lesson_progress.started_at, NOW())`,
    [userId, lessonId]);
}

/* =====================================================================
 *  DIFFICULTY / SUBJECT FACTS
 * ===================================================================*/

export interface SubjectFacts { minutes: number; level: string }

/**
 * Extra facts a topic card needs, for a batch of subjects at once:
 * total minutes, and the difficulty of the next lesson the student would
 * open (a finished subject reports the level of its last lesson).
 */
export async function subjectFacts(userId: number, subjectIds: number[]): Promise<Record<number, SubjectFacts>> {
  const ids = subjectIds.map(Number).filter(n => n > 0);
  const out: Record<number, SubjectFacts & { seen?: boolean }> = {};
  if (!ids.length) return out;

  for (const r of await fetchAll(
    `SELECT subject_id, COALESCE(SUM(duration_minutes),0) AS minutes
       FROM lessons WHERE subject_id = ANY(?) AND is_active = TRUE
      GROUP BY subject_id`, [ids])) {
    out[toInt(r.subject_id)] = { minutes: toInt(r.minutes), level: 'core' };
  }

  /* the first lesson of each subject the student has not completed */
  for (const r of await fetchAll(
    `SELECT l.subject_id, l.difficulty
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE l.subject_id = ANY(?) AND l.is_active = TRUE
        AND COALESCE(lp.status,'not_started') <> 'completed'
      ORDER BY l.subject_id, l.sort_order, l.id`, [userId, ids])) {
    const sid = toInt(r.subject_id);
    if (!out[sid]) out[sid] = { minutes: 0, level: 'core' };
    if (!out[sid].seen) { out[sid].level = String(r.difficulty); out[sid].seen = true; }
  }

  /* subjects with nothing left take the level of their final lesson */
  for (const sid of ids) {
    if (!out[sid]) out[sid] = { minutes: 0, level: 'core' };
    if (!out[sid].seen) {
      out[sid].level = await fetchValue<string>(
        `SELECT difficulty FROM lessons WHERE subject_id = ? AND is_active = TRUE
          ORDER BY sort_order DESC, id DESC LIMIT 1`, [sid], 'core');
    }
    delete out[sid].seen;
  }
  return out;
}
