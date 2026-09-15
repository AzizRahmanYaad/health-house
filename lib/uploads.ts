/**
 * FILE UPLOADS — store a file from a multipart form under UPLOAD_PATH.
 * Mirrors uploadFile() / deleteUpload() of config/functions.php.
 */
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { MAX_UPLOAD_SIZE, UPLOAD_DIR } from './config';
import { flash } from './session';

/** Absolute path of the upload folder. */
export const UPLOAD_PATH = path.resolve(process.cwd(), UPLOAD_DIR);

export interface StoredUpload { name: string; size: number; ext: string }

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** "My Lecture (1).mp4" -> "My-Lecture-1-20260915120000-a1b2c3.mp4" */
export function safeFileName(original: string, ext: string, fallback = 'file'): string {
  const base = path.basename(original, path.extname(original));
  let safe = base.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 60).replace(/^-+|-+$/g, '');
  if (!safe) safe = fallback;
  return `${safe}-${stamp()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
}

export function extOf(name: string): string {
  return path.extname(name).slice(1).toLowerCase();
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Save a File from FormData. Returns null (after queuing a flash) when the
 * field is empty or the file is rejected.
 */
export async function uploadFile(fd: FormData, field: string, subdir: string, allowedExt: string[]): Promise<StoredUpload | null> {
  const f = fd.get(field);
  if (!(f instanceof File) || f.size === 0 || !f.name) return null;

  if (f.size > MAX_UPLOAD_SIZE) {
    await flash('error', 'File is too large.');
    return null;
  }
  const ext = extOf(f.name);
  if (!allowedExt.includes(ext)) {
    await flash('error', `File type ".${ext}" is not allowed here.`);
    return null;
  }

  const dir = path.join(UPLOAD_PATH, subdir);
  try {
    await ensureDir(dir);
  } catch {
    await flash('error', 'Upload folder is not writable.');
    return null;
  }

  const name = safeFileName(f.name, ext);
  try {
    await fs.writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
  } catch {
    await flash('error', 'Could not save the uploaded file.');
    return null;
  }
  return { name, size: f.size, ext };
}

export async function deleteUpload(relative: string | null | undefined): Promise<void> {
  if (!relative) return;
  const clean = relative.replace(/\.\./g, '').replace(/\\/g, '/');
  const p = path.join(UPLOAD_PATH, clean);
  if (!p.startsWith(UPLOAD_PATH)) return;
  try { await fs.unlink(p); } catch { /* already gone */ }
}

export async function uploadExists(relative: string): Promise<boolean> {
  const p = path.join(UPLOAD_PATH, relative.replace(/\.\./g, ''));
  try { return (await fs.stat(p)).isFile(); } catch { return false; }
}

export async function uploadSize(relative: string): Promise<number> {
  const p = path.join(UPLOAD_PATH, relative.replace(/\.\./g, ''));
  try { return (await fs.stat(p)).size; } catch { return 0; }
}

export async function uploadsWritable(): Promise<boolean> {
  try { await fs.access(UPLOAD_PATH, fs.constants.W_OK); return true; } catch { return false; }
}
