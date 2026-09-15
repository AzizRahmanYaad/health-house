/**
 * Search across the curriculum. Students search what they can study;
 * administrators additionally search the people they manage.
 */
import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { Dir, EmptyState } from '@/components/ui';
import { requireLogin } from '@/lib/auth';
import { fetchAll } from '@/lib/db';
import { difficultyMeta, dirOf, duration, plainText, statusMeta, ucfirst } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

interface SubjectHit { id: number; title: string; code: string | null; description: string | null; semester_number: number }
interface LessonHit { id: number; title: string; description: string | null; duration_minutes: number; difficulty: string; subject_title: string; subject_id: number; semester_number: number; status: string }
interface StudentHit { id: number; full_name: string; email: string; student_code: string | null; status: string }

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireLogin('/search');
  const isAdminUser = user.role === 'admin';
  const q = String((await searchParams).q ?? '').trim();

  let subjects: SubjectHit[] = [], lessons: LessonHit[] = [], students: StudentHit[] = [];

  if (q !== '' && [...q].length >= 2) {
    const like = '%' + q + '%';

    subjects = await fetchAll<SubjectHit>(
      `SELECT s.*, sem.number AS semester_number
         FROM subjects s
         JOIN semesters sem ON sem.id = s.semester_id
        WHERE s.is_active = TRUE AND (s.title ILIKE ? OR s.code ILIKE ? OR s.description ILIKE ?)
        ORDER BY (s.title ILIKE ?) DESC, sem.sort_order, s.sort_order
        LIMIT 12`, [like, like, like, like]);

    lessons = await fetchAll<LessonHit>(
      `SELECT l.id, l.title, l.description, l.duration_minutes, l.difficulty,
              s.title AS subject_title, s.id AS subject_id,
              sem.number AS semester_number,
              COALESCE(lp.status, 'not_started') AS status
         FROM lessons l
         JOIN subjects  s   ON s.id = l.subject_id
         JOIN semesters sem ON sem.id = s.semester_id
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
        WHERE l.is_active = TRUE AND (l.title ILIKE ? OR l.description ILIKE ? OR l.content ILIKE ?)
        ORDER BY (l.title ILIKE ?) DESC, sem.sort_order, s.sort_order, l.sort_order
        LIMIT 40`, [user.id, like, like, like, like]);

    if (isAdminUser) {
      students = await fetchAll<StudentHit>(
        `SELECT id, full_name, email, student_code, status
           FROM users
          WHERE role = 'student' AND (full_name ILIKE ? OR email ILIKE ? OR student_code ILIKE ?)
          ORDER BY full_name LIMIT 12`, [like, like, like]);
    }
  }

  const hits = subjects.length + lessons.length + students.length;
  const home = isAdminUser ? '/admin/dashboard' : '/student/dashboard';

  return (
    <Shell user={user} title="Search"
           subtitle={q !== '' ? `${hits} result${hits === 1 ? '' : 's'} for “${q}”` : 'Find a subject or a lesson'}
           crumbs={[{ label: isAdminUser ? 'Administration' : 'Home', href: home }, { label: 'Search' }]}>

      <div className="page-head">
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>Search</h1>
          <form method="get" action="/search" style={{ marginTop: 12, maxWidth: 560 }}>
            <div className="input-icon">
              <Icon name="search" />
              <input className="input" type="search" name="q" defaultValue={q} autoFocus
                     placeholder={isAdminUser ? 'Lessons, subjects, students…' : 'Lessons and subjects…'} />
            </div>
          </form>
        </div>
      </div>

      {q === '' ? (
        <div className="card"><EmptyState icon="search" title="What are you looking for?"
          text="Type at least two characters. You can search lesson titles, lesson text and subject names." /></div>
      ) : [...q].length < 2 ? (
        <div className="card"><EmptyState icon="search" title="Keep typing" text="A search needs at least two characters." /></div>
      ) : !hits ? (
        <div className="card"><EmptyState icon="search" title="Nothing matched"
          text={`No subject or lesson contains “${q}”. Try a shorter or more general word.`} /></div>
      ) : (
        <>
          {subjects.length ? (
            <section className="section">
              <div className="section__head"><h2>Subjects <span className="badge">{subjects.length}</span></h2></div>
              <div className="grid grid-3">
                {subjects.map(s => (
                  <Link key={s.id} className="topic" href={`/student/subject/${s.id}`}>
                    <div className="topic__head">
                      <span className="topic__icon">{[...s.title][0]?.toUpperCase()}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Dir as="h3" text={s.title} className="topic__title" />
                        <div className="topic__sub">Semester {s.semester_number}{s.code ? ` · ${s.code}` : ''}</div>
                      </div>
                    </div>
                    {String(s.description ?? '').trim() !== '' ? <p className="topic__desc">{plainText(s.description, 130)}</p> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {lessons.length ? (
            <section className="section">
              <div className="section__head"><h2>Lessons <span className="badge">{lessons.length}</span></h2></div>
              <div className="stack" style={{ gap: 8 }}>
                {lessons.map(l => {
                  const meta = statusMeta(l.status);
                  const lvl = difficultyMeta(l.difficulty);
                  const dir = dirOf(l.title);
                  return (
                    <Link key={l.id} className={`lesson-item ${meta.class}`} href={`/student/lesson/${l.id}`}>
                      <span className="lesson-item__num">
                        {l.status === 'completed' ? <Icon name="check" className="icon-sm" /> : <Icon name="play" className="icon-sm" />}
                      </span>
                      <span className="lesson-item__body">
                        <span className="lesson-item__title" dir={dir} lang={dir === 'rtl' ? 'ps' : undefined}>{l.title}</span>
                        <span className="lesson-item__meta">
                          <span>Semester {l.semester_number}</span>
                          <span>{plainText(l.subject_title, 40)}</span>
                          <span className={`level ${lvl.class}`}>{lvl.label}</span>
                          {l.duration_minutes ? <span>{duration(l.duration_minutes)}</span> : null}
                        </span>
                      </span>
                      <Icon name="chevron-right" className="icon-sm" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {students.length ? (
            <section className="section">
              <div className="section__head"><h2>Students <span className="badge">{students.length}</span></h2></div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Name</th><th>Email</th><th>Code</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {students.map(st => (
                      <tr key={st.id}>
                        <td><b>{st.full_name}</b></td>
                        <td className="dim">{st.email}</td>
                        <td className="dim">{st.student_code || '—'}</td>
                        <td><span className={`badge ${st.status === 'active' ? 'badge-teal' : ''}`}>{ucfirst(st.status)}</span></td>
                        <td className="actions">
                          <Link className="btn btn-ghost btn-sm" href={`/admin/student/${st.id}`}>Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </Shell>
  );
}
