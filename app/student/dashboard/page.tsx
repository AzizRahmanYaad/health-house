import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { EmptyState, ProgressBar } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { todaysRecommendation } from '@/lib/lms';
import { nextLesson, overallProgress, pct, semesterProgressMap, subjectFacts, subjectProgressMap } from '@/lib/progress';
import { dayName, dirOf, fmtDayMonthYear, fmtTime, plainText, timeAgo, todayDow } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

interface Semester { id: number; number: number; title: string }
interface Subject { id: number; title: string }

export default async function StudentDashboard() {
  const user = await requireStudent('/student/dashboard');
  const uid = user.id;

  const mySemesterId = user.semester_id ?? null;
  const mySemester = mySemesterId ? await fetchOne<Semester>('SELECT * FROM semesters WHERE id = ?', [mySemesterId]) : null;

  const [overall, semMap, semesters, next, today] = await Promise.all([
    overallProgress(uid),
    semesterProgressMap(uid),
    fetchAll<Semester>('SELECT * FROM semesters WHERE is_active = TRUE ORDER BY sort_order, number'),
    nextLesson(uid, mySemesterId),
    todaysRecommendation(uid, mySemesterId),
  ]);

  const subjects = mySemesterId
    ? await fetchAll<Subject>('SELECT * FROM subjects WHERE semester_id = ? AND is_active = TRUE ORDER BY sort_order, id', [mySemesterId])
    : [];
  const subProg = await subjectProgressMap(uid, mySemesterId);

  const recent = await fetchAll<{ completed_at: Date; lesson_id: number; title: string; subject_title: string; color: string }>(
    `SELECT lp.completed_at, l.id AS lesson_id, l.title, s.title AS subject_title, s.color
       FROM lesson_progress lp
       JOIN lessons  l ON l.id = lp.lesson_id
       JOIN subjects s ON s.id = l.subject_id
      WHERE lp.user_id = ? AND lp.status = 'completed'
      ORDER BY lp.completed_at DESC
      LIMIT 6`, [uid]);

  const quizStats = (await fetchOne(
    `SELECT COUNT(*) AS attempts,
            COUNT(*) FILTER (WHERE passed) AS passed,
            ROUND(AVG(percentage)) AS avg_score
       FROM quiz_attempts WHERE user_id = ? AND completed_at IS NOT NULL`, [uid])) ?? { attempts: 0, passed: 0, avg_score: 0 };

  const announcements = await fetchAll<{ id: number; title: string; body: string | null; created_at: Date }>(
    'SELECT * FROM announcements WHERE semester_id IS NULL OR semester_id = ? ORDER BY created_at DESC LIMIT 3',
    [mySemesterId ?? 0]);

  await subjectFacts(uid, subjects.map(s => s.id));   // kept for parity with the PHP page

  /* programme-wide figures for the stat row (display only) */
  const totals = (await fetchOne(
    `SELECT (SELECT COUNT(*) FROM semesters WHERE is_active = TRUE) AS semesters,
            (SELECT COUNT(*) FROM lessons l JOIN subjects s ON s.id = l.subject_id
              WHERE l.is_active = TRUE AND s.is_active = TRUE)   AS lessons,
            (SELECT COUNT(*) FROM quizzes WHERE is_active = TRUE) AS quizzes`)) ?? { semesters: 0, lessons: 0, quizzes: 0 };
  const openSemesters = Object.values(semMap).filter(p => !p.locked).length;

  /* the soft icon-tile colours cycle across the course cards */
  const tiles = ['tile-red', 'tile-teal', 'tile-purple', 'tile-amber', 'tile-blue', 'tile-pink'];

  return (
    <Shell user={user} title="Dashboard" subtitle={mySemester ? mySemester.title : 'No semester assigned yet'}>

      {/* ===================== HERO ===================== */}
      <section className="hero-banner" style={{ marginBottom: 22 }}>
        <div>
          <h2>Learn Today<br />Save Lives Tomorrow</h2>
          <p>Quality midwifery education for a healthier mother and baby, and a brighter future.</p>
          {next ? (
            <>
              <Link className="btn btn-primary btn-lg" href={`/student/lesson/${next.id}`}>
                {next.status === 'in_progress' ? 'Continue Learning' : 'Start Learning'} <Icon name="arrow-right" className="icon-sm" />
              </Link>
              <div className="tiny dim" style={{ marginTop: 12 }}>
                Next up: <b style={{ color: 'var(--text-2)' }}>{plainText(next.title, 60)}</b> · {plainText(next.subject_title, 40)}
              </div>
            </>
          ) : (
            <Link className="btn btn-primary btn-lg" href="/student/learning">Browse My Courses <Icon name="arrow-right" className="icon-sm" /></Link>
          )}
        </div>
        <div className="hero-banner__art hide-sm">
          <p className="hero-banner__quote">&quot;Skilled midwives make a difference in every birth.&quot;</p>
        </div>
      </section>

      {/* ===================== KEY NUMBERS ===================== */}
      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', marginBottom: 26 }}>
        <div className="stat-tile reveal">
          <span className="stat-tile__icon tile-teal"><Icon name="layers" /></span>
          <div><div className="stat-tile__value">{openSemesters}<span className="dim" style={{ fontSize: '.9rem', fontWeight: 500 }}> / {toInt(totals.semesters)}</span></div>
               <div className="stat-tile__label">Semesters open</div></div>
        </div>
        <div className="stat-tile reveal">
          <span className="stat-tile__icon tile-red"><Icon name="book" /></span>
          <div><div className="stat-tile__value" data-count={toInt(totals.lessons)}>0</div>
               <div className="stat-tile__label">Total Lessons</div></div>
        </div>
        <div className="stat-tile reveal">
          <span className="stat-tile__icon tile-blue"><Icon name="check-circle" /></span>
          <div><div className="stat-tile__value" data-count={overall.completed}>0</div>
               <div className="stat-tile__label">Lessons Completed</div></div>
        </div>
        <div className="stat-tile reveal">
          <span className="stat-tile__icon tile-pink"><Icon name="clipboard" /></span>
          <div><div className="stat-tile__value" data-count={toInt(totals.quizzes)}>0</div>
               <div className="stat-tile__label">Quizzes</div></div>
        </div>
        <div className="stat-tile reveal">
          <span className="stat-tile__icon tile-purple"><Icon name="award" /></span>
          <div><div className="stat-tile__value"><span data-count={toInt(quizStats.avg_score)} data-suffix="%">0%</span></div>
               <div className="stat-tile__label">Average Quiz Score</div></div>
        </div>
      </section>

      {/* ===================== MY ONGOING COURSES ===================== */}
      {subjects.length ? (
        <section className="section">
          <div className="section__head">
            <h2>My Ongoing Courses</h2>
            <Link className="btn btn-ghost btn-sm" href="/student/learning">View All <Icon name="arrow-right" className="icon-sm" /></Link>
          </div>
          <div className="grid grid-4">
            {subjects.map((s, i) => {
              const p = subProg[s.id] ?? { total: 0, completed: 0, percent: 0 };
              const dir = dirOf(s.title);
              return (
                <Link key={s.id} className="course-card reveal" href={`/student/subject/${s.id}`}>
                  <div className="course-card__top">
                    <span className={`course-card__icon ${tiles[i % tiles.length]}`}>{[...s.title][0]?.toUpperCase()}</span>
                    <Icon name="chevron-right" className="course-card__go" />
                  </div>
                  <h3 dir={dir} lang={dir === 'rtl' ? 'ps' : undefined}>{s.title}</h3>
                  <div className="course-card__meta">Semester {mySemester?.number} &nbsp;•&nbsp; {p.percent}% complete</div>
                  <ProgressBar percent={p.percent} tone={p.percent >= 100 ? 'teal' : ''} className="bar-sm" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="split">
        <div>
          {/* ===================== TODAY ===================== */}
          <section className="section">
            <div className="section__head">
              <div>
                <h2>Today&rsquo;s recommended learning</h2>
                <p className="small muted" style={{ margin: 0 }}>{dayName(todayDow())}, {fmtDayMonthYear()} — a suggestion only, never attendance.</p>
              </div>
              <Link className="btn btn-ghost btn-sm" href="/student/timetable"><Icon name="calendar" className="icon-sm" /> Full timetable</Link>
            </div>

            <div className="card">
              <div className="row" style={{ gap: 26, marginBottom: 18, flexWrap: 'wrap' }}>
                <div><div className="stat__value" style={{ fontSize: '1.5rem' }}>{today.recommended}</div><div className="stat__label">Recommended</div></div>
                <div><div className="stat__value" style={{ fontSize: '1.5rem', color: 'var(--teal)' }}>{today.completed}</div><div className="stat__label">Completed</div></div>
                <div><div className="stat__value" style={{ fontSize: '1.5rem', color: 'var(--amber)' }}>{today.remaining}</div><div className="stat__label">Remaining</div></div>
                <div style={{ flex: 1, minWidth: 180, alignSelf: 'center' }}>
                  <ProgressBar percent={pct(today.completed, Math.max(1, today.recommended))} tone="teal" />
                  <div className="tiny dim" style={{ marginTop: 7 }}>No penalty applies for anything left uncompleted.</div>
                </div>
              </div>

              {today.items.length ? (
                <div className="lesson-list">
                  {today.items.map((slot, i) => slot.lesson_id ? (
                    <Link key={slot.id} className={`lesson-item ${slot.lesson_status === 'completed' ? 'is-done' : ''}`} href={`/student/lesson/${slot.lesson_id}`}>
                      <span className="lesson-item__num">
                        {slot.lesson_status === 'completed' ? <Icon name="check" className="icon-sm" /> : String(i + 1)}
                      </span>
                      <span className="lesson-item__body">
                        <span className="lesson-item__title">{slot.lesson_title ?? 'Lesson'}</span>
                        <span className="lesson-item__meta">
                          <span>{slot.subject_title}</span>
                          <span><Icon name="clock" className="icon-sm" /> {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}</span>
                        </span>
                      </span>
                      <span className={`badge ${slot.lesson_status === 'completed' ? 'badge-teal' : 'badge-amber'}`}>
                        {slot.lesson_status === 'completed' ? 'Completed' : 'Not completed'}
                      </span>
                    </Link>
                  ) : null)}
                </div>
              ) : (
                <EmptyState icon="calendar" title="Nothing scheduled for today"
                  text="There is no recommended timetable entry for today. You can still study any lesson you like."
                  action={<Link className="btn btn-primary btn-sm" href="/student/learning">Browse my subjects</Link>} />
              )}
            </div>
          </section>

          {!subjects.length ? (
            <section className="section">
              <div className="card"><EmptyState icon="book" title="No semester assigned"
                text="Your administrator has not assigned you to a semester yet, or this semester has no subjects."
                action={<Link className="btn btn-primary btn-sm" href="/student/learning">Browse all semesters</Link>} /></div>
            </section>
          ) : null}
        </div>

        {/* ===================== SIDE COLUMN ===================== */}
        <aside className="stack">
          <div className="card">
            <div className="card__head"><h3 className="card__title">Six-semester journey</h3></div>
            <div className="rail">
              {semesters.map(sem => {
                const p = semMap[sem.id] ?? { percent: 0, status: 'Not yet available', locked: true };
                const locked = !!p.locked;
                const isNow = mySemesterId === sem.id;
                const cls = locked ? 'is-locked' : (p.percent >= 100 ? 'done' : (isNow || p.percent > 0 ? 'current' : ''));
                return (
                  <div key={sem.id} className={`rail-item ${cls}`}>
                    <span className="rail-dot">
                      {locked ? <Icon name="lock" className="icon-sm" /> : p.percent >= 100 ? <Icon name="check" className="icon-sm" /> : sem.number}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row between" style={{ gap: 8 }}>
                        <b style={{ fontSize: '.9rem' }}>Semester {sem.number}</b>
                        {!locked ? <span className="tiny strong">{p.percent}%</span> : null}
                      </div>
                      {!locked ? <ProgressBar percent={p.percent} tone={p.percent >= 100 ? 'teal' : ''} className="bar-sm" /> : null}
                      <div className="tiny dim" style={{ marginTop: 5 }}>{p.status}{isNow && !locked ? ' · your semester' : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link className="btn btn-soft btn-sm btn-block" style={{ marginTop: 16 }} href="/student/progress">
              <Icon name="chart" className="icon-sm" /> Detailed progress
            </Link>
          </div>

          {recent.length ? (
            <div className="card">
              <div className="card__head"><h3 className="card__title">Recently completed</h3></div>
              <div className="stack" style={{ gap: 12 }}>
                {recent.map(r => (
                  <Link key={r.lesson_id} className="row" style={{ gap: 11 }} href={`/student/lesson/${r.lesson_id}`}>
                    <span className="stat__icon teal" style={{ width: 32, height: 32, margin: 0 }}><Icon name="check" className="icon-sm" /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: '.86rem', display: 'block' }}>{r.title}</b>
                      <span className="tiny dim">{r.subject_title} · {timeAgo(r.completed_at)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {announcements.length ? (
            <div className="card">
              <div className="card__head"><h3 className="card__title">Announcements</h3></div>
              <div className="stack" style={{ gap: 14 }}>
                {announcements.map(a => (
                  <div key={a.id}>
                    <div className="row row-tight" style={{ gap: 8, marginBottom: 4 }}>
                      <Icon name="bell" className="icon-sm" /><b style={{ fontSize: '.88rem' }}>{a.title}</b>
                    </div>
                    <p className="small muted" style={{ margin: 0 }}>{a.body}</p>
                    <div className="tiny dim" style={{ marginTop: 4 }}>{timeAgo(a.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card" style={{ borderLeft: '4px solid var(--teal)' }}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <Icon name="shield" />
              <div>
                <b style={{ fontSize: '.9rem' }}>No attendance, ever</b>
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  Studying outside the timetable is completely fine. Your progress is measured only by the lessons you complete.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
