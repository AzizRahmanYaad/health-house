/**
 * SEMESTER 1 — FULL 5-MONTH CURRICULUM SEEDER  (+ Pashto subtitle generator)
 *
 * Loads the complete first-semester syllabus: 4 subjects, 121 ordered
 * lessons written in Pashto, spread across a 20-week (5-month) plan, with
 * verified video links and reading resources. The lesson data lives in
 * data/curriculum/*.json (exported from the PHP portal's curriculum files).
 *
 * Re-running is safe: it removes the existing Semester 1 subjects and
 * rebuilds them. Student progress rows for those lessons go with them.
 * Ported from database/seed_semester1.php and database/seed_subtitles.php.
 */
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchAll, fetchValue, q, toInt } from './db';
import { plainText } from './text';

export interface CurriculumLesson {
  t: string;              // title (Pashto)
  i: string;              // short intro
  o: string[];            // learning objectives
  p: string[];            // main content points
  k?: [string, string][]; // key terms  [Pashto, English]
  c?: string;             // midwifery relevance
  m: number;              // minutes
  v?: string;             // YouTube id
  r?: [string, string, string?][]; // resources [label, url, type]
}

export const CURRICULUM_DIR = path.join(process.cwd(), 'data', 'curriculum');

export const SUBJECTS: Record<string, { title: string; desc: string; color: string; credits: number; file: string; label: string }> = {
  'ANP-101': {
    title: 'اناتومي او فزیولوژي ۱ — Anatomy & Physiology I',
    desc: 'د انسان د بدن جوړښت او دنده، په ځانګړي ډول د ښځینه تناسلي سیسټم او لګن، چې د مامایي عملي کار بنسټ جوړوي.',
    color: '#6C4CF1', credits: 4, file: 'anatomy.json', label: 'Anatomy & Physiology I',
  },
  'MID-101': {
    title: 'د مامایي بنسټونه — Foundations of Midwifery',
    desc: 'د مامایي فلسفه، تاریخ، د مامایې دندې او مسلکي معیارونه، او د ښځې پر محور روغتیايي پاملرنه.',
    color: '#E8557E', credits: 3, file: 'foundations.json', label: 'Foundations of Midwifery',
  },
  'MIC-101': {
    title: 'مایکروبیولوژي او د انتان مخنیوی — Microbiology & Infection Prevention',
    desc: 'مایکروارګانیزمونه، د انتان زنځیر، او په زیږون خونه کې د انتان د مخنیوي عملي تګلارې.',
    color: '#12B5A6', credits: 3, file: 'microbiology.json', label: 'Microbiology & Infection Prevention',
  },
  'COM-101': {
    title: 'اړیکې او مشوره ورکول — Communication & Counselling',
    desc: 'د درملنیزې اړیکې مهارتونه، فعال اوریدل، همدردي او د میندو سره د مشورې ورکولو تګلارې.',
    color: '#F59E0B', credits: 2, file: 'communication.json', label: 'Communication & Counselling',
  },
};

/* The plan: 20 weeks x 5 study days = 100 recommended learning days. */
export const STUDY_DAYS = 100;

function dayFor(index: number, total: number): number {
  // index is 1-based; centre each lesson inside its slice of the semester
  const d = Math.round(((index - 0.5) / total) * STUDY_DAYS);
  return Math.max(1, Math.min(STUDY_DAYS, d));
}

