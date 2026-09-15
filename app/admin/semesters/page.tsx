import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { deleteSemester, saveSemester } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Semesters' };

interface Semester { id: number; number: number; title: string; description: string | null; sort_order: number; is_active: boolean; subjects: number; lessons: number; students: number }

export default async function SemestersPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireAdmin('/admin/semesters');
  const editId = toInt((await searchParams).edit);
  const edit = editId ? await fetchOne<Semester>('SELECT * FROM semesters WHERE id = ?', [editId]) : null;

  const semesters = await fetchAll<Semester>(
    `SELECT sem.*,
            (SELECT COUNT(*) FROM subjects s WHERE s.semester_id = sem.id) AS subjects,
            (SELECT COUNT(*) FROM lessons l JOIN subjects s ON s.id=l.subject_id WHERE s.semester_id = sem.id) AS lessons,
            (SELECT COUNT(*) FROM users u WHERE u.semester_id = sem.id AND u.role='student') AS students
       FROM semesters sem ORDER BY sem.sort_order, sem.number`);

  return (
    <Shell user={user} title="Semesters" subtitle="The six-semester academic structure">
      <div className="split">
        <div>
          <div className="section__head">
            <h2>All semesters</h2>
            <span className="badge badge-brand">{semesters.length} total</span>
          </div>

          <div className="stack">
            {semesters.map(s => (
              <div key={s.id} className="card card--hover reveal">
                <div className="row between" style={{ gap: 16 }}>
                  <div className="row" style={{ gap: 15, flex: 1, minWidth: 0 }}>
                    <span className="subject-card__icon" style={{ background: 'var(--grad-brand)' }}>{s.number}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row row-tight" style={{ marginBottom: 4 }}>
                        <b>{s.title}</b>
                        {!s.is_active ? <span className="badge badge-danger">Hidden</span> : null}
                      </div>
                      <p className="small muted" style={{ margin: '0 0 8px' }}>{s.description}</p>
                      <div className="row row-tight">
                        <span className="badge"><Icon name="book" className="icon-sm" /> {toInt(s.subjects)} subjects</span>
                        <span className="badge"><Icon name="list" className="icon-sm" /> {toInt(s.lessons)} lessons</span>
                        <span className="badge"><Icon name="users" className="icon-sm" /> {toInt(s.students)} students</span>
                        <span className="badge">Order {s.sort_order}</span>
                      </div>
                    </div>
                  </div>
                  <div className="row row-tight" style={{ flex: 'none' }}>
                    <Link className="btn btn-ghost btn-sm" href={`/admin/subjects?semester=${s.id}`}><Icon name="book" className="icon-sm" /> Subjects</Link>
                    <Link className="btn btn-soft btn-sm" href={`/admin/semesters?edit=${s.id}`}><Icon name="edit" className="icon-sm" /></Link>
                    <form action={deleteSemester} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-danger btn-sm" type="submit" data-confirm={`Delete “${s.title}”? This cannot be undone.`}><Icon name="trash" className="icon-sm" /></button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside>
          <form key={edit?.id ?? 'new'} className="card card--pad-lg" action={saveSemester} style={{ position: 'sticky', top: 96 }}>
            <input type="hidden" name="id" value={edit ? edit.id : ''} />

            <div className="card__head">
              <h3 className="card__title">{edit ? 'Edit semester' : 'Add a semester'}</h3>
              {edit ? <Link className="tiny strong" style={{ color: 'var(--brand)' }} href="/admin/semesters">Cancel</Link> : null}
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="number">Number</label>
                <input className="input" type="number" id="number" name="number" min={1} max={12}
                       defaultValue={edit ? edit.number : semesters.length + 1} required />
              </div>
              <div className="field">
                <label htmlFor="sort_order">Sort order</label>
                <input className="input" type="number" id="sort_order" name="sort_order"
                       defaultValue={edit ? edit.sort_order : semesters.length + 1} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="title">Title</label>
              <input className="input" id="title" name="title" defaultValue={edit?.title ?? ''}
                     placeholder="Semester 1 — Foundations of Midwifery" required />
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea className="textarea" id="description" name="description" placeholder="What this semester covers…" defaultValue={edit?.description ?? ''}></textarea>
            </div>

            <label className="check" style={{ marginBottom: 18 }}>
              <input type="checkbox" name="is_active" value="1" defaultChecked={!edit || edit.is_active} /> Visible to students
            </label>

            <button className="btn btn-primary btn-block" type="submit">
              <Icon name={edit ? 'save' : 'plus'} className="icon-sm" /> {edit ? 'Save changes' : 'Create semester'}
            </button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
