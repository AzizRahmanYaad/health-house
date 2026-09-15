import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { EmptyState, ProgressBar, StatCard } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, toInt, toNum } from '@/lib/db';
import { fmtDateTime } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quiz results' };

interface Attempt {
  id: number; percentage: number; passed: boolean; completed_at: Date;
  title: string; passing_score: number; lesson_title: string | null; subject_title: string | null;
}

export default async function ResultsPage() {
  const user = await requireStudent('/student/results');
  const uid = user.id;

  const attempts = await fetchAll<Attempt>(
    `SELECT a.*, qz.title, qz.passing_score, l.title AS lesson_title, s.title AS subject_title
       FROM quiz_attempts a
       JOIN quizzes qz ON qz.id = a.quiz_id
       LEFT JOIN lessons  l ON l.id = qz.lesson_id
       LEFT JOIN subjects s ON s.id = COALESCE(qz.subject_id, l.subject_id)
      WHERE a.user_id = ? AND a.completed_at IS NOT NULL
      ORDER BY a.completed_at DESC`, [uid]);

  const stats = (await fetchOne(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE passed) AS passed, ROUND(AVG(percentage)) AS avg, MAX(percentage) AS best
       FROM quiz_attempts WHERE user_id = ? AND completed_at IS NOT NULL`, [uid])) ?? { total: 0, passed: 0, avg: 0, best: 0 };

  return (
    <Shell user={user} title="Quiz results" subtitle="Every assessment you have taken">
      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <StatCard icon="clipboard" value={toInt(stats.total)} label="Total attempts" />
        <StatCard icon="check-circle" value={toInt(stats.passed)} label="Passed" tone="teal" />
        <StatCard icon="activity" value={toInt(stats.avg)} label="Average score" tone="amber" />
        <StatCard icon="award" value={toInt(stats.best)} label="Best score" tone="rose" />
      </div>

      {attempts.length ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Attempt history</h2>
            <div className="input-icon" style={{ maxWidth: 260 }}>
              <Icon name="search" />
              <input className="input" type="search" placeholder="Search quiz or subject…" data-filter="#attempt-rows tr" />
            </div>
          </div>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="tbl">
              <thead><tr><th>Quiz</th><th>Subject / lesson</th><th>Score</th><th>Result</th><th>Date</th><th></th></tr></thead>
              <tbody id="attempt-rows">
                {attempts.map(a => {
                  const p = Math.round(toNum(a.percentage));
                  return (
                    <tr key={a.id}>
                      <td><b>{a.title}</b></td>
                      <td className="small muted">{a.subject_title ?? '—'}{a.lesson_title ? ' · ' + a.lesson_title : ''}</td>
                      <td style={{ minWidth: 150 }}>
                        <div className="row" style={{ gap: 10 }}>
                          <b style={{ minWidth: 44 }}>{p}%</b>
                          <div style={{ flex: 1 }}><ProgressBar percent={p} tone={a.passed ? 'teal' : 'rose'} className="bar-sm" /></div>
                        </div>
                      </td>
                      <td><span className={`badge ${a.passed ? 'badge-teal' : 'badge-danger'}`}>{a.passed ? 'Passed' : 'Not passed'}</span></td>
                      <td className="small muted nowrap">{fmtDateTime(a.completed_at)}</td>
                      <td className="actions">
                        <Link className="btn btn-ghost btn-sm" href={`/student/result/${a.id}`}><Icon name="eye" className="icon-sm" /> Review</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card"><EmptyState icon="clipboard" title="No quiz attempts yet"
          text="Once you take a quiz inside a lesson, your score and a full answer review will appear here."
          action={<Link className="btn btn-primary btn-sm" href="/student/continue">Continue learning</Link>} /></div>
      )}
    </Shell>
  );
}