/** Where a lesson sits in its subject, as a difficulty level. */
function levelFor(index: number, total: number): string {
  if (total < 5) return 'core';
  if (index <= total * 0.2) return 'intro';
  if (index > total * 0.8) return 'advanced';
  return 'core';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

/** Build the rich Pashto lesson body from the structured curriculum entry. */
function buildBody(L: CurriculumLesson): string {
  let h = '';
  h += '<h3 dir="rtl" style="text-align:right">د زده کړې موخې</h3>';
  h += '<ul dir="rtl" style="text-align:right">' + L.o.map(o => '<li>' + esc(o) + '</li>').join('') + '</ul>';
  h += '<h3 dir="rtl" style="text-align:right">لنډیز</h3>';
  h += '<p dir="rtl" style="text-align:right">' + esc(L.i) + '</p>';
  h += '<h3 dir="rtl" style="text-align:right">اصلي مطالب</h3>';
  h += '<ul dir="rtl" style="text-align:right">' + L.p.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
  if (L.k?.length) {
    h += '<h3 dir="rtl" style="text-align:right">کلیدي اصطلاحات</h3>';
    h += '<table dir="rtl" style="text-align:right"><thead><tr><th>پښتو</th><th>English</th></tr></thead><tbody>';
    for (const pair of L.k) {
      h += '<tr><td>' + esc(pair[0]) + '</td><td dir="ltr" style="text-align:left">' + esc(pair[1]) + '</td></tr>';
    }
    h += '</tbody></table>';
  }
  if (L.c) {
    h += '<h3 dir="rtl" style="text-align:right">د مامایي سره اړیکه</h3>';
    h += '<blockquote dir="rtl" style="text-align:right"><p>' + esc(L.c) + '</p></blockquote>';
  }
  h += '<h3 dir="rtl" style="text-align:right">څه وکړئ</h3>';
  h += '<ol dir="rtl" style="text-align:right">'
    + '<li>ویډیو وګورئ او د پښتو زیرنویس څخه کار واخلئ.</li>'
    + '<li>ضمیمه شوې لوستنې مواد ولولئ.</li>'
    + '<li>په خپلو کلمو کې لنډې یادښتونه ولیکئ.</li>'
    + '<li>که کوز (کویز) شتون ولري، هغه ترسره کړئ، بیا لوست بشپړ نښه کړئ.</li>'
    + '</ol>';
  return h;
}

export async function curriculumFileInfo() {
  const out: { file: string; label: string; ok: boolean; size: number }[] = [];
  for (const S of Object.values(SUBJECTS)) {
    try {
      const st = await fs.stat(path.join(CURRICULUM_DIR, S.file));
      out.push({ file: S.file, label: S.label, ok: st.isFile(), size: st.size });
    } catch {
      out.push({ file: S.file, label: S.label, ok: false, size: 0 });
    }
  }
  return out;
}

/** Rebuild Semester 1 from the JSON curriculum. Returns the plain-text report. */
export async function loadSemester1(): Promise<string> {
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);

  const semesterId = toInt(await fetchValue('SELECT id FROM semesters WHERE number = 1', [], 0));
  if (!semesterId) throw new Error('Semester 1 does not exist. Run the database setup first.');

  await q('UPDATE semesters SET title = ?, description = ? WHERE id = ?', [
    'Semester 1 — Foundations of Midwifery',
    'د لومړي سمسټر بشپړ نصاب: اناتومي او فزیولوژي، د مامایي بنسټونه، مایکروبیولوژي او د انتان مخنیوی، '
    + 'او د اړیکو مهارتونه. د پنځو میاشتو (۲۰ اونۍ / ۱۰۰ د زده کړې ورځې) لپاره پلان شوی.',
    semesterId,
  ]);
  out(`Rebuilding Semester 1 (id ${semesterId})…`);

  /* Remove the old Semester 1 subjects — cascades to lessons, materials,
     quizzes, progress and subtitles. */
  const old = await fetchAll<{ id: number }>('SELECT id, title FROM subjects WHERE semester_id = ?', [semesterId]);
  for (const o of old) await q('DELETE FROM subjects WHERE id = ?', [o.id]);
  out(`  removed ${old.length} existing subject(s)`);

  let totalLessons = 0, totalVideos = 0, totalMaterial = 0, order = 0;

  for (const [code, S] of Object.entries(SUBJECTS)) {
    let lessons: CurriculumLesson[];
    try {
      lessons = JSON.parse(await fs.readFile(path.join(CURRICULUM_DIR, S.file), 'utf8'));
    } catch {
      out(`  !! missing ${S.file} — skipped`);
      continue;
    }
    order++;

    const sr = await q<{ id: number }>(
      `INSERT INTO subjects (semester_id, code, title, description, color, credits, sort_order, is_active)
       VALUES (?,?,?,?,?,?,?,TRUE) RETURNING id`, [semesterId, code, S.title, S.desc, S.color, S.credits, order]);
    const subjectId = toInt(sr.rows[0].id);

    const n = lessons.length;
    for (let i = 0; i < n; i++) {
      const L = lessons[i];
      const idx = i + 1;
      const videoType = L.v ? 'url' : 'none';
      const videoUrl = L.v ? `https://www.youtube.com/watch?v=${L.v}` : null;
      if (L.v) totalVideos++;

      const lr = await q<{ id: number }>(
        `INSERT INTO lessons
           (subject_id, title, description, content, direction, video_type, video_url,
            duration_minutes, difficulty, recommended_day, is_required, sort_order, is_active)
         VALUES (?,?,?,?,'rtl',?,?,?,?,?,TRUE,?,TRUE) RETURNING id`,
        [subjectId, L.t, '<p dir="rtl" style="text-align:right">' + esc(L.i) + '</p>', buildBody(L),
         videoType, videoUrl, toInt(L.m), levelFor(idx, n), dayFor(idx, n), idx]);
      const lessonId = toInt(lr.rows[0].id);
      totalLessons++;

      let mOrder = 0;
      for (const res of L.r ?? []) {
        mOrder++;
        await q('INSERT INTO lesson_materials (lesson_id, type, title, external_url, sort_order) VALUES (?,?,?,?,?)',
          [lessonId, res[2] ?? 'link', res[0], res[1], mOrder]);
        totalMaterial++;
      }
    }
    out(`  ${code.padEnd(8)} ${S.label.padEnd(40)} ${String(n).padStart(3)} lessons`);
  }

  out('');
  out('Done.');
  out(`  lessons created   : ${totalLessons}`);
  out(`  with a video      : ${totalVideos}`);
  out(`  reading resources : ${totalMaterial}`);
  out(`  study-day range   : 1 … ${STUDY_DAYS}  (20 weeks / 5 months)`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  PASHTO SUBTITLE TRACK GENERATOR                                    */
/*  Builds a Pashto WebVTT track for every Semester 1 lesson that has   */
/*  a video, from that lesson's own objectives and content points,     */
/*  timed across the lesson's stated duration. It is a synchronised    */
/*  study track, NOT a word-for-word translation of the narration.     */
/* ------------------------------------------------------------------ */

function ts(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s - h * 3600) / 60);
  const sec = s - h * 3600 - m * 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
}

