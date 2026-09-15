import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { toInt } from '@/lib/db';
import LessonEditor from './LessonEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New lesson' };

/** /admin/lesson?subject=N — create a lesson inside a subject. */
export default async function NewLessonPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const user = await requireAdmin('/admin/lesson');
  const subjectId = toInt((await searchParams).subject);
  /* a Server Component cannot queue a flash; the lesson list explains what to do */
  if (!subjectId) redirect('/admin/lessons');
  return <LessonEditor user={user} lesson={null} subjectId={subjectId} />;
}
