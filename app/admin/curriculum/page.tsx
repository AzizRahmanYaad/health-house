/**
 * Load the full Semester 1 curriculum from data/curriculum/*.json.
 * Rebuilding is destructive by design: it removes the existing Semester 1
 * subjects and recreates them. Nothing in another semester is touched.
 */
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { AlertBox } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { curriculumFileInfo } from '@/lib/curriculum';
import { fetchOne, fetchValue, toInt } from '@/lib/db';
import { humanSize } from '@/lib/text';
import LoaderForm from './LoaderForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Curriculum loader' };

export default async function CurriculumPage() {
  const user = await requireAdmin('/admin/curriculum');

  const semester = await fetchOne<{ id: number }>('SELECT * FROM semesters WHERE number = 1');
  const current = { subjects: 0, lessons: 0, progress: 0, videos: 0 };
  if (semester) {
    const sid = semester.id;
    current.subjects = toInt(await fetchValue('SELECT COUNT(*) FROM subjects WHERE semester_id = ?', [sid], 0));
    current.lessons  = toInt(await fetchValue('SELECT COUNT(*) FROM lessons l JOIN subjects s ON s.id = l.subject_id WHERE s.semester_id = ?', [sid], 0));
    current.progress = toInt(await fetchValue(
      `SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id JOIN subjects s ON s.id = l.subject_id WHERE s.semester_id = ?`, [sid], 0));
    current.videos   = toInt(await fetchValue(
      `SELECT COUNT(*) FROM lessons l JOIN subjects s ON s.id = l.subject_id WHERE s.semester_id = ? AND l.video_type <> 'none'`, [sid], 0));
  }

  const files = await curriculumFileInfo();
  const allPresent = files.every(f => f.ok);

  return (
    <Shell user={user} title="Curriculum loader" subtitle="Load the full Semester 1 syllabus"
           crumbs={[{ label: 'Administration', href: '/admin/dashboard' }, { label: 'Curriculum' }]}>

      <div className="page-head">
        <div>
          <h1>Curriculum loader</h1>
          <p className="muted" style={{ margin: 0 }}>
            The full Semester 1 syllabus — 4 subjects, 121 Pashto lessons over a 20-week plan — is stored as structured data
            in <code>data/curriculum/</code>. Run it from here to (re)build Semester 1.
          </p>
        </div>
      </div>

      <div className="split">
        <div>
          <section className="card card--pad-lg" style={{ marginBottom: 20 }}>
            <div className="card__head"><h3 className="card__title">Semester 1 as it stands</h3></div>

            {!semester ? (
              <AlertBox type="error">Semester 1 does not exist in this database. Run <code>npm run db:setup</code> first.</AlertBox>
            ) : (
              <>
                <div className="row" style={{ gap: 30, flexWrap: 'wrap', marginBottom: 20 }}>
                  <div><div className="stat__value" style={{ fontSize: '1.5rem' }}>{current.subjects}</div><div className="stat__label">Subjects</div></div>
                  <div><div className="stat__value" style={{ fontSize: '1.5rem' }}>{current.lessons}</div><div className="stat__label">Lessons</div></div>
                  <div><div className="stat__value" style={{ fontSize: '1.5rem', color: current.progress ? 'var(--warning)' : 'inherit' }}>{current.progress}</div><div className="stat__label">Student progress rows</div></div>
                </div>

                {current.lessons >= 100 ? (
                  <AlertBox type="info">This looks like the full curriculum is already loaded. Running it again rebuilds it from scratch.</AlertBox>
                ) : current.lessons > 0 ? (
                  <AlertBox type="warning">Semester 1 currently holds only <b>{current.lessons}</b> lessons. Running the loader replaces them with the full syllabus.</AlertBox>
                ) : null}

                {current.progress > 0 ? (
                  <AlertBox type="warning"><b>{current.progress} student progress record{current.progress === 1 ? '' : 's'}</b> are attached to the current Semester 1 lessons. Rebuilding deletes those lessons, and the progress goes with them. Semesters 2–6 are not affected.</AlertBox>
                ) : null}

                <LoaderForm ready={allPresent} hasVideos={current.videos > 0} />
              </>
            )}
          </section>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card__head"><h3 className="card__title">Source files</h3></div>
            <div className="stack" style={{ gap: 10 }}>
              {files.map(f => (
                <div key={f.file} className="row between" style={{ gap: 10 }}>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ fontSize: '.84rem', display: 'block' }}>{f.label}</b>
                    <span className="tiny dim">{f.file}</span>
                  </span>
                  <span className={`badge ${f.ok ? 'badge-teal' : 'badge-danger'}`}>{f.ok ? humanSize(f.size) : 'missing'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card__head"><h3 className="card__title">Why this page exists</h3></div>
            <p className="small muted" style={{ margin: 0 }}>
              The curriculum source is part of the application, not the database, so a fresh database can be filled
              with the complete syllabus behind your administrator sign-in without importing anything by hand.
            </p>
          </div>

          <div className="card" style={{ borderLeft: '3px solid var(--brand)' }}>
            <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
              <Icon name="info" />
              <div>
                <b style={{ fontSize: '.87rem' }}>Safe to run again</b>
                <p className="small muted" style={{ margin: '4px 0 0' }}>The loader replaces the four Semester 1 subjects rather than adding duplicates, so running it twice leaves the same result.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
