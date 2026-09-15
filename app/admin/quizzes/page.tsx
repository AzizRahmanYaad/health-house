import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { EmptyState, StatCard } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchValue, toInt } from '@/lib/db';
import { plainText } from '@/lib/text';
import { deleteQuiz, toggleQuiz } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quizzes' };

interface QuizRow {
  id: number; title: string; description: string | null; passing_score: number; is_active: boolean;
  lesson_title: string | null; lesson_id: number | null; subject_title: string | null; semester_number: number | null;
  questions: number; attempts: number; avg_score: number | null;
}

export default async function QuizzesPage() {
  const user = await requireAdmin('/admin/quizzes');

  const quizzes = await fetchAll<QuizRow>(
    `SELECT qz.*,
            l.title AS lesson_title, l.id AS lesson_id,
            s.title AS subject_title, sem.number AS semester_number,
            (SELECT COUNT(*) FROM quiz_questions q WHERE q.quiz_id = qz.id) AS questions,
            (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = qz.id AND a.completed_at IS NOT NULL) AS attempts,
            (SELECT ROUND(AVG(a.percentage)) FROM quiz_attempts a WHERE a.quiz_id = qz.id AND a.completed_at IS NOT NULL) AS avg_score
       FROM quizzes qz
       LEFT JOIN lessons   l   ON l.id = qz.lesson_id
       LEFT JOIN subjects  s   ON s.id = COALESCE(qz.subject_id, l.subject_id)
       LEFT JOIN semesters sem ON sem.id = s.semester_id
      ORDER BY sem.number, s.sort_order, l.sort_order, qz.id`);

  const avgAll = toInt(await fetchValue('SELECT ROUND(AVG(percentage)) FROM quiz_attempts WHERE completed_at IS NOT NULL', [], 0));
  const sum = (k: 'questions' | 'attempts') => quizzes.reduce((a, z) => a + toInt(z[k]), 0);

  return (
    <Shell user={user} title="Quizzes" subtitle="Assessments attached to lessons and subjects"
           topbarActions={<Link className="btn btn-primary btn-sm" href="/admin/quiz"><Icon name="plus" className="icon-sm" /> New quiz</Link>}>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <StatCard icon="clipboard" value={quizzes.length} label="Quizzes" />
        <StatCard icon="help" value={sum('questions')} label="Questions" tone="teal" />
        <StatCard icon="users" value={sum('attempts')} label="Attempts taken" tone="amber" />
        <StatCard icon="award" value={avgAll} label="Average score" tone="rose" />
      </div>

      {quizzes.length ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>All quizzes</h2>
            <div className="input-icon" style={{ maxWidth: 280 }}>
              <Icon name="search" />
              <input className="input" type="search" placeholder="Search…" data-filter="#quiz-rows tr" />
            </div>
          </div>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="tbl">
              <thead><tr><th>Quiz</th><th>Attached to</th><th>Questions</th><th>Pass mark</th><th>Attempts</th><th>Avg score</th><th></th></tr></thead>
              <tbody id="quiz-rows">
                {quizzes.map(qz => {
                  const avg = toInt(qz.avg_score);
                  return (
                    <tr key={qz.id}>
                      <td>
                        <b>{qz.title}</b>
                        {!qz.is_active ? <span className="badge badge-danger" style={{ marginLeft: 7 }}>Hidden</span> : null}
                        <div className="tiny dim">{plainText(qz.description, 70)}</div>
                      </td>
                      <td className="small muted">
                        {qz.lesson_title ? (
                          <>S{qz.semester_number} · {qz.subject_title}<br /><span className="tiny">{qz.lesson_title}</span></>
                        ) : qz.subject_title ? (
                          <>Subject-level · {qz.subject_title}</>
                        ) : <span className="badge badge-amber">Unattached</span>}
                      </td>
                      <td><span className="badge badge-brand">{toInt(qz.questions)}</span></td>
                      <td>{qz.passing_score}%</td>
                      <td>{toInt(qz.attempts)}</td>
                      <td><span className={`badge ${avg >= qz.passing_score ? 'badge-teal' : avg ? 'badge-amber' : ''}`}>{avg}%</span></td>
                      <td className="actions">
                        <Link className="btn btn-soft btn-sm" href={`/admin/quiz/${qz.id}`}><Icon name="edit" className="icon-sm" /></Link>
                        <form action={toggleQuiz} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={qz.id} />
                          <button className="btn btn-ghost btn-sm" type="submit"><Icon name={qz.is_active ? 'eye' : 'x'} className="icon-sm" /></button>
                        </form>
                        <form action={deleteQuiz} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={qz.id} />
                          <button className="btn btn-danger btn-sm" type="submit" data-confirm={`Delete “${qz.title}” and all recorded attempts?`}><Icon name="trash" className="icon-sm" /></button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card"><EmptyState icon="clipboard" title="No quizzes yet"
          text="Create your first quiz and attach it to a lesson so students are assessed after studying it."
          action={<Link className="btn btn-primary btn-sm" href="/admin/quiz">Create a quiz</Link>} /></div>
      )}
    </Shell>
  );
}
