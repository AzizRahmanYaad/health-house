import { requireAdmin } from '@/lib/auth';
import { toInt } from '@/lib/db';
import QuizEditor from './QuizEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New quiz' };

/** /admin/quiz?lesson=N — create a quiz, optionally pre-attached to a lesson. */
export default async function NewQuizPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const user = await requireAdmin('/admin/quiz');
  return <QuizEditor user={user} quiz={null} preLesson={toInt((await searchParams).lesson)} />;
}
