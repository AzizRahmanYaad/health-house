import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { Avatar, EmptyState, ProgressBar } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { pct } from '@/lib/progress';
import { timeAgo } from '@/lib/text';
import CheckAll from './CheckAll';
import { bulkSemester, deleteStudent, saveStudent } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Students' };

interface Semester { id: number; number: number }
interface Student {
  id: number; full_name: string; email: string; avatar: string | null; student_code: string | null; phone: string | null;
  semester_id: number | null; status: string; last_login_at: Date | null; semester_number: number | null; completed: number; attempts: number;
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ semester?: string; edit?: string }> }) {
  const user = await requireAdmin('/admin/students');
  const sp = await searchParams;

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters ORDER BY sort_order, number');
  const filter = sp.semester === undefined ? -1 : toInt(sp.semester);
  const editId = toInt(sp.edit);
  const edit = editId ? await fetchOne<Student>("SELECT * FROM users WHERE id = ? AND role = 'student'", [editId]) : null;

  let where = "u.role = 'student'";
  const params: unknown[] = [];
  if (filter > 0) { where += ' AND u.semester_id = ?'; params.push(filter); }
  else if (filter === 0) { where += ' AND u.semester_id IS NULL'; }

  const students = await fetchAll<Student>(
    `SELECT u.*, sem.number AS semester_number,
            (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.status='completed') AS completed,
            (SELECT COUNT(*) FROM quiz_attempts a WHERE a.user_id = u.id AND a.completed_at IS NOT NULL) AS attempts
       FROM users u LEFT JOIN semesters sem ON sem.id = u.semester_id
      WHERE ${where} ORDER BY sem.number, u.full_name`, params);

  /* lesson totals per semester, to show each student's percentage */
  const semTotals: Record<number, number> = {};
  for (const r of await fetchAll<{ semester_id: number; total: number }>(
    `SELECT s.semester_id, COUNT(l.id) AS total FROM lessons l
       JOIN subjects s ON s.id = l.subject_id AND s.is_active = TRUE
      WHERE l.is_active = TRUE GROUP BY s.semester_id`)) {
    semTotals[r.semester_id] = toInt(r.total);
  }
  const filterVal = Math.max(0, filter);

  return (
    <Shell user={user} title="Students" subtitle="Accounts, credentials and semester assignment">
      <div className="row between" style={{ marginBottom: 22, gap: 12, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 9 }}>
          <Link className={`chip ${filter === -1 ? 'active' : ''}`} href="/admin/students">All</Link>
          {semesters.map(s => (
            <Link key={s.id} className={`chip ${filter === s.id ? 'active' : ''}`} href={`/admin/students?semester=${s.id}`}>Semester {s.number}</Link>
          ))}
          <Link className={`chip ${filter === 0 ? 'active' : ''}`} href="/admin/students?semester=0">Unassigned</Link>
        </div>
        <div className="input-icon" style={{ maxWidth: 260 }}>
          <Icon name="search" />
          <input className="input" type="search" placeholder="Search students…" data-filter="#student-rows tr" />
        </div>
      </div>

      <div className="split">
        <div>
          {students.length ? (
            <>
              <form action={bulkSemester}>
                <input type="hidden" name="semester_filter" value={filterVal} />
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}><CheckAll /></th>
                        <th>Student</th><th>Semester</th><th style={{ minWidth: 190 }}>Progress</th><th>Quizzes</th><th>Last sign-in</th><th></th>
                      </tr>
                    </thead>
                    <tbody id="student-rows">
                      {students.map(s => {
                        const total = semTotals[s.semester_id ?? 0] ?? 0;
                        const percent = pct(toInt(s.completed), Math.max(1, total));
                        return (
                          <tr key={s.id}>
                            <td><input type="checkbox" name="student_ids[]" value={s.id} className="row-check" style={{ accentColor: 'var(--brand)', width: 17, height: 17 }} /></td>
                            <td>
                              <div className="row" style={{ gap: 11 }}>
                                <Avatar user={s} size="avatar-sm" />
                                <span style={{ minWidth: 0 }}>
                                  <b style={{ display: 'block' }}>{s.full_name}
                                    {s.status !== 'active' ? <span className="badge badge-danger" style={{ marginLeft: 6 }}>Inactive</span> : null}
                                  </b>
                                  <span className="tiny dim">{s.email}{s.student_code ? ' · ' + s.student_code : ''}</span>
                                </span>
                              </div>
                            </td>
                            <td>{s.semester_number ? <span className="badge badge-brand">S{s.semester_number}</span> : <span className="badge badge-amber">None</span>}</td>
                            <td>
                              <div className="row" style={{ gap: 10 }}>
                                <b style={{ minWidth: 40 }}>{percent}%</b>
                                <div style={{ flex: 1 }}><ProgressBar percent={percent} tone={percent >= 100 ? 'teal' : ''} className="bar-sm" /></div>
                              </div>
                              <span className="tiny dim">{toInt(s.completed)} of {total} lessons</span>
                            </td>
                            <td><span className="badge">{toInt(s.attempts)}</span></td>
                            <td className="small muted nowrap">{timeAgo(s.last_login_at)}</td>
                            <td className="actions">
                              <Link className="btn btn-ghost btn-sm" href={`/admin/student/${s.id}`}><Icon name="chart" className="icon-sm" /></Link>
                              <Link className="btn btn-soft btn-sm" href={`/admin/students?edit=${s.id}`}><Icon name="edit" className="icon-sm" /></Link>
                              <button className="btn btn-danger btn-sm" type="submit" form={`del-${s.id}`}
                                      data-confirm={`Delete ${s.full_name} and all of their progress?`}><Icon name="trash" className="icon-sm" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="card row between" style={{ marginTop: 16, gap: 14 }}>
                  <div className="row" style={{ gap: 12 }}>
                    <span className="small strong">Move selected students to</span>
                    <select className="select" name="bulk_semester_id" style={{ width: 'auto', minWidth: 190 }} defaultValue="">
                      <option value="">— Unassigned —</option>
                      {semesters.map(s => <option key={s.id} value={s.id}>Semester {s.number}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-dark btn-sm" type="submit"><Icon name="users" className="icon-sm" /> Apply</button>
                </div>
              </form>

              {students.map(s => (
                <form key={s.id} action={deleteStudent} id={`del-${s.id}`} style={{ display: 'none' }}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="semester_filter" value={filterVal} />
                </form>
              ))}
            </>
          ) : (
            <div className="card"><EmptyState icon="users" title="No students here" text="Create the first student account with the form beside this panel." /></div>
          )}
        </div>

        <aside>
          <form key={edit?.id ?? 'new'} className="card card--pad-lg" action={saveStudent} style={{ position: 'sticky', top: 96 }}>
            <input type="hidden" name="id" value={edit ? edit.id : ''} />
            <input type="hidden" name="semester_filter" value={filterVal} />

            <div className="card__head">
              <h3 className="card__title">{edit ? 'Edit student' : 'Add a student'}</h3>
              {edit ? <Link className="tiny strong" style={{ color: 'var(--brand)' }} href="/admin/students">Cancel</Link> : null}
            </div>

            <div className="field">
              <label htmlFor="full_name">Full name</label>
              <input className="input" id="full_name" name="full_name" defaultValue={edit?.full_name ?? ''} required />
            </div>
            <div className="field">
              <label htmlFor="email">Email (used to sign in)</label>
              <input className="input" type="email" id="email" name="email" defaultValue={edit?.email ?? ''} required />
            </div>
            <div className="field">
              <label htmlFor="password">{edit ? 'New password (leave blank to keep)' : 'Password'}</label>
              <input className="input" type="password" id="password" name="password" required={!edit} minLength={6} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="student_code">Student code</label>
                <input className="input" id="student_code" name="student_code" defaultValue={edit?.student_code ?? ''} placeholder="MW-2026-001" />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input className="input" id="phone" name="phone" defaultValue={edit?.phone ?? ''} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="semester_id">Semester</label>
                <select className="select" id="semester_id" name="semester_id" defaultValue={edit?.semester_id ?? ''}>
                  <option value="">— Unassigned —</option>
                  {semesters.map(s => <option key={s.id} value={s.id}>Semester {s.number}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select className="select" id="status" name="status" defaultValue={edit?.status ?? 'active'}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary btn-block" type="submit">
              <Icon name={edit ? 'save' : 'plus'} className="icon-sm" /> {edit ? 'Save student' : 'Create student'}
            </button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
