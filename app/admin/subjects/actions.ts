'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { fetchValue, q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

function back(fd: FormData) {
  const sem = toInt(fd.get('semester_filter')) || toInt(fd.get('semester_id'));
  return '/admin/subjects' + (sem ? `?semester=${sem}` : '');
}

export async function saveSubject(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  const data = [
    toInt(fd.get('semester_id')),
    str(fd, 'code') || null,
    str(fd, 'title'),
    str(fd, 'description'),
    str(fd, 'color') || '#6C4CF1',
    toInt(fd.get('credits'), 3),
    toInt(fd.get('sort_order')),
    fd.get('is_active') ? true : false,
  ];
  if (data[2] === '' || !data[0]) {
    await flash('error', 'A semester and a title are required.');
  } else if (id) {
    await q('UPDATE subjects SET semester_id=?, code=?, title=?, description=?, color=?, credits=?, sort_order=?, is_active=? WHERE id=?', [...data, id]);
    await flash('success', 'Subject updated.');
  } else {
    await q('INSERT INTO subjects (semester_id,code,title,description,color,credits,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?)', data);
    await flash('success', 'Subject created.');
  }
  redirect(back(fd));
}

export async function deleteSubject(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  if (id) {
    const lessons = toInt(await fetchValue('SELECT COUNT(*) FROM lessons WHERE subject_id = ?', [id], 0));
    await q('DELETE FROM subjects WHERE id = ?', [id]);
    await flash('success', 'Subject deleted' + (lessons ? ` together with its ${lessons} lesson(s).` : '.'));
  }
  redirect(back(fd));
}

export async function reorderSubjects(fd: FormData) {
  await requireAdmin();
  for (const [key, val] of fd.entries()) {
    const m = key.match(/^order\[(\d+)\]$/);
    if (m) await q('UPDATE subjects SET sort_order = ? WHERE id = ?', [toInt(val), toInt(m[1])]);
  }
  await flash('success', 'Subject order saved.');
  redirect(back(fd));
}
