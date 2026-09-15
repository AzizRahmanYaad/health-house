import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { AlertBox, Avatar, ProgressBar, StatCard } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { APP_INSTITUTION } from '@/lib/config';
import { fetchAll, fetchOne, fetchValue, toInt } from '@/lib/db';
import { pct } from '@/lib/progress';
import { fmtLongDate, semesterShortTitle, timeAgo, todayDow } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin dashboard' };

interface SemesterRow { id: number; number: number; title: string; subjects: number; lessons: number; students: number }
interface TopStudent { id: number; full_name: string; avatar: string | null; student_code: string | null; semester_number: number | null; completed: number }
interface Activity { id: number; action: string; detail: string | null; created_at: Date; full_name: string | null; role: string | null }

export default async function AdminDashboard() {
  const user = await requireAdmin('/admin/dashboard');

  const counts = (await fetchOne(
    `SELECT (SELECT COUNT(*) FROM semesters WHERE is_active=TRUE)          AS semesters,
            (SELECT COUNT(*) FROM subjects  WHERE is_active=TRUE)          AS subjects,
            (SELECT COUNT(*) FROM lessons   WHERE is_active=TRUE)          AS lessons,
            (SELECT COUNT(*) FROM quizzes   WHERE is_active=TRUE)          AS quizzes,
            (SELECT COUNT(*) FROM users     WHERE role='student')          AS students,
            (SELECT COUNT(*) FROM users     WHERE role='student' AND status='active') AS active_students,
            (SELECT COUNT(*) FROM lesson_materials)                        AS materials,
            (SELECT COUNT(*) FROM timetable)                               AS slots`)) ?? {};

  const completions = toInt(await fetchValue("SELECT COUNT(*) FROM lesson_progress WHERE status = 'completed'", [], 0));
  const inProgress  = toInt(await fetchValue("SELECT COUNT(*) FROM lesson_progress WHERE status = 'in_progress'", [], 0));
  const week        = toInt(await fetchValue("SELECT COUNT(*) FROM lesson_progress WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'", [], 0));
  const quizAvg     = toInt(await fetchValue('SELECT ROUND(AVG(percentage)) FROM quiz_attempts WHERE completed_at IS NOT NULL', [], 0));

  /* per-semester cohort progress */
  const semesterRows = await fetchAll<SemesterRow>(
    `SELECT sem.id, sem.number, sem.title,
            (SELECT COUNT(*) FROM subjects s WHERE s.semester_id = sem.id AND s.is_active=TRUE) AS subjects,
            (SELECT COUNT(*) FROM lessons l JOIN subjects s ON s.id = l.subject_id
              WHERE s.semester_id = sem.id AND l.is_active=TRUE AND s.is_active=TRUE)         AS lessons,
            (SELECT COUNT(*) FROM users u WHERE u.semester_id = sem.id AND u.role='student')   AS students
       FROM semesters sem WHERE sem.is_active=TRUE ORDER BY sem.sort_order, sem.number`);

  const cohort: Record<number, number> = {};
  for (const r of await fetchAll<{ semester_id: number; done: number }>(
    `SELECT s.semester_id, COUNT(lp.id) AS done
       FROM lesson_progress lp
       JOIN lessons  l ON l.id = lp.lesson_id
       JOIN subjects s ON s.id = l.subject_id
      WHERE lp.status = 'completed'
      GROUP BY s.semester_id`)) {
    cohort[r.semester_id] = toInt(r.done);
  }

  /* most active students */
  const topStudents = await fetchAll<TopStudent>(
    `SELECT u.id, u.full_name, u.avatar, u.student_code, sem.number AS semester_number,
            COUNT(lp.id) AS completed
       FROM users u
       LEFT JOIN lesson_progress lp ON lp.user_id = u.id AND lp.status = 'completed'
       LEFT JOIN semesters sem ON sem.id = u.semester_id
      WHERE u.role = 'student'
      GROUP BY u.id, sem.number
      ORDER BY completed DESC, u.full_name
      LIMIT 6`);

  const recentActivity = await fetchAll<Activity>(
    `SELECT a.*, u.full_name, u.role FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 10`);

  /* today's recommended vs actual, across the cohort */
  const dow = todayDow();
  const todaySlots = toInt(await fetchValue('SELECT COUNT(*) FROM timetable WHERE day_of_week = ?', [dow], 0));
  const todayDone  = toInt(await fetchValue(
    `SELECT COUNT(*) FROM lesson_progress lp
       JOIN timetable t ON t.lesson_id = lp.lesson_id AND t.day_of_week = ?
       JOIN users u ON u.id = lp.user_id AND u.semester_id = t.semester_id
      WHERE lp.status = 'completed' AND lp.completed_at::date = CURRENT_DATE`, [dow], 0));

  const actions: [string, string, string, string][] = [
    ['layers',    'Manage semesters',   'Structure the six-semester programme.', '/admin/semesters'],
    ['book',      'Manage subjects',    'Add subjects and set their order.',     '/admin/subjects'],
    ['list',      'Lessons & sequence', 'Control the exact lesson order.',       '/admin/lessons'],
    ['clipboard', 'Quizzes',            'Build questions and passing scores.',   '/admin/quizzes'],
    ['users',     'Students',           'Accounts, credentials and semesters.',  '/admin/students'],
    ['calendar',  'Timetable',          'Optional recommended schedule.',        '/admin/timetable'],
  ];

  return (
    <Shell user={user} title="Admin dashboard" subtitle={`${APP_INSTITUTION} · ${fmtLongDate()}`}
           topbarActions={<Link className="btn btn-primary btn-sm hide-sm" href="/admin/lesson"><Icon name="plus" className="icon-sm" /> New lesson</Link>}>

      <section className="grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="users" value={toInt(counts.students)} label="Enrolled students" foot={`${toInt(counts.active_students)} active accounts`} />
        <StatCard icon="book" value={toInt(counts.subjects)} label="Subjects published" tone="teal" foot={`${toInt(counts.semesters)} active semesters`} />
        <StatCard icon="list" value={toInt(counts.lessons)} label="Lessons in sequence" tone="amber" foot={`${toInt(counts.materials)} attached materials`} />
        <StatCard icon="check-circle" value={completions} label="Lesson completions" tone="rose" foot={`${week} in the last 7 days`} />
      </section>

      <div className="split">
        <div>
          <section className="section">
            <div className="section__head">
              <h2>Programme structure &amp; cohort progress</h2>
              <Link className="btn btn-ghost btn-sm" href="/admin/progress">Progress monitor <Icon name="arrow-right" className="icon-sm" /></Link>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Semester</th><th>Subjects</th><th>Lessons</th><th>Students</th><th style={{ minWidth: 210 }}>Cohort completion</th></tr></thead>
                <tbody>
                  {semesterRows.map(s => {
                    const possible = toInt(s.lessons) * Math.max(1, toInt(s.students));
                    const done = cohort[s.id] ?? 0;
                    const percent = toInt(s.students) > 0 ? pct(done, possible) : 0;
                    return (
                      <tr key={s.id}>
                        <td><b>Semester {s.number}</b><div className="tiny dim">{semesterShortTitle(s.title)}</div></td>
                        <td>{toInt(s.subjects)}</td>
                        <td>{toInt(s.lessons)}</td>
                        <td><span className="badge">{toInt(s.students)}</span></td>
                        <td>
                          <div className="row" style={{ gap: 10 }}>
                            <b style={{ minWidth: 42 }}>{percent}%</b>
                            <div style={{ flex: 1 }}><ProgressBar percent={percent} tone={percent >= 100 ? 'teal' : ''} className="bar-sm" /></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <div className="section__head"><h2>Recommended today vs actual</h2></div>
            <div className="card">
              <AlertBox type="info">This comparison is for insight only. Students are <b>never</b> marked absent for not following the timetable and nothing is locked as a result.</AlertBox>
              <div className="row" style={{ gap: 30, flexWrap: 'wrap', marginTop: 6 }}>
                <div><div className="stat__value" style={{ fontSize: '1.6rem' }}>{todaySlots}</div><div className="stat__label">Slots scheduled today</div></div>
                <div><div className="stat__value" style={{ fontSize: '1.6rem', color: 'var(--teal)' }}>{todayDone}</div><div className="stat__label">Completed today by students</div></div>
                <div><div className="stat__value" style={{ fontSize: '1.6rem', color: 'var(--brand)' }}>{inProgress}</div><div className="stat__label">Lessons currently in progress</div></div>
                <div><div className="stat__value" style={{ fontSize: '1.6rem', color: 'var(--amber)' }}>{quizAvg}%</div><div className="stat__label">Average quiz score</div></div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section__head"><h2>Quick actions</h2></div>
            <div className="grid grid-3">
              {actions.map(a => (
                <Link key={a[3]} className="feature reveal" href={a[3]}>
                  <div className="feature__icon"><Icon name={a[0]} /></div>
                  <h3>{a[1]}</h3>
                  <p>{a[2]}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card__head">
              <h3 className="card__title">Most active students</h3>
              <Link className="tiny strong" style={{ color: 'var(--brand)' }} href="/admin/students">All</Link>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              {topStudents.map(s => (
                <Link key={s.id} className="row" style={{ gap: 11 }} href={`/admin/student/${s.id}`}>
                  <Avatar user={s} size="avatar-sm" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: '.86rem', display: 'block' }}>{s.full_name}</b>
                    <span className="tiny dim">{s.semester_number ? `Semester ${s.semester_number}` : 'Unassigned'}</span>
                  </span>
                  <span className="badge badge-teal">{toInt(s.completed)}</span>
                </Link>
              ))}
              {!topStudents.length ? <p className="small dim">No students yet.</p> : null}
            </div>
          </div>

          <div className="card">
            <div className="card__head"><h3 className="card__title">Recent activity</h3></div>
            <div className="stack" style={{ gap: 12 }}>
              {recentActivity.map(a => (
                <div key={a.id} className="row" style={{ gap: 11 }}>
                  <span className={`stat__icon ${a.action === 'lesson_completed' ? 'teal' : a.action === 'quiz_attempt' ? 'amber' : ''}`}
                        style={{ width: 32, height: 32, borderRadius: 10, margin: 0 }}>
                    <Icon name={a.action === 'lesson_completed' ? 'check' : a.action === 'quiz_attempt' ? 'clipboard' : 'user'} className="icon-sm" />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: '.83rem', display: 'block' }}>{a.full_name ?? 'Someone'}</b>
                    <span className="tiny dim">{a.action.replace(/_/g, ' ')}{a.detail ? ' — ' + a.detail : ''}</span>
                  </span>
                  <span className="tiny dim nowrap">{timeAgo(a.created_at)}</span>
                </div>
              ))}
              {!recentActivity.length ? <p className="small dim">No activity recorded yet.</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
