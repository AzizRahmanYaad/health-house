'use server';

import { redirect } from 'next/navigation';
import { logActivity, requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, fetchValue, toInt, transaction } from '@/lib/db';
import { markLessonStatus } from '@/lib/progress';
import { flash } from '@/lib/session';

interface Quiz { id: number; title: string; lesson_id: number | null; passing_score: number; max_attempts: number }
interface Question { id: number; marks: number }
interface Option { id: number; question_id: number; is_correct: boolean }

/** Grade a submitted quiz, store the attempt, and open the result page. */
export async function submitQuiz(fd: FormData) {
  const user = await requireStudent();
  const uid = user.id;
  const quizId = toInt(fd.get('quiz_id'));

  const quiz = await fetchOne<Quiz>('SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE', [quizId]);
  if (!quiz) { await flash('error', 'That quiz could not be found.'); redirect('/student/dashboard'); }

  const used = toInt(await fetchValue('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND completed_at IS NOT NULL', [quizId, uid], 0));
  if (used >= quiz.max_attempts) {
    await flash('error', `You have used all ${quiz.max_attempts} attempts for this quiz.`);
    redirect(quiz.lesson_id ? `/student/lesson/${quiz.lesson_id}` : '/student/results');
  }

  const questions = await fetchAll<Question>('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id', [quizId]);
  const options: Record<number, Option[]> = {};
  for (const o of await fetchAll<Option>(
    `SELECT o.* FROM quiz_options o JOIN quiz_questions q ON q.id = o.question_id
      WHERE q.quiz_id = ? ORDER BY o.sort_order, o.id`, [quizId])) {
    (options[o.question_id] ||= []).push(o);
  }

  /* --------------------------- grading --------------------------- */
  let totalMarks = 0, score = 0;
  const rows: [number, string, boolean][] = [];

  for (const qq of questions) {
    const marks = Number(qq.marks);
    totalMarks += marks;

    const correct = (options[qq.id] ?? []).filter(o => o.is_correct).map(o => o.id).sort((a, b) => a - b);
    const given = [...new Set(fd.getAll(`q[${qq.id}]`).map(v => toInt(v)).filter(v => v > 0))].sort((a, b) => a - b);

    const isCorrect = given.length > 0 && given.length === correct.length && given.every((v, i) => v === correct[i]);
    if (isCorrect) score += marks;
    rows.push([qq.id, given.join(','), isCorrect]);
  }

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0;
  const passed = percentage >= Number(quiz.passing_score);

  let attemptId = 0;
  try {
    attemptId = await transaction(async (c) => {
      const r = await c.query(
        `INSERT INTO quiz_attempts (quiz_id, user_id, score, total_marks, percentage, passed, started_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING id`,
        [quizId, uid, score, totalMarks, percentage, passed]);
      const id = toInt(r.rows[0].id);
      for (const [qid, sel, ok] of rows) {
        await c.query('INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_ids, is_correct) VALUES ($1,$2,$3,$4)', [id, qid, sel, ok]);
      }
      return id;
    });
  } catch {
    await flash('error', 'Your answers could not be saved. Please try again.');
    redirect(`/student/quiz/${quizId}`);
  }

  /* Passing a lesson quiz also marks the lesson as completed. */
  if (passed && quiz.lesson_id) await markLessonStatus(uid, quiz.lesson_id, 'completed');

  await logActivity(uid, 'quiz_attempt', `${quiz.title} — ${percentage}%`);
  redirect(`/student/result/${attemptId}`);
}
