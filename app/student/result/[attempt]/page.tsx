import Link from 'next/link';
import { redirect } from 'next/navigation';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, fetchValue, toInt, toNum } from '@/lib/db';
import { fmtDateTime, trimNumber } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quiz result' };

interface Attempt {
  id: number; quiz_id: number; score: number; total_marks: number; percentage: number; passed: boolean; completed_at: Date;
  title: string; passing_score: number; max_attempts: number; lesson_id: number | null; lesson_title: string | null; subject_title: string | null;
}
interface Question { id: number; question: string; explanation: string | null; selected_ids: string | null; is_correct: boolean | null }
interface Option { id: number; question_id: number; option_text: string; is_correct: boolean }

export default async function ResultPage({ params }: { params: Promise<{ attempt: string }> }) {
  const user = await requireStudent();
  const uid = user.id;
  const attemptId = toInt((await params).attempt);

  const attempt = await fetchOne<Attempt>(
    `SELECT a.*, qz.title, qz.passing_score, qz.max_attempts, qz.lesson_id, qz.id AS quiz_id,
            l.title AS lesson_title, s.title AS subject_title
       FROM quiz_attempts a
       JOIN quizzes qz ON qz.id = a.quiz_id
       LEFT JOIN lessons  l ON l.id = qz.lesson_id
       LEFT JOIN subjects s ON s.id = COALESCE(qz.subject_id, l.subject_id)
      WHERE a.id = ? AND a.user_id = ?`, [attemptId, uid]);
  if (!attempt) redirect('/student/results');

  const questions = await fetchAll<Question>(
    `SELECT q.*, aa.selected_ids, aa.is_correct
       FROM quiz_questions q
       LEFT JOIN quiz_attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
      WHERE q.quiz_id = ?
      ORDER BY q.sort_order, q.id`, [attemptId, attempt.quiz_id]);

  const options: Record<number, Option[]> = {};
  for (const o of await fetchAll<Option>(
    `SELECT o.* FROM quiz_options o JOIN quiz_questions q ON q.id = o.question_id
      WHERE q.quiz_id = ? ORDER BY o.sort_order, o.id`, [attempt.quiz_id])) {
    (options[o.question_id] ||= []).push(o);
  }

  const used   = toInt(await fetchValue('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND completed_at IS NOT NULL', [attempt.quiz_id, uid], 0));
  const left   = Math.max(0, attempt.max_attempts - used);
  const passed = !!attempt.passed;
  const score  = Math.round(toNum(attempt.percentage));
  const right  = questions.filter(q => q.is_correct === true).length;

  return (
    <Shell user={user} title="Quiz result" subtitle={attempt.title}>
      <div className="container-narrow" style={{ width: '100%', margin: 0 }}>

        <div className={`result-banner ${passed ? 'pass' : 'fail'}`} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '2.6rem', lineHeight: 1 }}>{passed ? '🎉' : '💪'}</div>
          <h2>{score}%</h2>
          <p style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>{passed ? 'Passed — well done!' : 'Not passed this time'}</p>
          <p style={{ opacity: .9, margin: 0 }}>
            {right} of {questions.length} questions correct · {trimNumber(toNum(attempt.score))} / {trimNumber(toNum(attempt.total_marks))} marks · pass mark {attempt.passing_score}%
          </p>
        </div>

        <div className="row between card" style={{ marginBottom: 24, gap: 14 }}>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <div><b style={{ fontSize: '1.2rem' }}>{used}</b><div className="tiny dim">Attempts used</div></div>
            <div><b style={{ fontSize: '1.2rem', color: 'var(--teal)' }}>{left}</b><div className="tiny dim">Attempts left</div></div>
            <div><b style={{ fontSize: '1.2rem' }}>{fmtDateTime(attempt.completed_at)}</b><div className="tiny dim">Submitted</div></div>
          </div>
          <div className="row row-tight">
            {attempt.lesson_id ? <Link className="btn btn-ghost" href={`/student/lesson/${attempt.lesson_id}`}><Icon name="arrow-left" className="icon-sm" /> Back to lesson</Link> : null}
            {left > 0 && !passed ? (
              <Link className="btn btn-primary" href={`/student/quiz/${attempt.quiz_id}`}><Icon name="refresh" className="icon-sm" /> Retake quiz</Link>
            ) : left > 0 ? (
              <Link className="btn btn-ghost" href={`/student/quiz/${attempt.quiz_id}`}><Icon name="refresh" className="icon-sm" /> Try again</Link>
            ) : null}
          </div>
        </div>

        <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>Answer review</h2>

        {questions.map((qq, i) => {
          const selected = String(qq.selected_ids ?? '').split(',').map(v => toInt(v)).filter(v => v > 0);
          const ok = qq.is_correct === true;
          return (
            <div key={qq.id} className="quiz-q reveal">
              <div className="row between">
                <span className="quiz-q__num">Question {i + 1}</span>
                <span className={`badge ${ok ? 'badge-teal' : 'badge-danger'}`}>
                  <Icon name={ok ? 'check' : 'x'} className="icon-sm" /> {ok ? 'Correct' : 'Incorrect'}
                </span>
              </div>
              <p className="quiz-q__text">{qq.question}</p>
              {(options[qq.id] ?? []).map(o => {
                const wasChosen = selected.includes(o.id);
                const cls = o.is_correct ? 'correct' : (wasChosen ? 'incorrect' : '');
                return (
                  <div key={o.id} className={`opt ${cls}`} style={{ cursor: 'default' }}>
                    <span style={{ width: 19, display: 'grid', placeItems: 'center' }}>
                      <Icon name={o.is_correct ? 'check' : wasChosen ? 'x' : 'circle'} className="icon-sm" />
                    </span>
                    <span style={{ flex: 1 }}>{o.option_text}</span>
                    {wasChosen ? <span className="badge">Your answer</span> : null}
                  </div>
                );
              })}
              {qq.explanation ? (
                <div className="alert alert-info" style={{ margin: '14px 0 0' }}>
                  <Icon name="info" /><div><b>Explanation.</b> {qq.explanation}</div>
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="row" style={{ marginTop: 20 }}>
          <Link className="btn btn-ghost" href="/student/results"><Icon name="award" className="icon-sm" /> All my results</Link>
          <Link className="btn btn-primary" href="/student/continue"><Icon name="play" className="icon-sm" /> Continue learning</Link>
        </div>
      </div>

      {passed ? <div data-confetti="110" hidden></div> : null}
    </Shell>
  );
}
