'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const back = (fd: FormData) => '/admin/timetable?semester=' + (toInt(fd.get('semester_filter')) || toInt(fd.get('semester_id')));

export async function saveSlot(fd: FormData) {
  await requireAdmin();
  const sem = toInt(fd.get('semester_id'));
  const sub = toInt(fd.get('subject_id'));
  const les = toInt(fd.get('lesson_id')) || null;
  const st = str(fd, 'start_time');
  const en = str(fd, 'end_time');

  if (!sem || !sub || st === '' || en === '') {
    await flash('error', 'Semester, subject, start and end time are required.');
  } else if (en <= st) {
    await flash('error', 'The end time must be after the start time.');
  } else {
    const data = [sem, sub, les, toInt(fd.get('day_of_week')), st, en, str(fd, 'room') || null, str(fd, 'note') || null];
    const id = toInt(fd.get('id'));
    if (id) {
      await q('UPDATE timetable SET semester_id=?, subject_id=?, lesson_id=?, day_of_week=?, start_time=?, end_time=?, room=?, note=? WHERE id=?', [...data, id]);
      await flash('success', 'Timetable slot updated.');
    } else {
      await q('INSERT INTO timetable (semester_id,subject_id,lesson_id,day_of_week,start_time,end_time,room,note) VALUES (?,?,?,?,?,?,?,?)', data);
      await flash('success', 'Timetable slot added.');
    }
  }
  redirect(back(fd));
}

export async function deleteSlot(fd: FormData) {
  await requireAdmin();
  await q('DELETE FROM timetable WHERE id = ?', [toInt(fd.get('id'))]);
  await flash('success', 'Slot removed.');
  redirect(back(fd));
}

export async function clearSemester(fd: FormData) {
  await requireAdmin();
  await q('DELETE FROM timetable WHERE semester_id = ?', [toInt(fd.get('semester_id'))]);
  await flash('success', 'The timetable for that semester has been cleared.');
  redirect(back(fd));
}
