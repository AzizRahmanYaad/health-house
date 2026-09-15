'use server';

import { redirect } from 'next/navigation';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { fetchOne, q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function back(fd: FormData) {
  const f = toInt(fd.get('semester_filter'));
  return '/admin/students' + (f ? `?semester=${f}` : '');
}

export async function saveStudent(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  const name = str(fd, 'full_name');
  const email = str(fd, 'email').toLowerCase();
  const pass = String(fd.get('password') ?? '');

  if (name === '' || email === '') {
    await flash('error', 'Name and email are required.');
  } else if (!EMAIL.test(email)) {
    await flash('error', 'That email address is not valid.');
  } else {
    const dupe = await fetchOne('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id || 0]);
    if (dupe) {
      await flash('error', 'Another account already uses that email address.');
    } else if (id) {
      await q('UPDATE users SET full_name=?, email=?, student_code=?, phone=?, semester_id=?, status=? WHERE id=? AND role = \'student\'', [
        name, email, str(fd, 'student_code') || null, str(fd, 'phone') || null,
        toInt(fd.get('semester_id')) || null, str(fd, 'status') || 'active', id,
      ]);
      if (pass !== '') {
        if (pass.length < 6) {
          await flash('error', 'The password must be at least 6 characters — it was not changed.');
        } else {
          await q('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(pass), id]);
          await flash('success', 'Password updated.');
        }
      }
      await flash('success', 'Student account updated.');
    } else if (pass.length < 6) {
      await flash('error', 'Set a password of at least 6 characters for the new student.');
    } else {
      await q(`INSERT INTO users (full_name,email,password_hash,role,student_code,phone,semester_id,status)
               VALUES (?,?,?,'student',?,?,?,?)`, [
        name, email, await hashPassword(pass),
        str(fd, 'student_code') || null, str(fd, 'phone') || null,
        toInt(fd.get('semester_id')) || null, str(fd, 'status') || 'active',
      ]);
      await flash('success', 'Student account created.');
    }
  }
  redirect(back(fd));
}

export async function deleteStudent(fd: FormData) {
  await requireAdmin();
  const id = toInt(fd.get('id'));
  if (id) {
    await q("DELETE FROM users WHERE id = ? AND role = 'student'", [id]);
    await flash('success', 'Student account and all of its progress removed.');
  }
  redirect(back(fd));
}

export async function bulkSemester(fd: FormData) {
  await requireAdmin();
  const ids = fd.getAll('student_ids[]').map(v => toInt(v)).filter(v => v > 0);
  const sem = toInt(fd.get('bulk_semester_id')) || null;
  if (ids.length) {
    await q("UPDATE users SET semester_id = ? WHERE role = 'student' AND id = ANY(?)", [sem, ids]);
    await flash('success', `${ids.length} student(s) moved.`);
  }
  redirect(back(fd));
}
