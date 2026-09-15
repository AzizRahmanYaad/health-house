import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { AlertBox, EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, fetchOne, toInt } from '@/lib/db';
import { dayName, fmtTime, todayDow } from '@/lib/text';
import LessonFilter from './LessonFilter';
import { clearSemester, deleteSlot, saveSlot } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Timetable' };

interface Semester { id: number; number: number }
interface Subject { id: number; title: string }
interface LessonOpt { id: number; title: string; subject_id: number }
interface Slot {
  id: number; semester_id: number; subject_id: number; lesson_id: number | null; day_of_week: number;
  start_time: string; end_time: string; room: string | null; note: string | null; subject_title: string; color: string; lesson_title: string | null;
}

export default async function AdminTimetablePage({ searchParams }: { searchParams: Promise<{ semester?: string; edit?: string }> }) {
  const user = await requireAdmin('/admin/timetable');
  const sp = await searchParams;

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters ORDER BY sort_order, number');
  let filter = toInt(sp.semester) || (semesters[0]?.id ?? 0);
  const editId = toInt(sp.edit);
  const edit = editId ? await fetchOne<Slot>('SELECT * FROM timetable WHERE id = ?', [editId]) : null;
  if (edit) filter = edit.semester_id;

  const subjects = await fetchAll<Subject>('SELECT * FROM subjects WHERE semester_id = ? AND is_active = TRUE ORDER BY sort_order, id', [filter]);
  const lessons = await fetchAll<LessonOpt>(
    `SELECT l.id, l.title, l.subject_id FROM lessons l
       JOIN subjects s ON s.id = l.subject_id
      WHERE s.semester_id = ? AND l.is_active = TRUE ORDER BY s.sort_order, l.sort_order`, [filter]);

  const rows = await fetchAll<Slot>(
    `SELECT t.*, s.title AS subject_title, s.color, l.title AS lesson_title
       FROM timetable t
       JOIN subjects s ON s.id = t.subject_id
       LEFT JOIN lessons l ON l.id = t.lesson_id
      WHERE t.semester_id = ? ORDER BY t.day_of_week, t.start_time`, [filter]);

  const byDay: Record<number, Slot[]> = {};
  for (const r of rows) (byDay[r.day_of_week] ||= []).push(r);
  const today = todayDow();

  return (
    <Shell user={user} title="Timetable" subtitle="Optional recommended study schedule">
      <LessonFilter />
      <AlertBox type="warning"><b>The timetable never controls access and never records attendance.</b> It only tells students which lesson is suggested for a given day and time. Students who study at another time are not marked absent and lose nothing.</AlertBox>

      <div className="row" style={{ margin: '22px 0', gap: 9 }}>
        {semesters.map(s => (
          <Link key={s.id} className={`chip ${s.id === filter ? 'active' : ''}`} href={`/admin/timetable?semester=${s.id}`}>Semester {s.number}</Link>
        ))}
      </div>

      <div className="split">
        <div>
          <div className="section__head">
            <h2>Weekly plan</h2>
            <div className="row row-tight">
              <span className="badge badge-brand">{rows.length} slots</span>
              {rows.length ? (
                <form action={clearSemester} style={{ display: 'inline' }}>
                  <input type="hidden" name="semester_id" value={filter} />
                  <input type="hidden" name="semester_filter" value={filter} />
                  <button className="btn btn-danger btn-sm" type="submit" data-confirm="Remove every timetable slot in this semester?"><Icon name="trash" className="icon-sm" /> Clear semester</button>
                </form>
              ) : null}
            </div>
          </div>

          {rows.length ? (
            <div className="grid grid-2">
              {[0, 1, 2, 3, 4, 5, 6].map(d => {
                const slots = byDay[d];
                if (!slots?.length) return null;
                return (
                  <div key={d} className={`tt-day reveal ${d === today ? 'today' : ''}`}>
                    <div className="tt-day__head">
                      <b>{dayName(d)}</b>
                      <span className="badge">{slots.length}</span>
                    </div>
                    {slots.map(r => (
                      <div key={r.id} className="tt-slot">
                        <span className="tt-slot__time">{fmtTime(r.start_time)}–{fmtTime(r.end_time)}</span>
                        <span className="tt-slot__bar" style={{ background: r.color }}></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: '.88rem', display: 'block' }}>{r.subject_title}</b>
                          <span className="tiny dim">{r.lesson_title ? r.lesson_title : 'No specific lesson'}{r.room ? ' · ' + r.room : ''}</span>
                        </span>
                        <Link className="btn btn-soft btn-sm" href={`/admin/timetable?edit=${r.id}`}><Icon name="edit" className="icon-sm" /></Link>
                        <form action={deleteSlot} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="semester_filter" value={filter} />
                          <button className="btn btn-danger btn-sm" type="submit" data-confirm="Remove this slot?"><Icon name="trash" className="icon-sm" /></button>
                        </form>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card"><EmptyState icon="calendar" title="No timetable for this semester" text="The timetable is entirely optional — students can follow the lesson sequence without it." /></div>
          )}
        </div>

        <aside>
          <form key={edit?.id ?? `new-${filter}`} className="card card--pad-lg" action={saveSlot} style={{ position: 'sticky', top: 96 }}>
            <input type="hidden" name="id" value={edit ? edit.id : ''} />
            <input type="hidden" name="semester_filter" value={filter} />

            <div className="card__head">
              <h3 className="card__title">{edit ? 'Edit slot' : 'Add a slot'}</h3>
              {edit ? <Link className="tiny strong" style={{ color: 'var(--brand)' }} href={`/admin/timetable?semester=${filter}`}>Cancel</Link> : null}
            </div>

            <div className="field">
              <label htmlFor="semester_id">Semester</label>
              <select className="select" id="semester_id" name="semester_id" defaultValue={edit?.semester_id ?? filter}>
                {semesters.map(s => <option key={s.id} value={s.id}>Semester {s.number}</option>)}
              </select>
              <div className="hint">Switch the chip above first to load that semester&rsquo;s subjects.</div>
            </div>

            <div className="field">
              <label htmlFor="subject_id">Subject</label>
              <select className="select" id="subject_id" name="subject_id" required defaultValue={edit?.subject_id ?? subjects[0]?.id ?? ''}>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="lesson_id">Recommended lesson (optional)</label>
              <select className="select" id="lesson_id" name="lesson_id" defaultValue={edit?.lesson_id ?? ''}>
                <option value="">— No specific lesson —</option>
                {lessons.map(l => <option key={l.id} value={l.id} data-subject={l.subject_id}>{l.title}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="day_of_week">Day</label>
              <select className="select" id="day_of_week" name="day_of_week" defaultValue={edit?.day_of_week ?? 6}>
                {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{dayName(d)}</option>)}
              </select>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="start_time">Start</label>
                <input className="input" type="time" id="start_time" name="start_time" defaultValue={edit ? fmtTime(edit.start_time) : '08:00'} required />
              </div>
              <div className="field">
                <label htmlFor="end_time">End</label>
                <input className="input" type="time" id="end_time" name="end_time" defaultValue={edit ? fmtTime(edit.end_time) : '09:00'} required />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="room">Room</label>
                <input className="input" id="room" name="room" defaultValue={edit?.room ?? ''} placeholder="Room A1" />
              </div>
              <div className="field">
                <label htmlFor="note">Note</label>
                <input className="input" id="note" name="note" defaultValue={edit?.note ?? ''} placeholder="Bring the pelvis model" />
              </div>
            </div>

            <button className="btn btn-primary btn-block" type="submit">
              <Icon name={edit ? 'save' : 'plus'} className="icon-sm" /> {edit ? 'Save slot' : 'Add slot'}
            </button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
