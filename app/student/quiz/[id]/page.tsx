import Link from 'next/link';
import { redirect } from 'next/navigation';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, fetchValue, toInt } from '@/lib/db';
import { submitQuiz } from './actions';

export const dynamic = 'force-dynamic';

interface Quiz {
  id: number; title: string; description: string | null; passing_score: number; max_attempts: number; time_limit: number; shuffle: boolean;
  lesson_title: string | null; lesson_id: number | null; subject_title: string | null; subject_id: number | null;
}
interface Question { id: number; question: string; type: string; marks: number }
interface Option { id: number; question_id: number; option_text: string }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const q = await fetchOne<{ title: string }>('SELECT title FROM quizzes WHERE id = ?', [toInt((await params).id)]);
  return { title: q?.title ?? 'Quiz' };
}

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const uid = user.id;
  const quizId = toInt((await params).id);

  const quiz = await fetchOne<Quiz>(
    `SELECT qz.*, l.title AS lesson_title, l.id AS lesson_id, s.title AS subject_title, s.id AS subject_id
       FROM quizzes qz
       LEFT JOIN lessons  l ON l.id = qz.lesson_id
       LEFT JOIN subjects s ON s.id = COALESCE(qz.subject_id, l.subject_id)
      WHERE qz.id = ? AND qz.is_active = TRUE`, [quizId]);
  if (!quiz) redirect('/student/dashboard');

  const used = toInt(await fetchValue('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND completed_at IS NOT NULL', [quizId, uid], 0));
  if (used >= quiz.max_attempts) {
    redirect(quiz.lesson_id ? `/student/lesson/${quiz.lesson_id}` : '/student/results');
  }

  let questions = await fetchAll<Question>('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id', [quizId]);
  if (!questions.length) {
    redirect(quiz.lesson_id ? `/student/lesson/${quiz.lesson_id}` : '/student/dashboard');
  }

  const options: Record<number, Option[]> = {};
  for (const o of await fetchAll<Option>(
    `SELECT o.* FROM quiz_options o JOIN quiz_questions q ON q.id = o.question_id
      WHERE q.quiz_id = ? ORDER BY o.sort_order, o.id`, [quizId])) {
    (options[o.question_id] ||= []).push(o);
  }

  if (quiz.shuffle) {
    questions = [...questions];
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }

  const cancelHref = quiz.lesson_id ? `/student/lesson/${quiz.lesson_id}` : '/student/dashboard';

  return (
    <Shell user={user} title={quiz.title} subtitle={(quiz.subject_title ?? '') + (quiz.lesson_title ? ' · ' + quiz.lesson_title : '')}>
      <div className="container-narrow" style={{ width: '100%', margin: 0 }}>

        <div className="card card--pad-lg reveal" style={{ marginBottom: 24, borderTop: '4px solid var(--brand)' }}>
          <div className="row between" style={{ gap: 18, flexWrap: 'wrap' }}>
            <div>
              <span className="eyebrow"><Icon name="clipboard" className="icon-sm" /> Assessment</span>
              <h1 style={{ fontSize: '1.5rem', margin: '14px 0 6px' }}>{quiz.title}</h1>
              <p className="muted" style={{ margin: 0 }}>{quiz.description}</p>
            </div>
            {quiz.time_limit > 0 ? (
              <div className="card card--flat center" style={{ background: 'var(--brand-soft)', border: 0, minWidth: 130 }}>
                <div className="uppercase" style={{ color: 'var(--brand)' }}>Time left</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }} data-countdown={quiz.time_limit * 60}>--:--</div>
              </div>
            ) : null}
          </div>
          <div className="row" style={{ gap: 9, marginTop: 18 }}>
            <span className="badge badge-brand">{questions.length} questions</span>
            <span className="badge badge-teal">Pass mark {quiz.passing_score}%</span>
            <span className="badge badge-amber">Attempt {used + 1} of {quiz.max_attempts}</span>
            {quiz.time_limit ? <span className="badge">{quiz.time_limit} minutes</span> : null}
          </div>
        </div>

        <form action={submitQuiz} id="quiz-form">
          <input type="hidden" name="quiz_id" value={quizId} />

          {questions.map((qq, i) => {
            const isMult = qq.type === 'multiple';
            return (
              <div key={qq.id} className="quiz-q reveal">
                <div className="row between">
                  <span className="quiz-q__num">Question {i + 1} of {questions.length}</span>
                  <span className="badge">{qq.marks} mark{qq.marks > 1 ? 's' : ''}{isMult ? ' · choose all that apply' : ''}</span>
                </div>
                <p className="quiz-q__text">{qq.question}</p>
                {(options[qq.id] ?? []).map(o => (
                  <label key={o.id} className="opt">
                    <input type={isMult ? 'checkbox' : 'radio'} name={`q[${qq.id}]`} value={o.id} />
                    <span>{o.option_text}</span>
                  </label>
                ))}
              </div>
            );
          })}

          <div className="card row between" style={{ gap: 14, position: 'sticky', bottom: 16, boxShadow: 'var(--shadow-md)' }}>
            <div className="small muted">Answers are graded instantly. You can retake this quiz if attempts remain.</div>
            <div className="row row-tight">
              <Link className="btn btn-ghost" href={cancelHref}>Cancel</Link>
              <button className="btn btn-primary btn-lg" type="submit"><Icon name="check" /> Submit answers</button>
            </div>
          </div>
        </form>
      </div>
    </Shell>
  );
}
