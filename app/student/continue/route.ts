/**
 * "Continue Learning" — jumps straight to the next lesson in the sequence.
 */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { nextLesson } from '@/lib/progress';
import { flash } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=/student/continue', req.url));
  if (user.role !== 'student') return NextResponse.redirect(new URL('/admin/dashboard', req.url));

  const next = await nextLesson(user.id, user.semester_id ?? null);
  if (next) return NextResponse.redirect(new URL(`/student/lesson/${next.id}`, req.url));

  await flash('success', 'You have completed every lesson currently available. Congratulations!');
  return NextResponse.redirect(new URL('/student/dashboard', req.url));
}
