/**
 * Quiz editor — shared by /admin/quiz (new) and /admin/quiz/[id] (edit).
 * Ported from admin/quiz_edit.php.
 */
import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { ProgressRing } from '@/components/ui';
import type { User } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { ucfirst } from '@/lib/text';
import QuestionFormScripts from './QuestionFormScripts';
import { addQuestion, deleteQuestion, saveQuiz } from './actions';

export interface QuizRow {
  id: number; lesson_id: number | null; title: string; description: string | null; passing_score: number;
  max_attempts: number; time_limit: number; shuffle: boolean; is_active: boolean;
}
interface LessonOpt { id: number; title: string; subject_title: string; semester_number: number }
interface Question { id: number; question: string; type: string; marks: number; explanation: string | null }
interface Option { id: number; question_id: number; option_text: string; is_correct: boolean }

export default async function QuizEditor({ user, quiz, preLesson = 0 }: { user: User; quiz: QuizRow | null; preLesson?: number }) {
  const quizId = quiz?.id ?? 0;

  const lessons = await fetchAll<LessonOpt>(
    `SELECT l.id, l.title, s.title AS subject_title, sem.number AS semester_number
       FROM lessons l
       JOIN subjects  s   ON s.id = l.subject_id
       JOIN semesters sem ON sem.id = s.semester_id
      ORDER BY sem.number, s.sort_order, l.sort_order`);

  const questions = quizId ? await fetchAll<Question>('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id', [quizId]) : [];
  const options: Record<number, Option[]> = {};
  if (quizId) {
    for (const o of await fetchAll<Option>(
      `SELECT o.* FROM quiz_options o JOIN quiz_questions q ON q.id = o.question_id WHERE q.quiz_id = ? ORDER BY o.sort_order, o.id`, [quizId])) {
      (options[o.question_id] ||= []).push(o);
    }
  }
  const totalMarks = questions.reduce((a, qq) => a + toInt(qq.marks), 0);

  const stats = quizId ? (await fetchOne(
    `SELECT COUNT(*) AS attempts, COUNT(*) FILTER (WHERE passed) AS passed, ROUND(AVG(percentage)) AS avg
       FROM quiz_attempts WHERE quiz_id = ? AND completed_at IS NOT NULL`, [quizId])) ?? { attempts: 0, passed: 0, avg: 0 } : null;

  return (
    <Shell user={user} title={quiz ? 'Edit quiz' : 'New quiz'} subtitle={quiz ? quiz.title : 'Create an assessment'}>
      <QuestionFormScripts />

      <Link className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} href="/admin/quizzes"><Icon name="arrow-left" className="icon-sm" /> All quizzes</Link>

      <div className="split">
        <div className="stack">
          <form className="card card--pad-lg" action={saveQuiz}>
            <input type="hidden" name="id" value={quizId || ''} />
            <div className="card__head"><h2 className="card__title">Quiz settings</h2></div>

            <div className="field">
              <label htmlFor="title">Title</label>
              <input className="input" id="title" name="title" defaultValue={quiz?.title ?? ''} placeholder="Quiz — The Skeletal System" required />
            </div>

            <div className="field">
              <label htmlFor="lesson_id">Attach to lesson</label>
              <select className="select" id="lesson_id" name="lesson_id" defaultValue={quiz?.lesson_id ?? preLesson ?? ''}>
                <option value="">— Not attached to a lesson —</option>
                {lessons.map(l => <option key={l.id} value={l.id}>S{l.semester_number} · {l.subject_title} — {l.title}</option>)}
              </select>
              <div className="hint">Passing an attached quiz automatically marks that lesson as completed.</div>
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea className="textarea" id="description" name="description" style={{ minHeight: 80 }} defaultValue={quiz?.description ?? ''}></textarea>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="passing_score">Passing score (%)</label>
                <input className="input" type="number" id="passing_score" name="passing_score" min={0} max={100} defaultValue={quiz?.passing_score ?? 60} />
              </div>
              <div className="field">
                <label htmlFor="max_attempts">Maximum attempts</label>
                <input className="input" type="number" id="max_attempts" name="max_attempts" min={1} max={50} defaultValue={quiz?.max_attempts ?? 3} />
              </div>
              <div className="field">
                <label htmlFor="time_limit">Time limit (minutes)</label>
                <input className="input" type="number" id="time_limit" name="time_limit" min={0} defaultValue={quiz?.time_limit ?? 0} />
                <div className="hint">0 = no limit</div>
              </div>
            </div>

            <div className="row" style={{ gap: 22, marginBottom: 18 }}>
              <label className="check"><input type="checkbox" name="shuffle" value="1" defaultChecked={!quiz || quiz.shuffle} /> Shuffle questions</label>
              <label className="check"><input type="checkbox" name="is_active" value="1" defaultChecked={!quiz || quiz.is_active} /> Visible to students</label>
            </div>

            <button className="btn btn-primary" type="submit"><Icon name="save" className="icon-sm" /> {quiz ? 'Save settings' : 'Create quiz'}</button>
          </form>

          {quizId ? (
            <section className="card card--pad-lg">
              <div className="card__head">
                <h2 className="card__title">Questions</h2>
                <span className="badge badge-brand">{questions.length} · {totalMarks} marks</span>
              </div>

              {questions.length ? (
                <div className="stack" style={{ gap: 14, marginBottom: 24 }}>
                  {questions.map((qq, i) => (
                    <div key={qq.id} className="quiz-q" style={{ margin: 0, padding: 18 }}>
                      <div className="row between">
                        <span className="quiz-q__num">Q{i + 1} · {ucfirst(qq.type === 'truefalse' ? 'true / false' : qq.type)} · {qq.marks} mark{qq.marks > 1 ? 's' : ''}</span>
                        <form action={deleteQuestion}>
                          <input type="hidden" name="id" value={quizId} />
                          <input type="hidden" name="question_id" value={qq.id} />
                          <button className="btn btn-danger btn-sm" type="submit" data-confirm="Delete this question?"><Icon name="trash" className="icon-sm" /></button>
                        </form>
                      </div>
                      <p className="quiz-q__text" style={{ fontSize: '.98rem', margin: '8px 0 12px' }}>{qq.question}</p>
                      <div className="stack" style={{ gap: 6 }}>
                        {(options[qq.id] ?? []).map(o => (
                          <div key={o.id} className="row" style={{ gap: 9, fontSize: '.87rem' }}>
                            <span style={{ color: o.is_correct ? 'var(--teal)' : 'var(--text-3)' }}><Icon name={o.is_correct ? 'check-circle' : 'circle'} className="icon-sm" /></span>
                            <span style={{ fontWeight: o.is_correct ? 700 : undefined }}>{o.option_text}</span>
                          </div>
                        ))}
                      </div>
                      {qq.explanation ? <div className="tiny dim" style={{ marginTop: 10 }}><b>Explanation:</b> {qq.explanation}</div> : null}
                    </div>
                  ))}
                </div>
              ) : <p className="small muted" style={{ marginBottom: 20 }}>No questions yet — add the first one below.</p>}

              {/* add question */}
              <form action={addQuestion} style={{ borderTop: '1px solid var(--line)', paddingTop: 22 }}>
                <input type="hidden" name="id" value={quizId} />
                <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Add a question</h3>

                <div className="field">
                  <label htmlFor="question">Question</label>
                  <textarea className="textarea" id="question" name="question" style={{ minHeight: 80 }} required
                            placeholder="Which plane divides the body into left and right halves?"></textarea>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="qtype">Answer type</label>
                    <select className="select" id="qtype" name="qtype" defaultValue="single">
                      <option value="single">Single answer</option>
                      <option value="multiple">Multiple answers</option>
                      <option value="truefalse">True / False</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="marks">Marks</label>
                    <input className="input" type="number" id="marks" name="marks" min={1} max={20} defaultValue={1} />
                  </div>
                </div>

                <div id="options-block">
                  <label className="label">Answer options — tick the correct one(s)</label>
                  <div className="stack" style={{ gap: 9 }} id="opt-list">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="row" style={{ gap: 10 }}>
                        <label className="check" style={{ flex: 'none' }}><input type="checkbox" name="correct[]" value={i} /></label>
                        <input className="input" name="options[]" placeholder={`Option ${i + 1}`} />
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-ghost btn-sm" type="button" id="add-opt" style={{ marginTop: 10 }}><Icon name="plus" className="icon-sm" /> Add another option</button>
                </div>

                <div id="tf-block" hidden>
                  <label className="label">Correct answer</label>
                  <div className="row" style={{ gap: 16 }}>
                    <label className="check"><input type="radio" name="tf_correct" value="0" defaultChecked /> True</label>
                    <label className="check"><input type="radio" name="tf_correct" value="1" /> False</label>
                  </div>
                </div>

                <div className="field" style={{ marginTop: 18 }}>
                  <label htmlFor="explanation">Explanation (shown after submission)</label>
                  <input className="input" id="explanation" name="explanation" placeholder="Why this answer is correct…" />
                </div>

                <button className="btn btn-dark" type="submit"><Icon name="plus" className="icon-sm" /> Add question</button>
              </form>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          {quizId && stats ? (
            <div className="card">
              <div className="card__head"><h3 className="card__title">Performance</h3></div>
              <div className="center" style={{ marginBottom: 14 }}><ProgressRing percent={toInt(stats.avg)} size={130} stroke={11} caption="avg score" /></div>
              <div className="stack" style={{ gap: 11 }}>
                <div className="row between"><span className="small muted">Attempts</span><b>{toInt(stats.attempts)}</b></div>
                <div className="row between"><span className="small muted">Passed</span><b style={{ color: 'var(--teal)' }}>{toInt(stats.passed)}</b></div>
                <div className="row between"><span className="small muted">Questions</span><b>{questions.length}</b></div>
                <div className="row between"><span className="small muted">Total marks</span><b>{totalMarks}</b></div>
              </div>
              <Link className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 14 }} href={`/admin/results?quiz=${quizId}`}><Icon name="award" className="icon-sm" /> View all results</Link>
            </div>
          ) : null}

          <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
            <b style={{ fontSize: '.9rem' }}>Question types</b>
            <ul className="small muted" style={{ paddingLeft: '1.1em', margin: '10px 0 0', lineHeight: 1.8 }}>
              <li><b>Single answer</b> — one correct option (radio buttons).</li>
              <li><b>Multiple answers</b> — the student must select every correct option to earn the marks.</li>
              <li><b>True / False</b> — options are generated automatically.</li>
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
