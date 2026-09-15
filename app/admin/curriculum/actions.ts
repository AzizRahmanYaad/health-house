'use server';

import { logActivity, requireAdmin } from '@/lib/auth';
import { generateSubtitles, loadSemester1 } from '@/lib/curriculum';
import { flash } from '@/lib/session';

export interface LoaderState { log: string | null; error: string | null }

export async function runLoader(_prev: LoaderState, fd: FormData): Promise<LoaderState> {
  const user = await requireAdmin();
  const task = String(fd.get('task') ?? 'curriculum');
  try {
    if (task === 'subtitles') {
      const log = await generateSubtitles();
      await logActivity(user.id, 'subtitles_generated', 'Semester 1 Pashto tracks');
      await flash('success', 'Pashto subtitle tracks generated.');
      return { log, error: null };
    }
    const log = await loadSemester1();
    await logActivity(user.id, 'curriculum_loaded', 'Semester 1 rebuilt');
    await flash('success', 'Semester 1 curriculum loaded.');
    return { log, error: null };
  } catch (e) {
    return { log: null, error: 'The loader stopped with an error: ' + (e instanceof Error ? e.message : String(e)) };
  }
}
