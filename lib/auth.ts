/**
 * Authentication: current user, role guards, sign-in, activity log.
 * Mirrors the AUTHENTICATION section of config/functions.php.
 */
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { fetchOne, q } from './db';
import { readSession, writeSession } from './session';

export interface User {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'student';
  student_code: string | null;
  phone: string | null;
  avatar: string | null;
  semester_id: number | null;
  status: 'active' | 'inactive';
  last_login_at: Date | null;
  created_at: Date;
}

/** The signed-in user, cached for the duration of one request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const s = await readSession();
  if (!s.uid) return null;
  return fetchOne<User>("SELECT * FROM users WHERE id = ? AND status = 'active'", [s.uid]);
});

export async function isLoggedIn(): Promise<boolean> {
  return (await currentUser()) !== null;
}

export async function isAdmin(): Promise<boolean> {
  const u = await currentUser();
  return !!u && u.role === 'admin';
}

/**
 * Guards. `redirect()` throws, so the return type is the non-null user.
 * The "intended" URL is remembered through the login form's ?next= parameter
 * (a Server Component cannot write cookies).
 */
export async function requireLogin(intended?: string): Promise<User> {
  const u = await currentUser();
  if (!u) {
    redirect('/login' + (intended ? '?next=' + encodeURIComponent(intended) : ''));
  }
  return u;
}

export async function requireAdmin(intended?: string): Promise<User> {
  const u = await requireLogin(intended);
  if (u.role !== 'admin') redirect('/student/dashboard');
  return u;
}

export async function requireStudent(intended?: string): Promise<User> {
  const u = await requireLogin(intended);
  if (u.role !== 'student') redirect('/admin/dashboard');
  return u;
}

/**
 * PHP's password_hash() writes "$2y$" bcrypt hashes; bcryptjs understands the
 * identical "$2a$"/"$2b$" forms, so the prefix is normalised before checking.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  const h = hash.replace(/^\$2y\$/, '$2a$');
  try { return await bcrypt.compare(plain, h); } catch { return false; }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Server Action only (writes the session cookie). */
export async function attemptLogin(email: string, password: string): Promise<User | null> {
  const user = await fetchOne<User>('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || user.status !== 'active') return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;

  await writeSession({ uid: user.id });
  await q('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await logActivity(user.id, 'login', user.role);
  return user;
}

export async function logActivity(userId: number | null, action: string, detail: string | null = null): Promise<void> {
  try {
    await q('INSERT INTO activity_log (user_id, action, detail) VALUES (?,?,?)', [userId, action, detail]);
  } catch {
    // logging must never break the request
  }
}
