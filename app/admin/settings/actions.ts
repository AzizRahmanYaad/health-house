'use server';

import { redirect } from 'next/navigation';
import { hashPassword, requireAdmin, verifyPassword } from '@/lib/auth';
import { fetchOne, q, toInt } from '@/lib/db';
import { flash } from '@/lib/session';
import { deleteUpload, uploadFile } from '@/lib/uploads';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateAdminProfile(fd: FormData) {
  const user = await requireAdmin();
  const name = str(fd, 'full_name');
  const email = str(fd, 'email').toLowerCase();
  if (name === '' || !EMAIL.test(email)) {
    await flash('error', 'Provide a valid name and email address.');
  } else if (await fetchOne('SELECT id FROM users WHERE email = ? AND id <> ?', [email, user.id])) {
    await flash('error', 'Another account already uses that email address.');
  } else {
    let avatar = user.avatar;
    const up = await uploadFile(fd, 'avatar', 'avatars', ['jpg', 'jpeg', 'png', 'webp', 'gif']);
    if (up) {
      await deleteUpload(avatar ? 'avatars/' + avatar : null);
      avatar = up.name;
    }
    await q('UPDATE users SET full_name=?, email=?, phone=?, avatar=? WHERE id=?', [name, email, str(fd, 'phone') || null, avatar, user.id]);
    await flash('success', 'Your administrator profile has been updated.');
  }
  redirect('/admin/settings');
}

export async function changeAdminPassword(fd: FormData) {
  const user = await requireAdmin();
  const current = String(fd.get('current_password') ?? '');
  const next = String(fd.get('new_password') ?? '');
  const confirm = String(fd.get('confirm_password') ?? '');
  if (!(await verifyPassword(current, user.password_hash))) {
    await flash('error', 'Your current password is not correct.');
  } else if (next.length < 8) {
    await flash('error', 'Use at least 8 characters for an administrator password.');
  } else if (next !== confirm) {
    await flash('error', 'The new passwords do not match.');
  } else {
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(next), user.id]);
    await flash('success', 'Password changed.');
  }
  redirect('/admin/settings');
}

export async function saveSiteSettings(fd: FormData) {
  await requireAdmin();
  for (const k of ['site_name', 'institution', 'support_email']) {
    await q('INSERT INTO settings (skey, svalue) VALUES (?,?) ON CONFLICT (skey) DO UPDATE SET svalue = EXCLUDED.svalue', [k, str(fd, k)]);
  }
  await flash('success', 'Portal settings saved.');
  redirect('/admin/settings');
}

export async function publishAnnouncement(fd: FormData) {
  const user = await requireAdmin();
  const title = str(fd, 'a_title');
  if (title === '') {
    await flash('error', 'The announcement needs a title.');
  } else {
    await q('INSERT INTO announcements (title, body, semester_id, created_by) VALUES (?,?,?,?)',
      [title, str(fd, 'a_body'), toInt(fd.get('a_semester')) || null, user.id]);
    await flash('success', 'Announcement published to students.');
  }
  redirect('/admin/settings');
}

export async function deleteAnnouncement(fd: FormData) {
  await requireAdmin();
  await q('DELETE FROM announcements WHERE id = ?', [toInt(fd.get('id'))]);
  await flash('success', 'Announcement removed.');
  redirect('/admin/settings');
}
