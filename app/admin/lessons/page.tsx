import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { AlertBox, EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, fetchValue, toInt } from '@/lib/db';
import { dirOf, duration, plainText } from '@/lib/text';
import { deleteLesson, reorderLessons, toggleLesson } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lessons & sequence' };

interface Semester { id: number; number: number }
interface Subject { id: number; semester_id: number; title: string; color: string; semester_number?: number }
interface Lesson {
  id: number; title: string; description: string | null; sort_order: number; recommended_day: number; is_active: boolean; is_required: boolean;
  video_type: string; duration_minutes: number; materials: number; quizzes: number; completions: number;
}

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const user = await requireAdmin('/admin/lessons');
  const sp = await searchParams;

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters ORDER BY sort_order, number');

  let subjectId = toInt(sp.subject);
  if (!subjectId) subjectId = toInt(await fetchValue('SELECT id FROM subjects ORDER BY semester_id, sort_order LIMIT 1', [], 0));

  const subject = subjectId ? await fetchOne<Subject>(
    `SELECT s.*, sem.number AS semester_number FROM subjects s JOIN semesters sem ON sem.id = s.semester_id WHERE s.id = ?`, [subjectId]) : null;

  const semFilter = subject ? subject.semester_id : (semesters[0]?.id ?? 0);
  const subjects = await fetchAll<Subject>('SELECT * FROM subjects WHERE semester_id = ? ORDER BY sort_order, id', [semFilter]);

  /* the first subject of every semester, for the semester chips */
  const firstSubject: Record<number, number> = {};
  for (const r of await fetchAll<{ semester_id: number; id: number }>(
    'SELECT DISTINCT ON (semester_id) semester_id, id FROM subjects ORDER BY semester_id, sort_order, id')) {
    firstSubject[r.semester_id] = r.id;
  }

  const lessons = subjectId ? await fetchAll<Lesson>(
    `SELECT l.*,
            (SELECT COUNT(*) FROM lesson_materials m WHERE m.lesson_id = l.id) AS materials,
            (SELECT COUNT(*) FROM quizzes qz WHERE qz.lesson_id = l.id) AS quizzes,
            (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.lesson_id = l.id AND lp.status='completed') AS completions
       FROM lessons l WHERE l.subject_id = ? ORDER BY l.sort_order, l.id`, [subjectId]) : [];

  const byDay = new Map<number, Lesson[]>();
  for (const l of lessons) {
    if (!byDay.has(l.recommended_day)) byDay.set(l.recommended_day, []);
    byDay.get(l.recommended_day)!.push(l);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <Shell user={user} title="Lessons & sequence"
           subtitle={subject ? `Semester ${subject.semester_number} · ${subject.title}` : 'Select a subject'}
           topbarActions={subjectId ? <Link className="btn btn-primary btn-sm" href={`/admin/lesson?subject=${subjectId}`}><Icon name="plus" className="icon-sm" /> New lesson</Link> : null}>

      <div className="row" style={{ marginBottom: 14, gap: 9 }}>
        {semesters.map(s => (
          <Link key={s.id} className={`chip ${s.id === semFilter ? 'active' : ''}`} href={`/admin/lessons?subject=${firstSubject[s.id] ?? 0}`}>Semester {s.number}</Link>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 24, gap: 9 }}>
        {subjects.map(s => (
          <Link key={s.id} className={`chip ${s.id === subjectId ? 'active' : ''}`} href={`/admin/lessons?subject=${s.id}`}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: s.color }}></span> {s.title}
          </Link>
        ))}
        {!subjects.length ? <span className="dim small">No subjects in this semester yet.</span> : null}
      </div>

      {!subject ? (
        <div className="card"><EmptyState icon="book" title="No subject selected" text="Create a subject first, then add its lessons."
          action={<Link className="btn btn-primary btn-sm" href="/admin/subjects">Manage subjects</Link>} /></div>
      ) : (
        <>
          <AlertBox type="info"><b>The sequence is what students follow.</b> Change <b>Order</b> to move a lesson in the sequence, and <b>Day</b> to set the recommended learning day. Recommended days are guidance only — they never block access.</AlertBox>

          <div className="tabs" data-tabs style={{ marginTop: 20 }}>
            <button className="tab active" data-tab="seq"><Icon name="list" className="icon-sm" /> Sequence</button>
            <button className="tab" data-tab="days"><Icon name="calendar" className="icon-sm" /> Daily plan</button>
          </div>

          <div data-tab-panel="seq">
            {lessons.length ? (
              <>
                <form action={reorderLessons}>
                  <input type="hidden" name="subject_filter" value={subjectId} />
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead>
                        <tr><th style={{ width: 88 }}>Order</th><th>Lesson</th><th style={{ width: 80 }}>Day</th><th>Content</th><th>Completions</th><th></th></tr>
                      </thead>
                      <tbody>
                        {lessons.map(l => (
                          <tr key={l.id}>
                            <td>
                              <input className="input" type="number" name={`order[${l.id}]`} defaultValue={l.sort_order}
                                     style={{ width: 72, textAlign: 'center', fontWeight: 800, padding: 8 }} />
                            </td>
                            <td>
                              <b dir={dirOf(l.title)} style={{ lineHeight: 1.8 }}>{l.title}</b>
                              {!l.is_active ? <span className="badge badge-danger" style={{ marginLeft: 7 }}>Hidden</span> : null}
                              {!l.is_required ? <span className="badge badge-amber" style={{ marginLeft: 7 }}>Optional</span> : null}
                              <div className="tiny dim" dir={dirOf(l.description)}>{plainText(l.description, 90)}</div>
                            </td>
                            <td>
                              <input className="input" type="number" min={1} name={`day[${l.id}]`} defaultValue={l.recommended_day}
                                     style={{ width: 64, textAlign: 'center', padding: 8 }} />
                            </td>
                            <td>
                              <div className="row row-tight">
                                {l.video_type !== 'none' ? <span className="badge badge-brand"><Icon name="video" className="icon-sm" /></span> : null}
                                {toInt(l.materials) ? <span className="badge badge-teal"><Icon name="file-text" className="icon-sm" /> {toInt(l.materials)}</span> : null}
                                {toInt(l.quizzes) ? <span className="badge badge-amber"><Icon name="clipboard" className="icon-sm" /> {toInt(l.quizzes)}</span> : null}
                                {l.duration_minutes ? <span className="badge">{duration(l.duration_minutes)}</span> : null}
                              </div>
                            </td>
                            <td><span className="badge badge-teal">{toInt(l.completions)}</span></td>
                            <td className="actions">
                              <Link className="btn btn-soft btn-sm" href={`/admin/lesson/${l.id}`}><Icon name="edit" className="icon-sm" /></Link>
                              <button className="btn btn-ghost btn-sm" form={`f-toggle-${l.id}`} type="submit" title="Show / hide">
                                <Icon name={l.is_active ? 'eye' : 'x'} className="icon-sm" />
                              </button>
                              <button className="btn btn-danger btn-sm" form={`f-del-${l.id}`} type="submit"
                                      data-confirm={`Delete “${l.title}”? Progress records for this lesson will also be removed.`}>
                                <Icon name="trash" className="icon-sm" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="btn btn-dark" type="submit" style={{ marginTop: 16 }}><Icon name="save" className="icon-sm" /> Save sequence &amp; days</button>
                </form>

                {lessons.map(l => (
                  <span key={l.id}>
                    <form action={toggleLesson} id={`f-toggle-${l.id}`} style={{ display: 'none' }}>
                      <input type="hidden" name="id" value={l.id} /><input type="hidden" name="subject_filter" value={subjectId} />
                    </form>
                    <form action={deleteLesson} id={`f-del-${l.id}`} style={{ display: 'none' }}>
                      <input type="hidden" name="id" value={l.id} /><input type="hidden" name="subject_filter" value={subjectId} />
                    </form>
                  </span>
                ))}
              </>
            ) : (
              <div className="card"><EmptyState icon="list" title="No lessons yet" text="Add the first lesson of this subject to start building the sequence."
                action={<Link className="btn btn-primary btn-sm" href={`/admin/lesson?subject=${subjectId}`}>Add a lesson</Link>} /></div>
            )}
          </div>

          <div data-tab-panel="days" hidden>
            <div className="grid grid-2">
              {days.map(day => {
                const items = byDay.get(day)!;
                return (
                  <div key={day} className="tt-day reveal">
                    <div className="tt-day__head">
                      <b>Day {day}</b>
                      <span className="badge">{items.length} lesson{items.length > 1 ? 's' : ''}</span>
                    </div>
                    {items.map(l => (
                      <Link key={l.id} className="tt-slot" href={`/admin/lesson/${l.id}`}>
                        <span className="tt-slot__bar" style={{ background: subject.color }}></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: '.9rem', display: 'block' }}>{l.title}</b>
                          <span className="tiny dim">Order {l.sort_order} · {duration(l.duration_minutes)}</span>
                        </span>
                        <Icon name="edit" className="icon-sm" />
                      </Link>
                    ))}
                  </div>
                );
              })}
              {!days.length ? <div className="card"><EmptyState icon="calendar" title="Nothing planned" text="Set a recommended day on each lesson to build the daily plan." /></div> : null}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
