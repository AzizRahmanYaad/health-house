'use server';

import { redirect } from 'next/navigation';
import { hashPassword, requireStudent, verifyPassword } from '@/lib/auth';
import { q } from '@/lib/db';
import { flash } from '@/lib/session';
import { deleteUpload, uploadFile } from '@/lib/uploads';

export async function updateProfile(fd: FormData) {
  const user = await requireStudent();
  const name  = String(fd.get('full_name') ?? '').trim();
  const phone = String(fd.get('phone') ?? '').trim();

  if (name === '') {
    await flash('error', 'Your name cannot be empty.');
  } else {
    let avatar = user.avatar;
    const up = await uploadFile(fd, 'avatar', 'avatars', ['jpg', 'jpeg', 'png', 'webp', 'gif']);
    if (up) {
      await deleteUpload(avatar ? 'avatars/' + avatar : null);
      avatar = up.name;
    }
    await q('UPDATE users SET full_name = ?, phone = ?, avatar = ? WHERE id = ?', [name, phone, avatar, user.id]);
    await flash('success', 'Your profile has been updated.');
  }
  redirect('/student/profile');
}

export async function changePassword(fd: FormData) {
  const user = await requireStudent();
  const current = String(fd.get('current_password') ?? '');
  const next    = String(fd.get('new_password') ?? '');
  const confirm = String(fd.get('confirm_password') ?? '');

  if (!(await verifyPassword(current, user.password_hash))) {
    await flash('error', 'Your current password is not correct.');
  } else if (next.length < 6) {
    await flash('error', 'The new password must be at least 6 characters long.');
  } else if (next !== confirm) {
    await flash('error', 'The new passwords do not match.');
  } else {
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(next), user.id]);
    await flash('success', 'Your password has been changed.');
  }
  redirect('/student/profile');
}
