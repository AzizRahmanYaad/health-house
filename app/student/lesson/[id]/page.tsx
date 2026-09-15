import Link from 'next/link';
import { redirect } from 'next/navigation';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { ProgressBar } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { isBookmarked, lessonSubtitle } from '@/lib/lms';
import { uploadUrl, videoSource, youtubeId } from '@/lib/media';
import { lessonStatus, subjectProgress, touchLesson } from '@/lib/progress';
import { sanitizeRichText } from '@/lib/richtext';
import { difficultyMeta, dirOf, duration, humanSize, lessonDirection, plainText, statusMeta } from '@/lib/text';
import { bookmarkLesson, completeLesson, reopenLesson } from './actions';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number; subject_id: number; title: string; description: string | null; content: string | null; direction: string;
  video_type: string; video_url: string | null; video_file: string | null; duration_minutes: number; difficulty: string;
  recommended_day: number; is_required: boolean; sort_order: number;
  subject_title: string; color: string; subject_code: string | null; semester_id: number; semester_number: number;
}
interface Sibling { id: number; title: string; sort_order: number; duration_minutes: number; recommended_day: number; video_type: string; is_required: boolean; status: string }
interface Material { id: number; type: string; title: string; file_path: string | null; external_url: string | null; file_size: number }
interface Quiz { id: number; title: string; passing_score: number; max_attempts: number; time_limit: number }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await fetchOne<{ title: string }>('SELECT title FROM lessons WHERE id = ?', [toInt(id)]);
  return { title: l?.title ?? 'Lesson' };
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const uid = user.id;
  const lessonId = toInt((await params).id);

  const lesson = await fetchOne<Lesson>(
    `SELECT l.*, s.title AS subject_title, s.id AS subject_id, s.color, s.code AS subject_code,
            sem.id AS semester_id, sem.number AS semester_number
       FROM lessons l
       JOIN subjects  s   ON s.id = l.subject_id
       JOIN semesters sem ON sem.id = s.semester_id
      WHERE l.id = ? AND l.is_active = TRUE`, [lessonId]);
  if (!lesson) redirect('/student/learning');

  /* mark as started the first time it is opened */
  await touchLesson(uid, lessonId);
  const status = await lessonStatus(uid, lessonId);
  const meta = statusMeta(status);

  const materials = await fetchAll<Material>('SELECT * FROM lesson_materials WHERE lesson_id = ? ORDER BY sort_order, id', [lessonId]);
  const quizzes   = await fetchAll<Quiz>('SELECT * FROM quizzes WHERE lesson_id = ? AND is_active = TRUE ORDER BY id', [lessonId]);

  const siblings = await fetchAll<Sibling>(
    `SELECT l.id, l.title, l.sort_order, l.duration_minutes, l.recommended_day, l.video_type, l.is_required,
            COALESCE(lp.status, 'not_started') AS status
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE l.subject_id = ? AND l.is_active = TRUE
      ORDER BY l.sort_order, l.id`, [uid, lesson.subject_id]);

  let index = 0;
  let prev: { id: number; title: string } | null = null;
  let nextL: { id: number; title: string } | null = null;
  siblings.forEach((s, i) => {
    if (s.id === lessonId) {
      index = i + 1;
      prev  = siblings[i - 1] ?? null;
      nextL = siblings[i + 1] ?? null;
    }
  });

  /* When we are at the first/last lesson of a subject, carry navigation on to the
     neighbouring subject so the whole semester reads as one continuous sequence. */
  let prevSubject: { id: number; title: string } | null = null;
  let nextSubject: { id: number; title: string } | null = null;

  if (!prev) {
    prevSubject = await fetchOne(
      `SELECT s.id, s.title FROM subjects s
        WHERE s.semester_id = ? AND s.is_active = TRUE
          AND (s.sort_order < (SELECT sort_order FROM subjects WHERE id = ?)
               OR (s.sort_order = (SELECT sort_order FROM subjects WHERE id = ?) AND s.id < ?))
        ORDER BY s.sort_order DESC, s.id DESC LIMIT 1`,
      [lesson.semester_id, lesson.subject_id, lesson.subject_id, lesson.subject_id]);
    if (prevSubject) {
      prev = await fetchOne(`SELECT id, title FROM lessons WHERE subject_id = ? AND is_active = TRUE ORDER BY sort_order DESC, id DESC LIMIT 1`, [prevSubject.id]);
    }
  }
  if (!nextL) {
    nextSubject = await fetchOne(
      `SELECT s.id, s.title FROM subjects s
        WHERE s.semester_id = ? AND s.is_active = TRUE
          AND (s.sort_order > (SELECT sort_order FROM subjects WHERE id = ?)
               OR (s.sort_order = (SELECT sort_order FROM subjects WHERE id = ?) AND s.id > ?))
        ORDER BY s.sort_order, s.id LIMIT 1`,
      [lesson.semester_id, lesson.subject_id, lesson.subject_id, lesson.subject_id]);
    if (nextSubject) {
      nextL = await fetchOne(`SELECT id, title FROM lessons WHERE subject_id = ? AND is_active = TRUE ORDER BY sort_order, id LIMIT 1`, [nextSubject.id]);
    }
  }

  const prevUrl = prev  ? `/student/lesson/${(prev as { id: number }).id}`  : '';
  const nextUrl = nextL ? `/student/lesson/${(nextL as { id: number }).id}` : '';

  const prog  = await subjectProgress(uid, lesson.subject_id);
  const video = videoSource(lesson);
  const dir   = lessonDirection(lesson);   // 'rtl' for Pashto / Dari / Arabic content

  /* --- Pashto captions: a <track> works only on our own <video>. For YouTube
     we ask the player to show Pashto captions if the owner published them, and
     in every case we render our own synchronised transcript + overlay. */
  const subtitle = await lessonSubtitle(lessonId, 'ps');
  const ytId = video.provider === 'YouTube' ? youtubeId(String(lesson.video_url ?? '')) : null;
  if (ytId) {
    video.src = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&enablejsapi=1&cc_load_policy=1&cc_lang_pref=ps&hl=ps`;
  }
  const needSubtitles = !!subtitle && video.kind !== 'none';
  const vttUrl = subtitle ? `/api/subtitle?lesson=${lessonId}&lang=${encodeURIComponent(subtitle.lang)}` : '';

  /* quiz attempt summary for this lesson */
  const attemptsByQuiz: Record<number, { attempts: number; best: number; passed: boolean }> = {};
  if (quizzes.length) {
    for (const r of await fetchAll<{ quiz_id: number; attempts: number; best: number; passed: boolean }>(
      `SELECT quiz_id, COUNT(*) AS attempts, MAX(percentage) AS best, BOOL_OR(passed) AS passed
         FROM quiz_attempts WHERE user_id = ? AND completed_at IS NOT NULL AND quiz_id = ANY(?)
        GROUP BY quiz_id`, [uid, quizzes.map(z => z.id)])) {
      attemptsByQuiz[r.quiz_id] = r;
    }
  }

  const saved = await isBookmarked(uid, lessonId);
  const level = difficultyMeta(lesson.difficulty ?? 'core');
  const rtlProps = dir === 'rtl' ? { lang: 'ps' } : {};
  const statusBadge = status === 'completed' ? 'badge-teal' : status === 'in_progress' ? 'badge-brand' : 'badge-outline';
  const descriptionHtml = sanitizeRichText(lesson.description);
  const contentHtml = sanitizeRichText(lesson.content);
  const pd = prev ? dirOf((prev as { title: string }).title) : 'ltr';
  const nd = nextL ? dirOf((nextL as { title: string }).title) : 'ltr';

  return (
    <Shell user={user} title={lesson.title}
           subtitle={`${lesson.subject_title} · Lesson ${index} of ${siblings.length}`}
           crumbs={[
             { label: 'Home', href: '/student/dashboard' },
             { label: 'Courses', href: `/student/learning?semester=${lesson.semester_id}` },
             { label: plainText(lesson.subject_title, 30), href: `/student/subject/${lesson.subject_id}` },
             { label: `Lesson ${index}` },
           ]}>

      {/* ---------- back row + prev/next ---------- */}
      <div className="row between" style={{ marginBottom: 10, gap: 12 }}>
        <nav className="crumbs" style={{ margin: 0, fontSize: '.8rem' }} aria-label="Breadcrumb">
          <Link href={`/student/subject/${lesson.subject_id}`}><Icon name="arrow-left" /> Back</Link>
          <Icon name="chevron-right" />
          <Link href={`/student/subject/${lesson.subject_id}`}>{plainText(lesson.subject_title, 44)}</Link>
          <Icon name="chevron-right" />
          <span>Lesson {index}</span>
        </nav>
        <div className="row row-tight">
          <span className="kbd-hint">Move with <kbd>Alt</kbd>+<kbd>←</kbd><kbd>→</kbd></span>
          {prevUrl ? <Link className="btn btn-ghost btn-sm" href={prevUrl}><Icon name="arrow-left" className="icon-sm" /> Previous</Link> : null}
          {nextUrl ? <Link className="btn btn-primary btn-sm" href={nextUrl}>Next Lesson <Icon name="arrow-right" className="icon-sm" /></Link> : null}
        </div>
      </div>

      {/* ---------- title + meta ---------- */}
      <h1 dir={dir} {...rtlProps} className={dir === 'rtl' ? 'rtl-text' : ''} style={{ fontSize: '1.5rem', margin: '0 0 8px', lineHeight: 1.45 }}>{lesson.title}</h1>
      <div className="lesson-meta" style={{ marginBottom: 20 }}>
        <span><Icon name="list" /> Lesson {index} of {siblings.length}</span>
        {lesson.duration_minutes ? <span><Icon name="clock" /> {duration(lesson.duration_minutes)}</span> : null}
        <span><Icon name="calendar" /> Day {lesson.recommended_day}</span>
        <span className={`level ${level.class}`}>{level.label}</span>
        {video.kind !== 'none' ? <span style={{ color: 'var(--brand)' }}><Icon name="video" /> Video</span> : null}
        {materials.length ? <span><Icon name="file-text" /> {materials.length} Resource{materials.length === 1 ? '' : 's'}</span> : null}
        <span className={`badge ${statusBadge}`}>{meta.label}</span>
      </div>

      <div className="lesson-layout">

        {/* ---------- left: course content ---------- */}
        <aside className="lesson-side">
          <div className="card">
            <div className="card__head" style={{ marginBottom: 8 }}>
              <h3 className="card__title">Course Content</h3>
              <span className="badge badge-brand">{prog.percent}%</span>
            </div>
            <ProgressBar percent={prog.percent} tone={prog.percent >= 100 ? 'teal' : ''} className="bar-sm" />
            <div className="tiny dim" style={{ margin: '6px 0 10px' }}>{prog.completed} of {prog.total} completed</div>

            <nav className="lesson-nav lesson-list--scroll" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="lesson-nav__group" dir={dirOf(lesson.subject_title)}>
                <Icon name="chevron-down" /> <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.subject_title}</span>
              </div>
              {siblings.map((s, i) => {
                const cur = s.id === lessonId;
                const sdir = dirOf(s.title);
                const cls = cur ? 'is-current' : (s.status === 'completed' ? 'is-done' : '');
                return (
                  <Link key={s.id} className={`lesson-nav__item ${cls}`} dir={sdir} lang={sdir === 'rtl' ? 'ps' : undefined}
                        title={s.title} href={`/student/lesson/${s.id}`}>
                    <span className="lesson-nav__num">
                      {s.status === 'completed' ? <Icon name="check" className="icon-sm" /> : String(i + 1)}
                    </span>
                    <span className="lesson-nav__title">{s.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ---------- centre: the lesson ---------- */}
        <div>
          <div className={`player ${video.kind === 'none' ? 'player--empty' : ''}`} style={{ marginBottom: 22 }}>
            {video.kind === 'iframe' ? (
              <iframe id={ytId ? 'yt-player' : undefined} src={video.src} title={lesson.title}
                      allowFullScreen loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"></iframe>
            ) : video.kind === 'video' ? (
              /* src on the element itself (not a <source> child) so media errors are reported reliably */
              <video id="lesson-video" data-lesson-id={lessonId} src={video.src}
                     controls preload="metadata" playsInline controlsList="nodownload" crossOrigin="anonymous">
                {subtitle ? (
                  <track kind="subtitles" default srcLang={subtitle.lang} label={subtitle.label} src={vttUrl} />
                ) : null}
                Your browser cannot play this video format.
              </video>
            ) : video.kind === 'link' ? (
              <div className="player__link">
                <Icon name="external" />
                <b>This lesson&apos;s video is hosted elsewhere</b>
                <span className="small">The address is not a recognised embeddable player.</span>
                <a className="btn btn-ghost btn-sm" href={video.src} target="_blank" rel="noopener">
                  <Icon name="play" className="icon-sm" /> Open the video
                </a>
              </div>
            ) : (
              <div className="center">
                <Icon name="video" />
                <div style={{ fontWeight: 700 }}>No video for this lesson</div>
                <div className="tiny" style={{ opacity: .7 }}>Study the notes and materials below</div>
              </div>
            )}
            {needSubtitles ? <div id="sub-overlay" className="sub-overlay" dir="rtl" data-on="1" hidden></div> : null}
          </div>

          {needSubtitles && subtitle ? (
            <section className="card sub-panel" id="subs" data-subs data-vtt={vttUrl} data-kind={video.kind} data-ytid={ytId ?? ''} style={{ marginBottom: 22 }}>
              <div className="card__head" style={{ marginBottom: 12 }}>
                <h3 className="card__title row row-tight" style={{ gap: 8 }}>
                  <Icon name="message" className="icon-sm" /> {subtitle.label}
                  <span className="badge badge-teal"><span data-cue-count>0</span> کرښې</span>
                </h3>
                <div className="row row-tight">
                  <button type="button" className="btn btn-ghost btn-sm is-active" data-sub-toggle aria-pressed="true">
                    <Icon name="eye" className="icon-sm" /> پر ویډیو ښکاره کړه
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm is-active" data-sub-follow>
                    <Icon name="activity" className="icon-sm" /> اتوماتیک تعقیب
                  </button>
                </div>
              </div>
              <p className="tiny dim" dir="rtl" style={{ margin: '0 0 10px' }}>
                {video.kind === 'iframe'
                  ? 'دا ویډیو په بهرني پلیر (یوټیوب) کې ده، نو زموږ زیرنویس د ویډیو د خپل پلیر دننه نه ښکاري — دلته د ویډیو سره یوځای حرکت کوي او پر ویډیو باندې هم ښودل کیږي. د هرې کرښې په کلیک کولو سره ویډیو هماغه ځای ته ځي.'
                  : 'زیرنویس د پلیر دننه هم ښکاري (د CC تڼۍ) او دلته هم — د هرې کرښې په کلیک کولو سره ویډیو هماغه ځای ته ځي.'}
              </p>
              <div className="cues" data-cues></div>
            </section>
          ) : null}

          {video.kind === 'video' ? (
            <div id="video-error" className="alert alert-warning" hidden style={{ marginBottom: 18 }}>
              <Icon name="alert" />
              <div>
                <b>The video could not be loaded.</b> It may have been moved, or the format may not be supported by this browser.{' '}
                <a href={video.src} target="_blank" rel="noopener" style={{ fontWeight: 700 }}>Try opening it directly</a>.
              </div>
            </div>
          ) : null}

          {/* ---------- lesson header + lesson text ---------- */}
          <section className="card card--pad-lg" data-lesson-read style={{ marginBottom: 22 }}>
            <div className="row between" style={{ gap: 14, marginBottom: 14 }}>
              <div className="row row-tight">
                <span className="badge badge-brand">Lesson {index}</span>
                <span className={`level ${level.class}`}>{level.label}</span>
                <span className="badge"><Icon name="calendar" className="icon-sm" /> Day {lesson.recommended_day}</span>
                {lesson.duration_minutes ? <span className="badge"><Icon name="clock" className="icon-sm" /> {duration(lesson.duration_minutes)}</span> : null}
                {!lesson.is_required ? <span className="badge badge-amber">Optional</span> : null}
              </div>
              <span className={`badge ${statusBadge}`}>{meta.label}</span>
            </div>

            {/* reading controls: the lesson text is the part students live in */}
            <div className="readtools">
              <span className="readtools__label">Lesson text</span>
              <button type="button" className="btn btn-sm btn-read" data-reader-open>
                <Icon name="book" className="icon-sm" /> Read full screen <kbd>R</kbd>
              </button>
              <button type="button" className="btn btn-ghost btn-sm" data-wide-toggle aria-pressed="false" title="Use the full width of the card">
                <Icon name="grid" className="icon-sm" /> Wide
              </button>
              <form action={bookmarkLesson} style={{ margin: 0 }}>
                <input type="hidden" name="lesson_id" value={lessonId} />
                <button className={`btn btn-ghost btn-sm${saved ? ' is-saved' : ''}`} type="submit"
                        aria-pressed={saved ? 'true' : 'false'}
                        title={saved ? 'Remove from saved lessons' : 'Keep this lesson for later'}>
                  <Icon name={saved ? 'bookmark-fill' : 'bookmark'} className="icon-sm" /> {saved ? 'Saved' : 'Save'}
                </button>
              </form>
            </div>

            {/* One block, moved into the reader as a whole and put back on close. */}
            <div data-reader-content data-dir={dir} data-title={lesson.title}
                 data-eyebrow={`${lesson.subject_title} · Lesson ${index} of ${siblings.length}`}>
              {descriptionHtml !== '' ? (
                <div className={`lead lesson-body ${dir === 'rtl' ? 'rtl-text' : ''}`} dir={dir} style={{ marginBottom: 22 }}
                     dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
              ) : null}
              <div className="lesson-body" dir={dir} {...rtlProps} dangerouslySetInnerHTML={{ __html: contentHtml }} />
            </div>
          </section>

          {/* ---------- materials ---------- */}
          {materials.length ? (
            <section className="section">
              <div className="section__head"><h2 style={{ fontSize: '1.15rem' }}>Learning materials</h2></div>
              <div className="grid grid-2">
                {materials.map(m => {
                  const href = m.external_url || uploadUrl(m.file_path);
                  const iconName = ({ pdf: 'file-text', slides: 'slides', document: 'file', link: 'link', audio: 'activity' } as Record<string, string>)[m.type] ?? 'file';
                  return (
                    <a key={m.id} className="material reveal" href={href} target="_blank" rel="noopener">
                      <span className={`material__icon ${m.type}`}><Icon name={iconName} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: '.9rem', display: 'block' }}>{m.title}</b>
                        <span className="tiny dim">{m.type.toUpperCase()}{m.file_size ? ' · ' + humanSize(m.file_size) : ''}</span>
                      </span>
                      <Icon name={m.external_url ? 'external' : 'download'} className="icon-sm" />
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* ---------- quizzes ---------- */}
          {quizzes.length ? (
            <section className="section" id="assessment">
              <div className="section__head"><h2 style={{ fontSize: '1.15rem' }}>Assessment</h2></div>
              <div className="stack">
                {quizzes.map(qz => {
                  const at = attemptsByQuiz[qz.id] ?? null;
                  const used = at ? at.attempts : 0;
                  const left = Math.max(0, qz.max_attempts - used);
                  return (
                    <div key={qz.id} className="card row between" style={{ gap: 16 }}>
                      <div className="row" style={{ gap: 14, flex: 1, minWidth: 0 }}>
                        <span className="stat__icon amber" style={{ margin: 0 }}><Icon name="clipboard" /></span>
                        <div style={{ minWidth: 0 }}>
                          <b style={{ display: 'block' }}>{qz.title}</b>
                          <div className="tiny dim">
                            Pass mark {qz.passing_score}% · {qz.max_attempts} attempts allowed{qz.time_limit ? ` · ${qz.time_limit} min limit` : ''}
                          </div>
                          {at ? (
                            <div className="row row-tight" style={{ marginTop: 7 }}>
                              <span className={`badge ${at.passed ? 'badge-teal' : 'badge-danger'}`}>Best {Math.round(at.best)}% · {at.passed ? 'Passed' : 'Not passed'}</span>
                              <span className="badge">{used} attempt{used > 1 ? 's' : ''} used</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {left > 0 ? (
                        <Link className="btn btn-primary btn-sm" href={`/student/quiz/${qz.id}`}>
                          <Icon name="play" className="icon-sm" /> {used ? 'Retake' : 'Start quiz'}
                        </Link>
                      ) : <span className="badge badge-danger">No attempts left</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* ---------- previous / next ---------- */}
          <nav className="pager" data-pager data-prev={prevUrl} data-next={nextUrl} aria-label="Lesson navigation">
            {prevUrl ? (
              <Link className="pager__link" href={prevUrl}>
                <span className="pager__arrow"><Icon name="arrow-left" className="icon-sm" /></span>
                <span className="pager__body">
                  <span className="pager__label">Previous{prevSubject ? ' · ' + plainText(prevSubject.title, 28) : ''}</span>
                  <span className="pager__title" dir={pd} lang={pd === 'rtl' ? 'ps' : undefined}>{(prev as { title: string }).title}</span>
                </span>
              </Link>
            ) : (
              <span className="pager__link pager__link--disabled">
                <span className="pager__arrow"><Icon name="arrow-left" className="icon-sm" /></span>
                <span className="pager__body"><span className="pager__label">Previous</span><span className="pager__title">This is the first lesson</span></span>
              </span>
            )}
            {nextUrl ? (
              <Link className="pager__link pager__link--next" href={nextUrl}>
                <span className="pager__arrow"><Icon name="arrow-right" className="icon-sm" /></span>
                <span className="pager__body">
                  <span className="pager__label">Next{nextSubject ? ' · ' + plainText(nextSubject.title, 28) : ''}</span>
                  <span className="pager__title" dir={nd} lang={nd === 'rtl' ? 'ps' : undefined}>{(nextL as { title: string }).title}</span>
                </span>
              </Link>
            ) : (
              <span className="pager__link pager__link--next pager__link--disabled">
                <span className="pager__arrow"><Icon name="arrow-right" className="icon-sm" /></span>
                <span className="pager__body"><span className="pager__label">Next</span><span className="pager__title">This is the last lesson</span></span>
              </span>
            )}
          </nav>

          <div className="pager-sticky">
            {prevUrl ? <Link className="btn btn-ghost btn-sm" href={prevUrl}><Icon name="arrow-left" className="icon-sm" /> Previous</Link> : <span></span>}
            <span className="pager-sticky__pos">Lesson {index} of {siblings.length}</span>
            {nextUrl ? <Link className="btn btn-primary btn-sm" href={nextUrl}>Next <Icon name="arrow-right" className="icon-sm" /></Link> : <span></span>}
          </div>

          {/* ---------- completion ---------- */}
          <section className="card card--pad-lg" style={{ borderLeft: `4px solid ${status === 'completed' ? 'var(--teal)' : 'var(--brand)'}` }}>
            <div className="row between" style={{ gap: 18 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{status === 'completed' ? 'You completed this lesson' : 'Finished studying this lesson?'}</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  {status === 'completed'
                    ? 'It counts towards your subject, semester and overall programme progress. You can revisit it any time.'
                    : 'Mark it as completed to update your subject and semester progress. You can always reopen it later.'}
                </p>
              </div>
              {status === 'completed' ? (
                <form action={reopenLesson} style={{ flex: 'none' }}>
                  <input type="hidden" name="lesson_id" value={lessonId} />
                  <button className="btn btn-ghost" type="submit"><Icon name="refresh" className="icon-sm" /> Reopen lesson</button>
                </form>
              ) : (
                <form action={completeLesson} style={{ flex: 'none' }}>
                  <input type="hidden" name="lesson_id" value={lessonId} />
                  <button className="btn btn-primary btn-lg" id="btn-complete" type="submit"><Icon name="check" /> Mark as completed</button>
                </form>
              )}
            </div>
          </section>
        </div>

        {/* ---------- right: details + what is next ---------- */}
        <aside className="lesson-side lesson-side--right stack">
          {nextUrl ? (
            <div className="card">
              <div className="card__head" style={{ marginBottom: 10 }}><h3 className="card__title">Next Lesson</h3></div>
              <Link className="next-lesson" href={nextUrl}>
                <span className="next-lesson__icon tile-teal"><Icon name="play" className="icon-sm" /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b dir={nd} lang={nd === 'rtl' ? 'ps' : undefined} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(nextL as { title: string }).title}</b>
                  <span>{nextSubject ? plainText(nextSubject.title, 30) : `Lesson ${index + 1}`}</span>
                </span>
                <Icon name="chevron-right" className="icon-sm" />
              </Link>
            </div>
          ) : null}

          <div className="card">
            <div className="card__head" style={{ marginBottom: 10 }}><h3 className="card__title">Lesson Details</h3></div>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row between"><span className="small muted">Semester</span><b className="small">{lesson.semester_number}</b></div>
              <div className="row between"><span className="small muted">Subject code</span><b className="small">{lesson.subject_code || '—'}</b></div>
              <div className="row between"><span className="small muted">Position</span><b className="small">{index} / {siblings.length}</b></div>
              <div className="row between"><span className="small muted">Recommended day</span><b className="small">Day {lesson.recommended_day}</b></div>
              <div className="row between"><span className="small muted">Duration</span><b className="small">{duration(lesson.duration_minutes)}</b></div>
              <div className="row between"><span className="small muted">Level</span><b className="small">{level.label}</b></div>
              <div className="row between"><span className="small muted">Requirement</span><b className="small">{lesson.is_required ? 'Required' : 'Optional'}</b></div>
            </div>
          </div>

          {quizzes.length ? (
            <div className="card" style={{ borderTop: '3px solid var(--brand)' }}>
              <div className="card__head" style={{ marginBottom: 8 }}><h3 className="card__title">Assessment</h3></div>
              <p className="small muted" style={{ margin: '0 0 10px' }}>This lesson has {quizzes.length} quiz{quizzes.length === 1 ? '' : 'zes'}. Passing marks the lesson complete.</p>
              <a className="btn btn-soft btn-sm btn-block" href="#assessment"><Icon name="clipboard" className="icon-sm" /> Go to the quiz</a>
            </div>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
