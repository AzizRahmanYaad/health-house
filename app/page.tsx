import Link from 'next/link';
import { redirect } from 'next/navigation';
import Icon from '@/components/Icon';
import { ProgressRing } from '@/components/ui';
import { currentUser } from '@/lib/auth';
import { APP_INSTITUTION, APP_NAME, APP_SHORT } from '@/lib/config';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { currentYear, semesterShortTitle } from '@/lib/text';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');

  const semesters = await fetchAll<{ id: number; number: number; title: string; description: string | null }>(
    'SELECT * FROM semesters WHERE is_active = TRUE ORDER BY sort_order, number');

  const totals = (await fetchOne(
    `SELECT (SELECT COUNT(*) FROM semesters WHERE is_active=TRUE) AS semesters,
            (SELECT COUNT(*) FROM subjects  WHERE is_active=TRUE) AS subjects,
            (SELECT COUNT(*) FROM lessons   WHERE is_active=TRUE) AS lessons,
            (SELECT COUNT(*) FROM quizzes   WHERE is_active=TRUE) AS quizzes`)) ?? { semesters: 6, subjects: 0, lessons: 0, quizzes: 0 };

  const subjectsBySemester: Record<number, { id: number; title: string; color: string }[]> = {};
  for (const s of await fetchAll<{ id: number; semester_id: number; title: string; color: string }>(
    'SELECT id, semester_id, title, color FROM subjects WHERE is_active = TRUE ORDER BY sort_order, id')) {
    (subjectsBySemester[s.semester_id] ||= []).push(s);
  }

  const flow = ['Six semesters', 'Subjects', 'Ordered lessons', 'Video / PDF / Slides', 'Quiz', 'Lesson completed', 'Subject progress', 'Semester progress'];
  const features: [string, string, string][] = [
    ['play-circle', 'Sequential learning path', 'Lessons appear in the exact order the administrator configures, with a clear current-lesson marker.'],
    ['target',      'Continue learning', 'One button takes the student straight to the next recommended lesson — Udemy style.'],
    ['video',       'Rich lesson content', 'Video, text, PDF, slides and additional resources attached to every lesson.'],
    ['clipboard',   'Quizzes & scoring', 'Single-answer, multiple-answer and true/false questions with passing scores and attempt limits.'],
    ['chart',       'Progress at every level', 'Lesson → subject → semester → full six-semester programme progress, calculated automatically.'],
    ['calendar',    'Optional timetable', 'A recommended daily schedule that guides study without ever controlling access.'],
    ['users',       'Student management', 'Accounts, credentials, semester assignment and individual progress records.'],
    ['activity',    'Recommended vs actual', 'Administrators can compare what was recommended today with what was actually completed.'],
    ['shield',      'Secure by default', 'Hashed passwords, CSRF-protected forms and prepared statements throughout.'],
  ];

  return (
    <>
      <header className="site-header">
        <div className="container row between">
          <Link className="logo" href="/">
            <span className="logo__mark"><Icon name="logo" /></span>
            <span className="logo__text"><b>{APP_SHORT}</b><span>{APP_INSTITUTION}</span></span>
          </Link>
          <nav className="site-nav">
            <a className="navlink" href="#how">How it works</a>
            <a className="navlink" href="#curriculum">Curriculum</a>
            <a className="navlink" href="#features">Features</a>
            <button className="iconbtn" data-theme-toggle aria-label="Toggle dark mode">
              <Icon name="sun" className="only-dark" /><Icon name="moon" className="only-light" />
            </button>
            <Link className="btn btn-primary" href="/login"><Icon name="lock" className="icon-sm" /> Sign in</Link>
          </nav>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <span className="eyebrow"><Icon name="sparkle" className="icon-sm" /> Six-semester midwifery programme</span>
            <h1>Learn midwifery <span className="grad-text">step by step</span>, at your own pace.</h1>
            <p className="lead">
              Health House is a structured learning platform built around the way midwifery is actually taught:
              semester → subject → ordered lessons → learning materials → video → quiz → progress.
              The timetable is a recommendation, never an attendance register.
            </p>
            <div className="hero__cta">
              <Link className="btn btn-primary btn-lg" href="/login"><Icon name="play-circle" /> Start learning</Link>
              <a className="btn btn-ghost btn-lg" href="#curriculum"><Icon name="layers" /> Explore the curriculum</a>
            </div>
            <div className="hero__stats">
              <div className="hero__stat"><b data-count={toInt(totals.semesters)}>0</b><span>Semesters</span></div>
              <div className="hero__stat"><b data-count={toInt(totals.subjects)}>0</b><span>Subjects</span></div>
              <div className="hero__stat"><b data-count={toInt(totals.lessons)}>0</b><span>Lessons</span></div>
              <div className="hero__stat"><b data-count={toInt(totals.quizzes)}>0</b><span>Quizzes</span></div>
            </div>
          </div>

          {/* animated product mock */}
          <div className="mock">
            <div className="mock__bar"><i></i><i></i><i></i></div>
            <div className="card card--flat" style={{ background: 'var(--surface-2)', marginBottom: 14 }}>
              <div className="row between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="uppercase dim">Continue learning</div>
                  <b style={{ fontSize: '1.02rem' }}>Skeletal System</b>
                  <div className="tiny dim">Anatomy &amp; Physiology I · Lesson 3</div>
                </div>
                <ProgressRing percent={65} size={78} stroke={8} caption="subject" />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge badge-brand"><Icon name="video" className="icon-sm" /> Video</span>
                <span className="badge badge-teal"><Icon name="file-text" className="icon-sm" /> PDF</span>
                <span className="badge badge-amber"><Icon name="clipboard" className="icon-sm" /> Quiz</span>
              </div>
            </div>
            <div className="lesson-list">
              <div className="lesson-item is-done"><span className="lesson-item__num"><Icon name="check" className="icon-sm" /></span>
                <span className="lesson-item__body"><span className="lesson-item__title">Introduction to Anatomy</span></span>
                <span className="badge badge-teal">Completed</span></div>
              <div className="lesson-item is-done"><span className="lesson-item__num"><Icon name="check" className="icon-sm" /></span>
                <span className="lesson-item__body"><span className="lesson-item__title">Organisation of the Body</span></span>
                <span className="badge badge-teal">Completed</span></div>
              <div className="lesson-item is-current"><span className="lesson-item__num"><Icon name="play" className="icon-sm" /></span>
                <span className="lesson-item__body"><span className="lesson-item__title">The Skeletal System</span></span>
                <span className="badge badge-brand">Current</span></div>
              <div className="lesson-item"><span className="lesson-item__num">4</span>
                <span className="lesson-item__body"><span className="lesson-item__title">The Muscular System</span></span>
                <span className="badge">Not started</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LEARNING MODEL ================= */}
      <section id="how" className="container section" style={{ paddingTop: 20 }}>
        <div className="center" style={{ maxWidth: 720, margin: '0 auto 34px' }}>
          <span className="eyebrow"><Icon name="compass" className="icon-sm" /> The learning model</span>
          <h2 style={{ marginTop: 16 }}>One clear path from enrolment to graduation</h2>
          <p className="lead">Every piece of content lives in a defined position in the sequence, so students always know exactly what comes next.</p>
        </div>
        <div className="flow reveal">
          {flow.map((node, i) => (
            <span key={node} style={{ display: 'contents' }}>
              <span className="flow__node">{node}</span>
              {i < flow.length - 1 ? <span className="flow__arrow"><Icon name="arrow-right" className="icon-sm" /></span> : null}
            </span>
          ))}
        </div>
        <div className="card card--pad-lg reveal" style={{ marginTop: 34, borderLeft: '4px solid var(--teal)' }}>
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            <span className="stat__icon teal" style={{ margin: 0 }}><Icon name="shield" /></span>
            <div>
              <h3 style={{ marginBottom: 6 }}>This is a learning system — not an attendance system</h3>
              <p className="muted" style={{ margin: 0 }}>
                The timetable only suggests when to study. Missing a scheduled slot never marks a student absent,
                never applies a penalty and never blocks access to a lesson. The lesson simply stays
                <em> not completed</em> until the student is ready for it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CURRICULUM ================= */}
      <section id="curriculum" className="container section">
        <div className="section__head">
          <div>
            <span className="eyebrow"><Icon name="layers" className="icon-sm" /> Curriculum</span>
            <h2 style={{ marginTop: 14, marginBottom: 4 }}>The six-semester journey</h2>
            <p className="muted">Each semester carries its own subjects, ordered lessons and assessments.</p>
          </div>
        </div>
        <div className="grid grid-3">
          {semesters.map(sem => (
            <article key={sem.id} className="card card--hover reveal">
              <div className="row between" style={{ marginBottom: 12 }}>
                <span className="subject-card__icon">{sem.number}</span>
                <span className="badge badge-brand">Semester {sem.number}</span>
              </div>
              <h3>{semesterShortTitle(sem.title)}</h3>
              <p className="small muted">{sem.description}</p>
              <div className="row row-tight" style={{ marginTop: 14 }}>
                {(subjectsBySemester[sem.id] ?? []).map(s => (
                  <span key={s.id} className="badge" style={{ borderLeft: `3px solid ${s.color}` }}>{s.title}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="container section">
        <div className="center" style={{ maxWidth: 700, margin: '0 auto 34px' }}>
          <span className="eyebrow"><Icon name="zap" className="icon-sm" /> Features</span>
          <h2 style={{ marginTop: 16 }}>Everything a midwifery programme needs</h2>
        </div>
        <div className="grid grid-3">
          {features.map(f => (
            <article key={f[1]} className="feature reveal">
              <div className="feature__icon"><Icon name={f[0]} /></div>
              <h3>{f[1]}</h3>
              <p>{f[2]}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="container section">
        <div className="hero-continue reveal" style={{ textAlign: 'center' }}>
          <span className="eyebrow"><Icon name="heart" className="icon-sm" /> Ready when you are</span>
          <h2>Pick up exactly where you left off</h2>
          <p style={{ maxWidth: 560, margin: '0 auto 22px' }}>
            Sign in with the credentials issued by your programme administrator and continue your learning journey.
          </p>
          <Link className="btn btn-ghost btn-lg" href="/login"><Icon name="arrow-right" /> Sign in to the portal</Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container row between">
          <div className="row" style={{ gap: 10 }}>
            <span className="logo__mark" style={{ width: 30, height: 30 }}><Icon name="logo" className="icon-sm" /></span>
            <div>
              <b style={{ display: 'block', color: 'var(--text)' }}>{APP_NAME}</b>
              <span className="tiny">© {currentYear()} {APP_INSTITUTION}. All rights reserved.</span>
            </div>
          </div>
          <div className="row" style={{ gap: 18 }}>
            <a className="navlink" href="#how">How it works</a>
            <a className="navlink" href="#curriculum">Curriculum</a>
            <Link className="navlink" href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
