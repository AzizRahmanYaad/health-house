import Link from 'next/link';
import { redirect } from 'next/navigation';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { AlertBox, Avatar, ProgressBar, ProgressRing, StatCard } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, fetchValue, toInt, toNum } from '@/lib/db';
import { todaysRecommendation } from '@/lib/lms';
import { overallProgress, semesterProgressMap, subjectProgressMap } from '@/lib/progress';
import { fmtDateTime, statusMeta, timeAgo, ucfirst } from '@/lib/text';

export const dynamic = 'force-dynamic';

interface Student {
  id: number; full_name: string; email: string; phone: string | null; avatar: string | null; student_code: string | null;
  semester_id: number | null; status: string; last_login_at: Date | null; semester_number: number | null; semester_title: string | null;
}
interface Semester { id: number; number: number }
interface Subject { id: number; semester_id: number; title: string }
interface Recent { id: number; status: string; updated_at: Date; title: string; subject_title: string }
interface Attempt { id: number; percentage: number; passed: boolean; completed_at: Date; title: string }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await fetchOne<{ full_name: string }>('SELECT full_name FROM users WHERE id = ?', [toInt((await params).id)]);
  return { title: s?.full_name ?? 'Student' };
}

export default async function StudentViewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const id = toInt((await params).id);

  const student = await fetchOne<Student>(
    `SELECT u.*, sem.number AS semester_number, sem.title AS semester_title
       FROM users u LEFT JOIN semesters sem ON sem.id = u.semester_id
      WHERE u.id = ? AND u.role = 'student'`, [id]);
  if (!student) redirect('/admin/students');

  const [overall, semMap, subProg, semesters] = await Promise.all([
    overallProgress(id), semesterProgressMap(id), subjectProgressMap(id),
    fetchAll<Semester>('SELECT * FROM semesters WHERE is_active = TRUE ORDER BY sort_order, number'),
  ]);

  const subjectsBySemester: Record<number, Subject[]> = {};
  for (const s of await fetchAll<Subject>('SELECT * FROM subjects WHERE is_active = TRUE ORDER BY sort_order, id')) {
    (subjectsBySemester[s.semester_id] ||= []).push(s);
  }

  const recent = await fetchAll<Recent>(
    `SELECT lp.*, l.title, s.title AS subject_title
       FROM lesson_progress lp
       JOIN lessons  l ON l.id = lp.lesson_id
       JOIN subjects s ON s.id = l.subject_id
      WHERE lp.user_id = ?
      ORDER BY lp.updated_at DESC LIMIT 12`, [id]);

  const attempts = await fetchAll<Attempt>(
    `SELECT a.*, qz.title FROM quiz_attempts a JOIN quizzes qz ON qz.id = a.quiz_id
      WHERE a.user_id = ? AND a.completed_at IS NOT NULL ORDER BY a.completed_at DESC LIMIT 10`, [id]);

  const today = await todaysRecommendation(id, student.semester_id);
  const inProgressNow = toInt(await fetchValue("SELECT COUNT(*) FROM lesson_progress WHERE user_id=? AND status='in_progress'", [id], 0));

  return (
    <Shell user={user} title={student.full_name} subtitle="Individual progress record">
      <Link className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} href="/admin/students"><Icon name="arrow-left" className="icon-sm" /> All students</Link>

      <section className="card card--pad-lg reveal" style={{ marginBottom: 26 }}>
        <div className="row between" style={{ gap: 26, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 18, flex: 1, minWidth: 260 }}>
            <Avatar user={student} size="avatar-lg" />
            <div>
              <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>{student.full_name}</h1>
              <p className="muted" style={{ marginBottom: 10 }}>{student.email}{student.phone ? ' · ' + student.phone : ''}</p>
              <div className="row row-tight">
                <span className="badge badge-brand">{student.semester_number ? `Semester ${student.semester_number}` : 'Unassigned'}</span>
                {student.student_code ? <span className="badge">{student.student_code}</span> : null}
                <span className={`badge ${student.status === 'active' ? 'badge-teal' : 'badge-danger'}`}>{ucfirst(student.status)}</span>
                <span className="badge">Last sign-in {timeAgo(student.last_login_at)}</span>
              </div>
              <div className="row row-tight" style={{ marginTop: 16 }}>
                <Link className="btn btn-soft btn-sm" href={`/admin/students?edit=${id}`}><Icon name="edit" className="icon-sm" /> Edit account</Link>
              </div>
            </div>
          </div>
          <div><ProgressRing percent={overall.percent} size={160} stroke={13} caption="programme" /></div>
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <StatCard icon="check-circle" value={overall.completed} label="Lessons completed" tone="teal" foot={`of ${overall.total} in the programme`} />
        <StatCard icon="clipboard" value={attempts.length} label="Recent quiz attempts" tone="amber" />
        <StatCard icon="calendar" value={today.recommended} label="Recommended today" foot={`${today.completed} completed today`} />
        <StatCard icon="activity" value={inProgressNow} label="In progress now" tone="rose" />
      </div>

      <AlertBox type="info">Anything left uncompleted from the recommended schedule is <b>not</b> an absence. This record shows learning activity only.</AlertBox>

      <div className="split" style={{ marginTop: 22 }}>
        <div className="stack">
          <section className="card">
            <div className="card__head"><h2 className="card__title">Progress by semester and subject</h2></div>
            {semesters.map(sem => {
              const p = semMap[sem.id] ?? { percent: 0, completed: 0, total: 0 };
              const subs = subjectsBySemester[sem.id] ?? [];
              return (
                <div key={sem.id} style={{ marginBottom: 22 }}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <b style={{ fontSize: '.94rem' }}>Semester {sem.number}
                      {student.semester_id === sem.id ? <span className="badge badge-amber" style={{ marginLeft: 6 }}>Current</span> : null}
                    </b>
                    <span className="small"><b>{p.percent}%</b> <span className="dim">· {p.completed}/{p.total}</span></span>
                  </div>
                  <ProgressBar percent={p.percent} tone={p.percent >= 100 ? 'teal' : ''} />
                  {subs.length ? (
                    <div className="stack" style={{ gap: 9, marginTop: 12, paddingLeft: 14, borderLeft: '2px solid var(--line)' }}>
                      {subs.map(s => {
                        const sp = subProg[s.id] ?? { percent: 0, completed: 0, total: 0 };
                        return (
                          <div key={s.id}>
                            <div className="row between" style={{ marginBottom: 5 }}>
                              <span className="small">{s.title}</span>
                              <span className="tiny dim">{sp.completed}/{sp.total} · {sp.percent}%</span>
                            </div>
                            <ProgressBar percent={sp.percent} tone={sp.percent >= 100 ? 'teal' : ''} className="bar-sm" />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>

          {attempts.length ? (
            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}><h2 style={{ fontSize: '1.02rem', margin: 0 }}>Quiz attempts</h2></div>
              <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
                <table className="tbl">
                  <thead><tr><th>Quiz</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
                  <tbody>
                    {attempts.map(a => (
                      <tr key={a.id}>
                        <td><b>{a.title}</b></td>
                        <td>{Math.round(toNum(a.percentage))}%</td>
                        <td><span className={`badge ${a.passed ? 'badge-teal' : 'badge-danger'}`}>{a.passed ? 'Passed' : 'Not passed'}</span></td>
                        <td className="small muted nowrap">{fmtDateTime(a.completed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card__head"><h3 className="card__title">Recent learning activity</h3></div>
            <div className="stack" style={{ gap: 13 }}>
              {recent.map(r => {
                const m = statusMeta(r.status);
                return (
                  <div key={r.id} className="row" style={{ gap: 11 }}>
                    <span className={`stat__icon ${r.status === 'completed' ? 'teal' : ''}`} style={{ width: 32, height: 32, borderRadius: 10, margin: 0 }}>
                      <Icon name={r.status === 'completed' ? 'check' : 'play'} className="icon-sm" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: '.84rem', display: 'block' }}>{r.title}</b>
                      <span className="tiny dim">{r.subject_title} · {m.label}</span>
                    </span>
                    <span className="tiny dim nowrap">{timeAgo(r.updated_at)}</span>
                  </div>
                );
              })}
              {!recent.length ? <p className="small dim">This student has not opened any lesson yet.</p> : null}
            </div>
          </div>

          <div className="card">
            <div className="card__head"><h3 className="card__title">Today&rsquo;s recommendation</h3></div>
            {today.items.length ? (
              <div className="stack" style={{ gap: 10 }}>
                {today.items.map(t => (
                  <div key={t.id} className="row between" style={{ gap: 10 }}>
                    <span className="small" style={{ minWidth: 0 }}>{t.lesson_title ?? t.subject_title}</span>
                    <span className={`badge ${t.lesson_status === 'completed' ? 'badge-teal' : 'badge-amber'}`}>{t.lesson_status === 'completed' ? 'Done' : 'Open'}</span>
                  </div>
                ))}
              </div>
            ) : <p className="small dim">Nothing scheduled today for this semester.</p>}
          </div>
        </aside>
      </div>
    </Shell>
  );
}
