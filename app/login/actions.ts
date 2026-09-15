'use server';

import { redirect } from 'next/navigation';
import { attemptLogin } from '@/lib/auth';
import { flash } from '@/lib/session';

export interface LoginState { error: string; email: string }

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email    = String(fd.get('email') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  const next     = String(fd.get('next') ?? '');

  if (email === '' || password === '') {
    return { error: 'Please enter both your email and your password.', email };
  }
  const user = await attemptLogin(email, password);
  if (!user) {
    return { error: 'Those credentials do not match any active account.', email };
  }

  await flash('success', `Welcome back, ${user.full_name.split(' ')[0]}!`);

  /* only follow a same-site path, never an absolute address */
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('/login')) {
    redirect(next);
  }
  redirect(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
}
