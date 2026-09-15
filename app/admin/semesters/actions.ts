'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { fetchValue, q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function saveSemester(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  const data = [
    str(fd, 'number') !== '' ? toInt(fd.get('number'), 1) : 1,
    str(fd, 'title'),
    str(fd, 'description'),
    toInt(fd.get('sort_order')),
    fd.get('is_active') ? true : false,
  ];

  if (data[1] === '') {
    await flash('error', 'The semester title is required.');
  } else if (id) {
    await q('UPDATE semesters SET number=?, title=?, description=?, sort_order=?, is_active=? WHERE id=?', [...data, id]);
    await flash('success', 'Semester updated.');
  } else {
    try {
      await q('INSERT INTO semesters (number,title,description,sort_order,is_active) VALUES (?,?,?,?,?)', data);
      await flash('success', 'Semester created.');
    } catch {
      await flash('error', 'A semester with that number already exists.');
    }
  }
  redirect('/admin/semesters');
}

export async function deleteSemester(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  if (id) {
    const subjects = toInt(await fetchValue('SELECT COUNT(*) FROM subjects WHERE semester_id = ?', [id], 0));
    if (subjects > 0) {
      await flash('error', `Remove or move the ${subjects} subject(s) in this semester first.`);
    } else {
      await q('DELETE FROM semesters WHERE id = ?', [id]);
      await flash('success', 'Semester deleted.');
    }
  }
  redirect('/admin/semesters');
}
