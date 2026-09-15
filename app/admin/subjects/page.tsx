import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import ColorPicker from './ColorPicker';
import { deleteSubject, reorderSubjects, saveSubject } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subjects' };

interface Semester { id: number; number: number; title: string }
interface Subject {
  id: number; semester_id: number; code: string | null; title: string; description: string | null; color: string;
  credits: number; sort_order: number; is_active: boolean; lessons: number; quizzes: number;
}

const PALETTE = ['#6C4CF1', '#E8557E', '#12B5A6', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#EF4444', '#0EA5E9'];

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ semester?: string; edit?: string }> }) {
  const user = await requireAdmin('/admin/subjects');
  const sp = await searchParams;

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters ORDER BY sort_order, number');
  let filter = toInt(sp.semester) || (semesters[0]?.id ?? 0);
  const editId = toInt(sp.edit);
  const edit = editId ? await fetchOne<Subject>('SELECT * FROM subjects WHERE id = ?', [editId]) : null;
  if (edit) filter = edit.semester_id;

  const subjects = await fetchAll<Subject>(
    `SELECT s.*, (SELECT COUNT(*) FROM lessons l WHERE l.subject_id = s.id) AS lessons,
            (SELECT COUNT(*) FROM quizzes qz JOIN lessons l ON l.id = qz.lesson_id WHERE l.subject_id = s.id) AS quizzes
       FROM subjects s WHERE s.semester_id = ? ORDER BY s.sort_order, s.id`, [filter]);

  return (
    <Shell user={user} title="Subjects" subtitle="Subjects and their order inside each semester">
      <div className="row" style={{ marginBottom: 22, gap: 9 }}>
        {semesters.map(s => (
          <Link key={s.id} className={`chip ${s.id === filter ? 'active' : ''}`} href={`/admin/subjects?semester=${s.id}`}>Semester {s.number}</Link>
        ))}
      </div>

      <div className="split">
        <div>
          <div className="section__head">
            <h2>Subjects in this semester</h2>
            <span className="badge badge-brand">{subjects.length}</span>
          </div>

          {subjects.length ? (
            <form action={reorderSubjects}>
              <input type="hidden" name="semester_filter" value={filter} />
              <div className="stack">
                {subjects.map(s => (
                  <div key={s.id} className="card card--hover reveal" style={{ borderLeft: `4px solid ${s.color}` }}>
                    <div className="row between" style={{ gap: 14 }}>
                      <div className="row" style={{ gap: 14, flex: 1, minWidth: 0 }}>
                        <input className="input" type="number" name={`order[${s.id}]`} defaultValue={s.sort_order}
                               style={{ width: 74, textAlign: 'center', fontWeight: 800 }} title="Sort order" />
                        <div style={{ minWidth: 0 }}>
                          <div className="row row-tight" style={{ marginBottom: 4 }}>
                            <b>{s.title}</b>
                            {s.code ? <span className="badge badge-brand">{s.code}</span> : null}
                            {!s.is_active ? <span className="badge badge-danger">Hidden</span> : null}
                          </div>
                          <p className="small muted" style={{ margin: '0 0 8px' }}>{s.description}</p>
                          <div className="row row-tight">
                            <span className="badge"><Icon name="list" className="icon-sm" /> {toInt(s.lessons)} lessons</span>
                            <span className="badge"><Icon name="clipboard" className="icon-sm" /> {toInt(s.quizzes)} quizzes</span>
                            <span className="badge">{s.credits} credits</span>
                          </div>
                        </div>
                      </div>
                      <div className="row row-tight" style={{ flex: 'none' }}>
                        <Link className="btn btn-ghost btn-sm" href={`/admin/lessons?subject=${s.id}`}><Icon name="list" className="icon-sm" /> Lessons</Link>
                        <Link className="btn btn-soft btn-sm" href={`/admin/subjects?edit=${s.id}`}><Icon name="edit" className="icon-sm" /></Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-dark btn-sm" type="submit" style={{ marginTop: 14 }}><Icon name="save" className="icon-sm" /> Save order</button>
            </form>
          ) : (
            <div className="card"><EmptyState icon="book" title="No subjects yet" text="Create the first subject for this semester using the form." /></div>
          )}

          {subjects.length ? (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="card__head"><h3 className="card__title">Delete a subject</h3></div>
              <p className="small muted">Deleting a subject also deletes its lessons, materials, quizzes and the related progress records.</p>
              <div className="row row-tight" style={{ marginTop: 10 }}>
                {subjects.map(s => (
                  <form key={s.id} action={deleteSubject} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="semester_filter" value={filter} />
                    <button className="btn btn-danger btn-sm" type="submit" data-confirm={`Delete “${s.title}” and all of its lessons?`}>
                      <Icon name="trash" className="icon-sm" /> {s.title}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside>
          <form key={edit?.id ?? `new-${filter}`} className="card card--pad-lg" action={saveSubject} style={{ position: 'sticky', top: 96 }}>
            <input type="hidden" name="id" value={edit ? edit.id : ''} />
            <input type="hidden" name="semester_filter" value={filter} />

            <div className="card__head">
              <h3 className="card__title">{edit ? 'Edit subject' : 'Add a subject'}</h3>
              {edit ? <Link className="tiny strong" style={{ color: 'var(--brand)' }} href={`/admin/subjects?semester=${filter}`}>Cancel</Link> : null}
            </div>

            <div className="field">
              <label htmlFor="semester_id">Semester</label>
              <select className="select" id="semester_id" name="semester_id" required defaultValue={edit?.semester_id ?? filter}>
                {semesters.map(s => <option key={s.id} value={s.id}>Semester {s.number} — {s.title}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="title">Subject title</label>
              <input className="input" id="title" name="title" defaultValue={edit?.title ?? ''} placeholder="Anatomy & Physiology I" required />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="code">Code</label>
                <input className="input" id="code" name="code" defaultValue={edit?.code ?? ''} placeholder="ANP-101" />
              </div>
              <div className="field">
                <label htmlFor="credits">Credits</label>
                <input className="input" type="number" id="credits" name="credits" min={0} max={20} defaultValue={edit?.credits ?? 3} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea className="textarea" id="description" name="description" style={{ minHeight: 90 }} defaultValue={edit?.description ?? ''}></textarea>
            </div>

            <div className="field">
              <label>Accent colour</label>
              <ColorPicker palette={PALETTE} value={edit?.color ?? '#6C4CF1'} />
            </div>

            <div className="field">
              <label htmlFor="sort_order">Sort order</label>
              <input className="input" type="number" id="sort_order" name="sort_order" defaultValue={edit?.sort_order ?? subjects.length + 1} />
            </div>

            <label className="check" style={{ marginBottom: 18 }}>
              <input type="checkbox" name="is_active" value="1" defaultChecked={!edit || edit.is_active} /> Visible to students
            </label>

            <button className="btn btn-primary btn-block" type="submit">
              <Icon name={edit ? 'save' : 'plus'} className="icon-sm" /> {edit ? 'Save subject' : 'Create subject'}
            </button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
