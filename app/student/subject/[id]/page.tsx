import Link from 'next/link';
import { redirect } from 'next/navigation';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { Dir, EmptyState, LessonItem, ProgressRing } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { subjectProgress } from '@/lib/progress';
import { dirOf, plainText, statusMeta } from '@/lib/text';

export const dynamic = 'force-dynamic';

interface Subject {
  id: number; title: string; code: string | null; credits: number; description: string | null; color: string;
  semester_number: number; semester_title: string; semester_id: number;
}
interface Lesson {
  id: number; title: string; description: string | null; difficulty: string; duration_minutes: number;
  video_type: string; recommended_day: number; is_required: boolean; status: string; quiz_count: number; material_count: number;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await fetchOne<{ title: string }>('SELECT title FROM subjects WHERE id = ?', [toInt(id)]);
  return { title: s?.title ?? 'Subject' };
}

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const uid = user.id;
  const subjectId = toInt((await params).id);

  const subject = await fetchOne<Subject>(
    `SELECT s.*, sem.number AS semester_number, sem.title AS semester_title, sem.id AS semester_id
       FROM subjects s JOIN semesters sem ON sem.id = s.semester_id
      WHERE s.id = ? AND s.is_active = TRUE`, [subjectId]);
  if (!subject) redirect('/student/learning');

  const lessons = await fetchAll<Lesson>(
    `SELECT l.*, COALESCE(lp.status, 'not_started') AS status,
            (SELECT COUNT(*) FROM quizzes qz WHERE qz.lesson_id = l.id AND qz.is_active = TRUE) AS quiz_count,
            (SELECT COUNT(*) FROM lesson_materials m WHERE m.lesson_id = l.id) AS material_count
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE l.subject_id = ? AND l.is_active = TRUE
      ORDER BY l.sort_order, l.id`, [uid, subjectId]);

  const prog = await subjectProgress(uid, subjectId);

  /* the first lesson that is not completed = the current lesson */
  const currentId = lessons.find(l => l.status !== 'completed')?.id ?? null;

  /* group by recommended day */
  const byDay = new Map<number, Lesson[]>();
  for (const l of lessons) {
    if (!byDay.has(l.recommended_day)) byDay.set(l.recommended_day, []);
    byDay.get(l.recommended_day)!.push(l);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <Shell user={user} title={subject.title} subtitle={`Semester ${subject.semester_number}`}
           crumbs={[
             { label: 'Home', href: '/student/dashboard' },
             { label: 'Courses', href: `/student/learning?semester=${subject.semester_id}` },
             { label: plainText(subject.title, 34) },
           ]}>

      <Link className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} href={`/student/learning?semester=${subject.semester_id}`}>
        <Icon name="arrow-left" className="icon-sm" /> Back to Semester {subject.semester_number}
      </Link>

      <section className="card card--pad-lg reveal" style={{ marginBottom: 26, borderTop: '4px solid var(--brand)' }}>
        <div className="row between" style={{ gap: 26 }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <div className="row row-tight" style={{ marginBottom: 12 }}>
              {subject.code ? <span className="badge badge-brand">{subject.code}</span> : null}
              <span className="badge">{subject.credits} credits</span>
              <span className="badge">{lessons.length} lessons</span>
            </div>
            <h1 dir={dirOf(subject.title)} style={{ fontSize: '1.7rem', marginBottom: 8, lineHeight: 1.7 }}>{subject.title}</h1>
            <Dir as="p" text={subject.description} className="muted" />

            <div className="row" style={{ gap: 26, marginTop: 18 }}>
              <div><b style={{ fontSize: '1.25rem', color: 'var(--teal)' }}>{prog.completed}</b><div className="tiny dim">Completed</div></div>
              <div><b style={{ fontSize: '1.25rem', color: 'var(--amber)' }}>{prog.remaining}</b><div className="tiny dim">Remaining</div></div>
              <div><b style={{ fontSize: '1.25rem' }}>{prog.total}</b><div className="tiny dim">Total lessons</div></div>
            </div>

            {currentId ? (
              <Link className="btn btn-primary" style={{ marginTop: 20 }} href={`/student/lesson/${currentId}`}>
                <Icon name="play" /> Continue this subject
              </Link>
            ) : (
              <div className="alert alert-success" style={{ marginTop: 20, marginBottom: 0 }}>
                <Icon name="award" /><div>You have completed every lesson in this subject.</div>
              </div>
            )}
          </div>
          <div className="hide-sm"><ProgressRing percent={prog.percent} size={150} stroke={13} caption="complete" /></div>
        </div>
      </section>

      <div className="tabs" data-tabs>
        <button className="tab active" data-tab="sequence"><Icon name="list" className="icon-sm" /> Lesson sequence</button>
        <button className="tab" data-tab="days"><Icon name="calendar" className="icon-sm" /> By recommended day</button>
      </div>

      <div data-tab-panel="sequence">
        {lessons.length ? (
          <div className="lesson-list stagger">
            {lessons.map((l, i) => (
              <LessonItem key={l.id} lesson={l} status={l.status} href={`/student/lesson/${l.id}`} index={i + 1} isNext={l.id === currentId} />
            ))}
          </div>
        ) : (
          <div className="card"><EmptyState icon="list" title="No lessons yet" text="The administrator has not published lessons for this subject." /></div>
        )}
      </div>

      <div data-tab-panel="days" hidden>
        <div className="stack">
          {days.map(day => {
            const items = byDay.get(day)!;
            return (
              <div key={day} className="tt-day">
                <div className="tt-day__head">
                  <b>Day {day}</b>
                  <span className="badge">{items.length} lesson{items.length > 1 ? 's' : ''}</span>
                </div>
                {items.map(l => {
                  const meta = statusMeta(l.status);
                  const ldir = dirOf(l.title);
                  return (
                    <Link key={l.id} className="tt-slot" dir={ldir} lang={ldir === 'rtl' ? 'ps' : undefined} href={`/student/lesson/${l.id}`}>
                      <span className="tt-slot__bar"></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: '.92rem', display: 'block', lineHeight: 1.8 }}>{l.title}</b>
                        <span className="tiny dim">{plainText(l.description, 110)}</span>
                      </span>
                      <span className={`badge ${l.status === 'completed' ? 'badge-teal' : l.status === 'in_progress' ? 'badge-brand' : ''}`}>{meta.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
