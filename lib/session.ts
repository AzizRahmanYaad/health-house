/**
 * Session cookie (signed JWT, HttpOnly, SameSite=Lax) and flash messages.
 *
 * The PHP portal kept user_id / intended URL / flashes in a server-side
 * PHP session. Here the same three things live in two cookies:
 *   hh_session — signed, HttpOnly: { uid, intended? }
 *   hh_flash   — plain JSON, read once by the client and cleared there
 */
import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { FLASH_COOKIE, SESSION_COOKIE, SESSION_SECRET } from './config';

const key = new TextEncoder().encode(SESSION_SECRET);

export interface SessionData {
  uid?: number;
  intended?: string;
}

export async function readSession(): Promise<SessionData> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return {};
  try {
    const { payload } = await jwtVerify(raw, key, { algorithms: ['HS256'] });
    return {
      uid:      typeof payload.uid === 'number' ? payload.uid : undefined,
      intended: typeof payload.intended === 'string' ? payload.intended : undefined,
    };
  } catch {
    return {};
  }
}

/** Only callable from a Server Action or Route Handler (cookies are writable there). */
export async function writeSession(data: SessionData): Promise<void> {
  const jar = await cookies();
  if (!data.uid && !data.intended) {
    jar.delete(SESSION_COOKIE);
    return;
  }
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(key);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/* ------------------------------ flashes ------------------------------ */

export type FlashType = 'success' | 'error' | 'warning' | 'info';
export interface Flash { type: FlashType; message: string }

/** Queue a message for the next page. Server Actions / Route Handlers only. */
export async function flash(type: FlashType, message: string): Promise<void> {
  const jar = await cookies();
  let list: Flash[] = [];
  try { list = JSON.parse(jar.get(FLASH_COOKIE)?.value || '[]'); } catch { list = []; }
  list.push({ type, message });
  jar.set(FLASH_COOKIE, JSON.stringify(list), {
    httpOnly: false,           // the browser deletes it after showing the toasts
    sameSite: 'lax',
    path: '/',
    maxAge: 120,
  });
}

/** Read the pending flashes (Server Components can read, not clear, cookies). */
export async function peekFlashes(): Promise<Flash[]> {
  const jar = await cookies();
  try { return JSON.parse(jar.get(FLASH_COOKIE)?.value || '[]'); } catch { return []; }
}