/** Pull the Pashto sentences back out of the generated lesson body. */
function cueLines(content: string): string[] {
  const lines: string[] = [];
  for (const m of content.matchAll(/<li>(.*?)<\/li>/gs)) lines.push(m[1]);
  for (const m of content.matchAll(/<p>(.*?)<\/p>/gs)) lines.push(m[1]);

  const out: string[] = [];
  for (const l of lines) {
    const t = plainText(l);
    if (t === '' || [...t].length < 12) continue;
    if (t.startsWith('ویډیو وګورئ او د پښتو') || t.startsWith('ضمیمه شوې لوستنې')
     || t.startsWith('په خپلو کلمو کې') || t.startsWith('که کوز (کویز)')) continue;
    out.push(t);
  }
  return [...new Set(out)];
}

export async function generateSubtitles(): Promise<string> {
  const lessons = await fetchAll<{ id: number; content: string | null; duration_minutes: number }>(
    `SELECT l.* FROM lessons l
       JOIN subjects s ON s.id = l.subject_id
       JOIN semesters sem ON sem.id = s.semester_id
      WHERE sem.number = 1 AND l.video_type <> 'none'
      ORDER BY s.sort_order, l.sort_order`);

  let made = 0, cues = 0;
  for (const L of lessons) {
    const lines = cueLines(String(L.content ?? ''));
    if (lines.length < 3) continue;

    const total = Math.max(120, toInt(L.duration_minutes) * 60);
    const start = 3.0, gap = 0.4;
    let span = (total - start) / lines.length;
    span = Math.max(4.0, Math.min(14.0, span));

    let vtt = 'WEBVTT\n';
    vtt += '\nNOTE\nپښتو لنډیز — د دې لوست کلیدي ټکي.\nدا د ویډیو د غږ کلمه په کلمه ژباړه نه ده.\n';
    let t = start;
    lines.forEach((line, i) => {
      const end = t + span - gap;
      vtt += `\n${i + 1}\n${ts(t)} --> ${ts(end)}\n${line}\n`;
      t = end + gap;
      cues++;
    });

    await q(`INSERT INTO lesson_subtitles (lesson_id, lang, label, direction, vtt, is_default)
             VALUES (?, 'ps', 'پښتو لنډیز', 'rtl', ?, TRUE)
             ON CONFLICT (lesson_id, lang) DO UPDATE SET label = EXCLUDED.label, vtt = EXCLUDED.vtt`, [L.id, vtt]);
    made++;
  }
  return `Pashto subtitle tracks written : ${made}\nTotal caption lines            : ${cues}\nLessons with a video           : ${lessons.length}`;
}
