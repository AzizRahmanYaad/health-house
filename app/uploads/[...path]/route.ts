/**
 * Serves uploaded files (videos, PDFs, slides, resources, avatars) from
 * UPLOAD_PATH. Replaces the static uploads/ folder of the PHP portal,
 * including its .htaccess rules: correct MIME types, Accept-Ranges so
 * students can seek inside a video, nosniff, and no script execution.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { UPLOAD_PATH } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odp: 'application/vnd.oasis.opendocument.presentation', key: 'application/octet-stream',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf', txt: 'text/plain; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv; charset=utf-8',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  vtt: 'text/vtt; charset=utf-8', srt: 'text/plain; charset=utf-8',
};

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  if (!parts?.length || parts.some(p => p === '..' || p.startsWith('.') || p === 'tmp')) {
    return new Response('Not found', { status: 404 });
  }

  const abs = path.join(UPLOAD_PATH, ...parts);
  if (!abs.startsWith(UPLOAD_PATH)) return new Response('Not found', { status: 404 });

  let stat: fs.Stats;
  try {
    stat = await fsp.stat(abs);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const ext = path.extname(abs).slice(1).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'Last-Modified': stat.mtime.toUTCString(),
  };
  /* never let the browser run anything from here */
  if (!type.startsWith('video/') && !type.startsWith('audio/') && !type.startsWith('image/') && type !== 'application/pdf') {
    headers['Content-Disposition'] = 'attachment; filename="' + path.basename(abs).replace(/"/g, '') + '"';
  }

  const range = req.headers.get('range');
  const size = stat.size;

  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end   = m[2] ? parseInt(m[2], 10) : size - 1;
      if (!m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
      if (start >= size || end >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      }
      headers['Content-Range']  = `bytes ${start}-${end}/${size}`;
      headers['Content-Length'] = String(end - start + 1);
      const stream = Readable.toWeb(fs.createReadStream(abs, { start, end })) as ReadableStream;
      return new Response(stream, { status: 206, headers });
    }
  }

  headers['Content-Length'] = String(size);
  const stream = Readable.toWeb(fs.createReadStream(abs)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}
