import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { AlertBox, Avatar, EmptyState, ProgressBar } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, toInt } from '@/lib/db';
import { pct } from '@/lib/progress';
import { dayName, fmtTime, todayDow } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Progress monitor' };

interface Semester { id: number; number: number }
interface Student { id: number; full_name: string; email: string; avatar: string | null; student_code: string | null; semester_id: number | null; last_login_at: Date | null; semester_number: number | null }
interface SubjectRow { id: number; title: string; color: string; semester_number: number; semester_id: number; lessons: number; completions: number; students: number }
interface TodayRow { id: number; lesson_id: number | null; lesson_title: string | null; subject_title: string; semester_number: number; start_time: string; end_time: string; cohort: number; completed: number }

export default async function AdminProgressPage({ searchParams }: { searchParams: Promise<{ semester?: string }> }) {
  const user = await requireAdmin('/admin/progress');
  const sp = await searchParams;
  const filter = sp.semester === undefined ? -1 : toInt(sp.semester);

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters WHERE is_active = TRUE ORDER BY sort_order, number');

  let where = "u.role = 'student'";
  const params: unknown[] = [];
  if (filter > 0) { where += ' AND u.semester_id = ?'; params.push(filter); }

  const students = await fetchAll<Student>(
    `SELECT u.id, u.full_name, u.email, u.avatar, u.student_code, u.semester_id, u.last_login_at, sem.number AS semester_number
       FROM users u LEFT JOIN semesters sem ON sem.id = u.semester_id
      WHERE ${where} ORDER BY sem.number, u.full_name`, params);

  const semTotals: Record<number, number> = {};
  for (const r of await fetchAll<{ semester_id: number; total: number }>(
    `SELECT s.semester_id, COUNT(l.id) AS total FROM lessons l
       JOIN subjects s ON s.id = l.subject_id AND s.is_active = TRUE
      WHERE l.is_active = TRUE GROUP BY s.semester_id`)) semTotals[r.semester_id] = toInt(r.total);

  const done: Record<number, { done: number; doing: number }> = {};
  for (const r of await fetchAll<{ user_id: number; done: number; doing: number }>(
    `SELECT user_id, COUNT(*) FILTER (WHERE status='completed') AS done, COUNT(*) FILTER (WHERE status='in_progress') AS doing
       FROM lesson_progress GROUP BY user_id`)) done[r.user_id] = { done: toInt(r.done), doing: toInt(r.doing) };

  const quiz: Record<number, { attempts: number; avg: number; passed: number }> = {};
  for (const r of await fetchAll<{ user_id: number; attempts: number; avg: number; passed: number }>(
    `SELECT user_id, COUNT(*) AS attempts, ROUND(AVG(percentage)) AS avg, COUNT(*) FILTER (WHERE passed) AS passed
       FROM quiz_attempts WHERE completed_at IS NOT NULL GROUP BY user_id`)) quiz[r.user_id] = r;

  const subjectRows = await fetchAll<SubjectRow>(
    `SELECT s.id, s.title, s.color, sem.number AS semester_number, sem.id AS semester_id,
            (SELECT COUNT(*) FROM lessons l WHERE l.subject_id = s.id AND l.is_active = TRUE) AS lessons,
            (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
              WHERE l.subject_id = s.id AND lp.status = 'completed') AS completions,
            (SELECT COUNT(*) FROM users u WHERE u.semester_id = s.semester_id AND u.role = 'student') AS students
       FROM subjects s JOIN semesters sem ON sem.id = s.semester_id
      WHERE s.is_active = TRUE
      ORDER BY sem.number, s.sort_order`);

  const dow = todayDow();
  const todayRows = await fetchAll<TodayRow>(
    `SELECT t.id, t.lesson_id, l.title AS lesson_title, s.title AS subject_title, sem.number AS semester_number,
            t.start_time, t.end_time,
            (SELECT COUNT(*) FROM users u WHERE u.semester_id = t.semester_id AND u.role='student') AS cohort,
            (SELECT COUNT(*) FROM lesson_progress lp JOIN users u ON u.id = lp.user_id
              WHERE lp.lesson_id = t.lesson_id AND lp.status = 'completed' AND u.semester_id = t.semester_id) AS completed
       FROM timetable t
       JOIN subjects  s   ON s.id = t.subject_id
       JOIN semesters sem ON sem.id = t.semester_id
       LEFT JOIN lessons l ON l.id = t.lesson_id
      WHERE t.day_of_week = ?
      ORDER BY sem.number, t.start_time`, [dow]);

  return (
    <Shell user={user} title="Progress monitor" subtitle="Learning activity across the whole programme">
      <AlertBox type="info">This is a <b>learning</b> monitor, not an attendance register. Uncompleted recommended lessons simply remain open for the student.</AlertBox>

      <div className="row" style={{ margin: '22px 0', gap: 9 }}>
        <Link className={`chip ${filter === -1 ? 'active' : ''}`} href="/admin/progress">All semesters</Link>
        {semesters.map(s => (
          <Link key={s.id} className={`chip ${filter === s.id ? 'active' : ''}`} href={`/admin/progress?semester=${s.id}`}>Semester {s.number}</Link>
        ))}
      </div>

      <div className="tabs" data-tabs>
        <button className="tab active" data-tab="students"><Icon name="users" className="icon-sm" /> By student</button>
        <button className="tab" data-tab="subjects"><Icon name="book" className="icon-sm" /> By subject</button>
        <button className="tab" data-tab="today"><Icon name="calendar" className="icon-sm" /> Recommended vs actual today</button>
      </div>

      {/* ================= BY STUDENT ================= */}
      <div data-tab-panel="students">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{students.length} students</h2>
            <div className="input-icon" style={{ maxWidth: 260 }}>
              <Icon name="search" />
              <input className="input" type="search" placeholder="Search…" data-filter="#prog-rows tr" />
            </div>
          </div>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="tbl">
              <thead><tr><th>Student</th><th>Semester</th><th style={{ minWidth: 210 }}>Semester progress</th><th>In progress</th><th>Quizzes</th><th>Avg score</th><th></th></tr></thead>
              <tbody id="prog-rows">
                {students.map(s => {
                  const total = semTotals[s.semester_id ?? 0] ?? 0;
                  const d = done[s.id] ?? { done: 0, doing: 0 };
                  const p = pct(d.done, Math.max(1, total));
                  const qz = quiz[s.id] ?? null;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="row" style={{ gap: 11 }}>
                          <Avatar user={s} size="avatar-sm" />
                          <span style={{ minWidth: 0 }}>
                            <b style={{ display: 'block' }}>{s.full_name}</b>
                            <span className="tiny dim">{s.student_code || s.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>{s.semester_number ? <span className="badge badge-brand">S{s.semester_number}</span> : <span className="badge badge-amber">None</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <b style={{ minWidth: 40 }}>{p}%</b>
                          <div style={{ flex: 1 }}><ProgressBar percent={p} tone={p >= 100 ? 'teal' : ''} className="bar-sm" /></div>
                        </div>
                        <span className="tiny dim">{d.done} of {total} lessons completed</span>
                      </td>
                      <td><span className="badge badge-brand">{d.doing}</span></td>
                      <td>{qz ? `${toInt(qz.attempts)} · ${toInt(qz.passed)} passed` : '—'}</td>
                      <td>{qz ? <span className="badge badge-teal">{toInt(qz.avg)}%</span> : '—'}</td>
                      <td className="actions"><Link className="btn btn-ghost btn-sm" href={`/admin/student/${s.id}`}><Icon name="eye" className="icon-sm" /> Detail</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================= BY SUBJECT ================= */}
      <div data-tab-panel="subjects" hidden>
        <div className="grid grid-2">
          {subjectRows.filter(s => !(filter > 0 && s.semester_id !== filter)).map(s => {
            const possible = toInt(s.lessons) * Math.max(1, toInt(s.students));
            const p = toInt(s.students) > 0 ? pct(toInt(s.completions), possible) : 0;
            return (
              <div key={s.id} className="card card--hover reveal" style={{ borderLeft: `4px solid ${s.color}` }}>
                <div className="row between" style={{ marginBottom: 10 }}>
                  <div>
                    <b>{s.title}</b>
                    <div className="tiny dim">Semester {s.semester_number} · {toInt(s.lessons)} lessons · {toInt(s.students)} students</div>
                  </div>
                  <span className="badge badge-brand">{p}%</span>
                </div>
                <ProgressBar percent={p} tone={p >= 100 ? 'teal' : ''} />
                <div className="tiny dim" style={{ marginTop: 8 }}>{toInt(s.completions)} lesson completions out of {possible} possible</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= TODAY ================= */}
      <div data-tab-panel="today" hidden>
        {todayRows.length ? (
          <>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Time</th><th>Semester</th><th>Subject / lesson</th><th>Cohort</th><th>Completed</th><th style={{ minWidth: 180 }}>Uptake</th></tr></thead>
                <tbody>
                  {todayRows.map(r => {
                    const p = pct(toInt(r.completed), Math.max(1, toInt(r.cohort)));
                    return (
                      <tr key={r.id}>
                        <td className="nowrap"><b>{fmtTime(r.start_time)}–{fmtTime(r.end_time)}</b></td>
                        <td><span className="badge badge-brand">S{r.semester_number}</span></td>
                        <td><b>{r.subject_title}</b><div className="tiny dim">{r.lesson_title ?? 'No specific lesson'}</div></td>
                        <td>{toInt(r.cohort)}</td>
                        <td><span className="badge badge-teal">{toInt(r.completed)}</span></td>
                        <td>
                          <div className="row" style={{ gap: 10 }}>
                            <b style={{ minWidth: 40 }}>{p}%</b>
                            <div style={{ flex: 1 }}><ProgressBar percent={p} tone="teal" className="bar-sm" /></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ marginTop: 18, borderLeft: '4px solid var(--teal)' }}>
              <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <Icon name="shield" />
                <p className="small muted" style={{ margin: 0 }}>A low uptake figure means the lesson has not been completed <b>yet</b>. It is not an absence, no penalty is applied, and the lesson stays open indefinitely.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="card"><EmptyState icon="calendar" title="Nothing scheduled today" text={`No timetable slots exist for ${dayName(dow)}. Students continue with the lesson sequence as normal.`} /></div>
        )}
      </div>
    </Shell>
  );
}
