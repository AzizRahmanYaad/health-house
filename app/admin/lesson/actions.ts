'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { fetchOne, fetchValue, q, toInt } from '@/lib/db';
import { normaliseVtt, vttCueCount } from '@/lib/lms';
import { videoEmbed } from '@/lib/media';
import { sanitizeRichText } from '@/lib/richtext';
import { flash } from '@/lib/session';
import { deleteUpload, uploadExists, uploadFile, uploadSize } from '@/lib/uploads';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

interface LessonRow { id: number; subject_id: number; video_file: string | null; video_url: string | null; video_type: string }

async function loadLesson(id: number) {
  return id ? fetchOne<LessonRow>('SELECT * FROM lessons WHERE id = ?', [id]) : null;
}

/* ---- save the lesson itself ---- */
export async function saveLesson(fd: FormData) {
  await requireAdmin();
  let lessonId = toInt(fd.get('id'));
  const lesson = await loadLesson(lessonId);
  if (lessonId && !lesson) redirect('/admin/lessons');

  const title = str(fd, 'title');
  const sub   = toInt(fd.get('subject_id'));
  const subjectId = lesson ? lesson.subject_id : sub;

  if (title === '' || !sub) {
    await flash('error', 'A subject and a lesson title are required.');
    redirect(lessonId ? `/admin/lesson/${lessonId}` : `/admin/lesson?subject=${subjectId}`);
  }

  /* --- video ---
     video_source is one of: none | link | file
     A pasted address is stored as 'url'; videoSource() works out at display
     time whether it is YouTube, Vimeo, Drive, Dailymotion or a direct file. */
  const source = str(fd, 'video_source') || 'none';
  let videoType = 'none';
  let videoUrl: string | null = null;
  let videoFile: string | null = lesson?.video_file ?? null;

  if (source === 'link') {
    const link = str(fd, 'video_url');
    if (link !== '') {
      videoType = 'url';
      videoUrl = link;
      if (videoEmbed(link).kind === 'link') {
        await flash('warning', 'That address is not a recognised video host. Students will see it as a link they can open. '
          + 'Use YouTube, Vimeo, Google Drive, or a direct .mp4 address for an embedded player.');
      }
    }
  } else if (source === 'file') {
    /* the chunked uploader writes the finished file name into this hidden field */
    const uploaded = str(fd, 'video_file_name');
    if (uploaded !== '' && /^[A-Za-z0-9._-]+$/.test(uploaded) && await uploadExists('videos/' + uploaded)) {
      if (videoFile && videoFile !== uploaded) await deleteUpload('videos/' + videoFile);   // replace the previous file
      videoFile = uploaded;
    }
    /* fallback: a plain (non-chunked) file input, for browsers without JS */
    const up = await uploadFile(fd, 'video_file', 'videos', ['mp4', 'webm', 'ogv', 'ogg', 'mov', 'm4v', 'mkv', 'avi']);
    if (up) {
      if (videoFile && videoFile !== up.name) await deleteUpload('videos/' + videoFile);
      videoFile = up.name;
    }
    if (videoFile) videoType = 'file';
    else await flash('error', 'No video file was uploaded, so the lesson was saved without a video.');
  }

  const dirIn = str(fd, 'direction');
  const direction = ['auto', 'ltr', 'rtl'].includes(dirIn) ? dirIn : 'auto';

  const fields = [
    sub, title,
    sanitizeRichText(String(fd.get('description') ?? '')),
    sanitizeRichText(String(fd.get('content') ?? '')),
    direction, videoType, videoUrl, videoFile,
    toInt(fd.get('duration_minutes')),
    Math.max(1, toInt(fd.get('recommended_day'), 1)),
    fd.get('is_required') ? true : false,
    toInt(fd.get('sort_order')),
    fd.get('is_active') ? true : false,
  ];

  if (lessonId) {
    await q(`UPDATE lessons SET subject_id=?, title=?, description=?, content=?, direction=?, video_type=?,
                    video_url=?, video_file=?, duration_minutes=?, recommended_day=?, is_required=?, sort_order=?, is_active=?
              WHERE id=?`, [...fields, lessonId]);
    await flash('success', 'Lesson saved.');
  } else {
    const r = await q<{ id: number }>(
      `INSERT INTO lessons (subject_id,title,description,content,direction,video_type,video_url,video_file,
                            duration_minutes,recommended_day,is_required,sort_order,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`, fields);
    lessonId = toInt(r.rows[0].id);
    await flash('success', 'Lesson created. You can now attach materials and a quiz.');
  }
  redirect(`/admin/lesson/${lessonId}`);
}

