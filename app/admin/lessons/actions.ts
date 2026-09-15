'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';
import { deleteUpload } from '@/lib/uploads';

function back(fd: FormData) {
  return '/admin/lessons?subject=' + toInt(fd.get('subject_filter'));
}

export async function reorderLessons(fd: FormData) {
  await requireAdmin();
  for (const [key, val] of fd.entries()) {
    let m = key.match(/^order\[(\d+)\]$/);
    if (m) { await q('UPDATE lessons SET sort_order = ? WHERE id = ?', [toInt(val), toInt(m[1])]); continue; }
    m = key.match(/^day\[(\d+)\]$/);
    if (m) await q('UPDATE lessons SET recommended_day = ? WHERE id = ?', [Math.max(1, toInt(val)), toInt(m[1])]);
  }
  await flash('success', 'Lesson sequence and recommended days saved.');
  redirect(back(fd));
}

export async function deleteLesson(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  const l = await fetchOne<{ video_file: string | null }>('SELECT video_file FROM lessons WHERE id = ?', [id]);
  for (const m of await fetchAll<{ file_path: string | null }>('SELECT file_path FROM lesson_materials WHERE lesson_id = ?', [id])) {
    await deleteUpload(m.file_path);
  }
  if (l?.video_file) await deleteUpload('videos/' + l.video_file);
  await q('DELETE FROM lessons WHERE id = ?', [id]);
  await flash('success', 'Lesson deleted.');
  redirect(back(fd));
}

export async function toggleLesson(fd: FormData) {
  await requireAdmin();
  await q('UPDATE lessons SET is_active = NOT is_active WHERE id = ?', [toInt(fd.get('id'))]);
  await flash('success', 'Lesson visibility changed.');
  redirect(back(fd));
}
