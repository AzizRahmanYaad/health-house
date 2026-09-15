import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { Avatar, EmptyState, ProgressBar, StatCard } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, toInt, toNum } from '@/lib/db';
import { fmtDateTime, trimNumber } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quiz results' };

interface Attempt {
  id: number; user_id: number; score: number; total_marks: number; percentage: number; passed: boolean; completed_at: Date;
  full_name: string; avatar: string | null; student_code: string | null; semester_number: number | null;
  quiz_title: string; passing_score: number; lesson_title: string | null;
}

export default async function AdminResultsPage({ searchParams }: { searchParams: Promise<{ quiz?: string }> }) {
  const user = await requireAdmin('/admin/results');
  const quizFilter = toInt((await searchParams).quiz);
  const quizzes = await fetchAll<{ id: number; title: string }>('SELECT id, title FROM quizzes ORDER BY title');

  let where = 'a.completed_at IS NOT NULL';
  const params: unknown[] = [];
  if (quizFilter) { where += ' AND a.quiz_id = ?'; params.push(quizFilter); }

  const attempts = await fetchAll<Attempt>(
    `SELECT a.*, u.full_name, u.avatar, u.student_code, sem.number AS semester_number,
            qz.title AS quiz_title, qz.passing_score, l.title AS lesson_title
       FROM quiz_attempts a
       JOIN users   u  ON u.id = a.user_id
       JOIN quizzes qz ON qz.id = a.quiz_id
       LEFT JOIN lessons   l   ON l.id = qz.lesson_id
       LEFT JOIN semesters sem ON sem.id = u.semester_id
      WHERE ${where}
      ORDER BY a.completed_at DESC
      LIMIT 300`, params);

  const summary = (await fetchOne(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE passed) AS passed, ROUND(AVG(percentage)) AS avg
       FROM quiz_attempts a WHERE ${where}`, params)) ?? { total: 0, passed: 0, avg: 0 };

  return (
    <Shell user={user} title="Quiz results" subtitle="Every completed attempt across the programme">
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="clipboard" value={toInt(summary.total)} label="Attempts recorded" />
        <StatCard icon="check-circle" value={toInt(summary.passed)} label="Passed" tone="teal" />
        <StatCard icon="x" value={Math.max(0, toInt(summary.total) - toInt(summary.passed))} label="Not passed" tone="rose" />
        <StatCard icon="award" value={toInt(summary.avg)} label="Average score" tone="amber" />
      </div>

      <div className="row between" style={{ marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <form method="get" action="/admin/results" className="row row-tight">
          <select className="select" name="quiz" data-autosubmit style={{ minWidth: 260 }} defaultValue={quizFilter || ''}>
            <option value="">All quizzes</option>
            {quizzes.map(qz => <option key={qz.id} value={qz.id}>{qz.title}</option>)}
          </select>
          <noscript><button className="btn btn-ghost btn-sm" type="submit">Filter</button></noscript>
        </form>
        <div className="input-icon" style={{ maxWidth: 260 }}>
          <Icon name="search" />
          <input className="input" type="search" placeholder="Search student…" data-filter="#result-rows tr" />
        </div>
      </div>

      {attempts.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Student</th><th>Quiz</th><th style={{ minWidth: 170 }}>Score</th><th>Result</th><th>Marks</th><th>Date</th></tr></thead>
            <tbody id="result-rows">
              {attempts.map(a => {
                const p = Math.round(toNum(a.percentage));
                return (
                  <tr key={a.id}>
                    <td>
                      <Link className="row" style={{ gap: 11 }} href={`/admin/student/${a.user_id}`}>
                        <Avatar user={a} size="avatar-sm" />
                        <span style={{ minWidth: 0 }}>
                          <b style={{ display: 'block' }}>{a.full_name}</b>
                          <span className="tiny dim">{a.semester_number ? `Semester ${a.semester_number}` : 'Unassigned'}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <b className="small">{a.quiz_title}</b>
                      {a.lesson_title ? <div className="tiny dim">{a.lesson_title}</div> : null}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <b style={{ minWidth: 44 }}>{p}%</b>
                        <div style={{ flex: 1 }}><ProgressBar percent={p} tone={a.passed ? 'teal' : 'rose'} className="bar-sm" /></div>
                      </div>
                    </td>
                    <td><span className={`badge ${a.passed ? 'badge-teal' : 'badge-danger'}`}>{a.passed ? 'Passed' : 'Not passed'}</span></td>
                    <td className="small muted nowrap">{trimNumber(toNum(a.score))} / {trimNumber(toNum(a.total_marks))}</td>
                    <td className="small muted nowrap">{fmtDateTime(a.completed_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card"><EmptyState icon="award" title="No attempts yet" text="Results appear here as soon as students take a quiz." /></div>
      )}
    </Shell>
  );
}
