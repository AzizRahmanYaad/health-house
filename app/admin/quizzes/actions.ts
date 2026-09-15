'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';

export async function deleteQuiz(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  if (id) {
    await q('DELETE FROM quizzes WHERE id = ?', [id]);
    await flash('success', 'Quiz deleted together with its questions and attempts.');
  }
  redirect('/admin/quizzes');
}

export async function toggleQuiz(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  if (id) {
    await q('UPDATE quizzes SET is_active = NOT is_active WHERE id = ?', [id]);
    await flash('success', 'Quiz visibility changed.');
  }
  redirect('/admin/quizzes');
}
