'use server';

import { redirect } from 'next/navigation';
import { logActivity, requireStudent } from '@/lib/auth';
import { fetchOne, toInt } from '@/lib/db';
import { toggleBookmark } from '@/lib/lms';
import { markLessonStatus } from '@/lib/progress';
import { flash } from '@/lib/session';

async function loadLesson(lessonId: number) {
  return fetchOne<{ id: number; title: string; subject_id: number; sort_order: number }>(
    'SELECT id, title, subject_id, sort_order FROM lessons WHERE id = ? AND is_active = TRUE', [lessonId]);
}

export async function completeLesson(fd: FormData) {
  const user = await requireStudent();
  const lessonId = toInt(fd.get('lesson_id'));
  const lesson = await loadLesson(lessonId);
  if (!lesson) redirect('/student/learning');

  await markLessonStatus(user.id, lessonId, 'completed');
  await logActivity(user.id, 'lesson_completed', lesson.title);
  await flash('success', 'Lesson marked as completed. Well done!');

  const nx = await fetchOne<{ id: number }>(
    `SELECT id FROM lessons WHERE subject_id = ? AND is_active = TRUE
       AND (sort_order > ? OR (sort_order = ? AND id > ?))
     ORDER BY sort_order, id LIMIT 1`,
    [lesson.subject_id, lesson.sort_order, lesson.sort_order, lessonId]);
  redirect(`/student/lesson/${nx ? nx.id : lessonId}?done=1`);
}

export async function reopenLesson(fd: FormData) {
  const user = await requireStudent();
  const lessonId = toInt(fd.get('lesson_id'));
  if (!(await loadLesson(lessonId))) redirect('/student/learning');

  await markLessonStatus(user.id, lessonId, 'in_progress');
  await flash('info', 'Lesson reopened — it is back in your learning queue.');
  redirect(`/student/lesson/${lessonId}`);
}

export async function bookmarkLesson(fd: FormData) {
  const user = await requireStudent();
  const lessonId = toInt(fd.get('lesson_id'));
  if (!(await loadLesson(lessonId))) redirect('/student/learning');

  const now = await toggleBookmark(user.id, lessonId);
  await flash('info', now ? 'Saved. You will find it under Saved lessons.' : 'Removed from your saved lessons.');
  redirect(`/student/lesson/${lessonId}`);
}
