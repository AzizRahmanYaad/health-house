'use server';

import { redirect } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { toInt } from '@/lib/db';
import { toggleBookmark } from '@/lib/lms';
import { flash } from '@/lib/session';

export async function removeSaved(fd: FormData) {
  const user = await requireStudent();
  const lessonId = toInt(fd.get('lesson_id'));
  if (lessonId) {
    await toggleBookmark(user.id, lessonId);
    await flash('info', 'Removed from your saved lessons.');
  }
  redirect('/student/saved');
}
