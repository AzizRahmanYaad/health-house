import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { fetchOne, toInt } from '@/lib/db';
import LessonEditor, { type LessonRow } from '../LessonEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit lesson' };

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const id = toInt((await params).id);
  const lesson = id ? await fetchOne<LessonRow>('SELECT * FROM lessons WHERE id = ?', [id]) : null;
  if (!lesson) redirect('/admin/lessons');
  return <LessonEditor user={user} lesson={lesson} subjectId={lesson.subject_id} />;
}