/* ---- add a material ---- */
export async function addMaterial(fd: FormData) {
  await requireAdmin();
  const lessonId = toInt(fd.get('id'));
  if (!(await loadLesson(lessonId))) redirect('/admin/lessons');

  const type = str(fd, 'material_type') || 'pdf';
  let title = str(fd, 'material_title');
  const link = str(fd, 'material_url') || null;
  let filePath: string | null = null;
  let size = 0;

  const allowed: Record<string, string[]> = {
    pdf:      ['pdf'],
    slides:   ['ppt', 'pptx', 'odp', 'key', 'pdf'],
    document: ['doc', 'docx', 'odt', 'txt', 'rtf', 'pdf'],
    audio:    ['mp3', 'wav', 'ogg', 'm4a'],
    other:    ['zip', 'rar', '7z', 'png', 'jpg', 'jpeg', 'pdf', 'xlsx', 'csv'],
  };
  const folder = ({ pdf: 'pdfs', slides: 'slides', document: 'resources', audio: 'resources', other: 'resources' } as Record<string, string>)[type] ?? 'resources';

  /* chunk-uploaded file wins, otherwise fall back to the plain input */
  const chunked = str(fd, 'material_file_name');
  if (type !== 'link' && chunked !== '' && /^[A-Za-z0-9._-]+$/.test(chunked)) {
    const folderGuess = (str(fd, 'material_folder') || folder).replace(/[^a-z]/g, '') || folder;
    if (['videos', 'pdfs', 'slides', 'resources'].includes(folderGuess) && await uploadExists(`${folderGuess}/${chunked}`)) {
      filePath = `${folderGuess}/${chunked}`;
      size = await uploadSize(filePath);
      if (title === '') title = chunked;
    }
  }
  if (type !== 'link' && !filePath) {
    const up = await uploadFile(fd, 'material_file', folder, allowed[type] ?? ['pdf']);
    if (up) {
      filePath = `${folder}/${up.name}`;
      size = up.size;
      if (title === '') title = up.name;
    }
  }

  if (title === '') {
    await flash('error', 'Give the material a title.');
  } else if (type === 'link' && !link) {
    await flash('error', 'Provide the link address.');
  } else if (type !== 'link' && !filePath) {
    await flash('error', 'Choose a file to upload.');
  } else {
    const next = toInt(await fetchValue('SELECT COALESCE(MAX(sort_order),0)+1 FROM lesson_materials WHERE lesson_id = ?', [lessonId], 1));
    await q('INSERT INTO lesson_materials (lesson_id,type,title,file_path,external_url,file_size,sort_order) VALUES (?,?,?,?,?,?,?)',
      [lessonId, type, title, filePath, link, size, next]);
    await flash('success', 'Material attached.');
  }
  redirect(`/admin/lesson/${lessonId}`);
}

/* ---- delete a material ---- */
export async function deleteMaterial(fd: FormData) {
  await requireAdmin();
  const lessonId = toInt(fd.get('id'));
  const mid = toInt(fd.get('material_id'));
  const m = await fetchOne<{ id: number; file_path: string | null }>('SELECT * FROM lesson_materials WHERE id = ? AND lesson_id = ?', [mid, lessonId]);
  if (m) {
    await deleteUpload(m.file_path);
    await q('DELETE FROM lesson_materials WHERE id = ?', [mid]);
    await flash('success', 'Material removed.');
  }
  redirect(`/admin/lesson/${lessonId}`);
}

/* ---- save a Pashto subtitle track ---- */
export async function saveSubtitle(fd: FormData) {
  await requireAdmin();
  const lessonId = toInt(fd.get('id'));
  if (!(await loadLesson(lessonId))) redirect('/admin/lessons');

  const lang  = (str(fd, 'sub_lang') || 'ps').replace(/[^a-zA-Z-]/g, '') || 'ps';
  const label = str(fd, 'sub_label') || 'پښتو';
  let raw = String(fd.get('sub_vtt') ?? '');

  /* an uploaded .vtt / .srt file wins over the textarea */
  const f = fd.get('sub_file');
  if (f instanceof File && f.size > 0) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (['vtt', 'srt', 'txt'].includes(ext)) {
      raw = await f.text();
    } else {
      await flash('error', 'Subtitle files must be .vtt or .srt.');
      redirect(`/admin/lesson/${lessonId}`);
    }
  }

  if (raw.trim() === '') {
    await q('DELETE FROM lesson_subtitles WHERE lesson_id = ? AND lang = ?', [lessonId, lang]);
    await flash('success', 'Subtitle track removed.');
  } else {
    const vtt = normaliseVtt(raw);
    const count = vttCueCount(vtt);
    if (count === 0) {
      await flash('error', 'No caption timings were found. Each line needs a timing such as 00:00:05.000 --> 00:00:09.000 on its own line, then the Pashto text underneath.');
    } else {
      await q(`INSERT INTO lesson_subtitles (lesson_id, lang, label, direction, vtt, is_default)
               VALUES (?,?,?,?,?,TRUE)
               ON CONFLICT (lesson_id, lang) DO UPDATE SET label = EXCLUDED.label, direction = EXCLUDED.direction, vtt = EXCLUDED.vtt`,
        [lessonId, lang, label, ['ps', 'fa', 'ar'].includes(lang) ? 'rtl' : 'ltr', vtt]);
      await flash('success', `Subtitle track saved — ${count} caption lines.`);
    }
  }
  redirect(`/admin/lesson/${lessonId}`);
}

/* ---- remove the video ---- */
export async function clearVideo(fd: FormData) {
  await requireAdmin();
  const lessonId = toInt(fd.get('id'));
  const lesson = await loadLesson(lessonId);
  if (!lesson) redirect('/admin/lessons');
  if (lesson.video_file) await deleteUpload('videos/' + lesson.video_file);
  await q("UPDATE lessons SET video_type = 'none', video_url = NULL, video_file = NULL WHERE id = ?", [lessonId]);
  await flash('success', 'Video removed from this lesson.');
  redirect(`/admin/lesson/${lessonId}`);
}
