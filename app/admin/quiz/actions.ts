'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { fetchValue, q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function saveQuiz(fd: FormData) {
  await requireAdmin();
  let quizId = toInt(fd.get('id'));
  const title = str(fd, 'title');
  const lesson = toInt(fd.get('lesson_id')) || null;

  if (title === '') {
    await flash('error', 'The quiz needs a title.');
  } else {
    const data = [
      lesson, title, str(fd, 'description'),
      Math.min(100, Math.max(0, toInt(fd.get('passing_score'), 60))),
      Math.max(1, toInt(fd.get('max_attempts'), 3)),
      Math.max(0, toInt(fd.get('time_limit'))),
      fd.get('shuffle') ? true : false,
      fd.get('is_active') ? true : false,
    ];
    if (quizId) {
      await q('UPDATE quizzes SET lesson_id=?, title=?, description=?, passing_score=?, max_attempts=?, time_limit=?, shuffle=?, is_active=? WHERE id=?', [...data, quizId]);
      await flash('success', 'Quiz saved.');
    } else {
      const r = await q<{ id: number }>('INSERT INTO quizzes (lesson_id,title,description,passing_score,max_attempts,time_limit,shuffle,is_active) VALUES (?,?,?,?,?,?,?,?) RETURNING id', data);
      quizId = toInt(r.rows[0].id);
      await flash('success', 'Quiz created — now add the questions.');
    }
  }
  redirect(quizId ? `/admin/quiz/${quizId}` : '/admin/quizzes');
}

export async function addQuestion(fd: FormData) {
  await requireAdmin();
  const quizId = toInt(fd.get('id'));
  if (!quizId) redirect('/admin/quizzes');

  const text = str(fd, 'question');
  const type = str(fd, 'qtype') || 'single';
  let opts = fd.getAll('options[]').map(v => String(v).trim()).filter(v => v.length);
  let correct = fd.getAll('correct[]').map(v => toInt(v));

  if (type === 'truefalse') {
    opts = ['True', 'False'];
    correct = [toInt(fd.get('tf_correct'), 0)];
  }

  if (text === '') {
    await flash('error', 'Write the question text.');
  } else if (opts.length < 2) {
    await flash('error', 'Provide at least two answer options.');
  } else if (!correct.length) {
    await flash('error', 'Mark at least one option as correct.');
  } else {
    const next = toInt(await fetchValue('SELECT COALESCE(MAX(sort_order),0)+1 FROM quiz_questions WHERE quiz_id = ?', [quizId], 1));
    const r = await q<{ id: number }>('INSERT INTO quiz_questions (quiz_id,question,type,marks,explanation,sort_order) VALUES (?,?,?,?,?,?) RETURNING id',
      [quizId, text, type, Math.max(1, toInt(fd.get('marks'), 1)), str(fd, 'explanation'), next]);
    const qid = toInt(r.rows[0].id);
    for (let i = 0; i < opts.length; i++) {
      await q('INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES (?,?,?,?)', [qid, opts[i], correct.includes(i), i + 1]);
    }
    await flash('success', 'Question added.');
  }
  redirect(`/admin/quiz/${quizId}`);
}

export async function deleteQuestion(fd: FormData) {
  await requireAdmin();
  const quizId = toInt(fd.get('id'));
  await q('DELETE FROM quiz_questions WHERE id = ? AND quiz_id = ?', [toInt(fd.get('question_id')), quizId]);
  await flash('success', 'Question removed.');
  redirect(`/admin/quiz/${quizId}`);
}
