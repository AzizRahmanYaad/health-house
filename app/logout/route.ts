import { NextResponse } from 'next/server';
import { currentUser, logActivity } from '@/lib/auth';
import { destroySession, flash } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /logout — sign out and return to the login page. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (user) await logActivity(user.id, 'logout');
  await destroySession();
  await flash('info', 'You have been signed out.');
  return NextResponse.redirect(new URL('/login', req.url));
}
