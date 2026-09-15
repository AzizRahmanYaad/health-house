import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { fetchOne, toInt } from '@/lib/db';
import QuizEditor, { type QuizRow } from '../QuizEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit quiz' };

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const id = toInt((await params).id);
  const quiz = id ? await fetchOne<QuizRow>('SELECT * FROM quizzes WHERE id = ?', [id]) : null;
  if (!quiz) redirect('/admin/quizzes');
  return <QuizEditor user={user} quiz={quiz} />;
}
