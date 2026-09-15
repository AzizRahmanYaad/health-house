import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { AlertBox, EmptyState, ProgressBar } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll, toInt } from '@/lib/db';
import { timetableForSemester, type TimetableRow } from '@/lib/lms';
import { pct } from '@/lib/progress';
import { dayName, fmtTime, todayDow } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Timetable' };

interface Semester { id: number; number: number }

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ semester?: string }> }) {
  const user = await requireStudent('/student/timetable');
  const uid = user.id;

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters WHERE is_active = TRUE ORDER BY sort_order, number');
  const selected = toInt((await searchParams).semester) || (user.semester_id ?? semesters[0]?.id ?? 0);

  const rows = selected ? await timetableForSemester(selected, uid) : [];
  const today = todayDow();

  const byDay: Record<number, TimetableRow[]> = {};
  for (const r of rows) (byDay[r.day_of_week] ||= []).push(r);

  const scheduled = rows.length;
  const done = rows.filter(r => r.lesson_status === 'completed').length;

  return (
    <Shell user={user} title="Timetable" subtitle="A recommended study schedule — never an attendance register">
      <AlertBox type="info">
        <b>This timetable is optional.</b> It suggests when to study each lesson. If you study at a different time — or not at all
        on a given day — you are <b>not</b> marked absent, no penalty is applied and nothing is locked. The lesson simply stays
        “not completed” until you finish it.
      </AlertBox>

      <div className="row between" style={{ margin: '22px 0', gap: 12, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 9 }}>
          {semesters.map(s => (
            <Link key={s.id} className={`chip ${s.id === selected ? 'active' : ''}`} href={`/student/timetable?semester=${s.id}`}>Semester {s.number}</Link>
          ))}
        </div>
        <div className="row" style={{ gap: 18 }}>
          <div className="center"><b style={{ fontSize: '1.2rem' }}>{scheduled}</b><div className="tiny dim">Scheduled slots</div></div>
          <div className="center"><b style={{ fontSize: '1.2rem', color: 'var(--teal)' }}>{done}</b><div className="tiny dim">Already completed</div></div>
        </div>
      </div>

      {rows.length ? (
        <>
          <div className="grid grid-2">
            {[0, 1, 2, 3, 4, 5, 6].map(d => {
              const slots = byDay[d];
              if (!slots?.length) return null;
              const dayDone = slots.filter(r => r.lesson_status === 'completed').length;
              return (
                <div key={d} className={`tt-day reveal ${d === today ? 'today' : ''}`}>
                  <div className="tt-day__head">
                    <b>{dayName(d)}{d === today ? ' · today' : ''}</b>
                    <span className="badge">{dayDone}/{slots.length} completed</span>
                  </div>
                  {slots.map(r => {
                    const isDone = r.lesson_status === 'completed';
                    const href = r.lesson_id ? `/student/lesson/${r.lesson_id}` : '#';
                    return (
                      <Link key={r.id} className="tt-slot" href={href}>
                        <span className="tt-slot__time">{fmtTime(r.start_time)}–{fmtTime(r.end_time)}</span>
                        <span className="tt-slot__bar" style={{ background: r.color }}></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: '.9rem', display: 'block' }}>{r.lesson_title ?? r.subject_title}</b>
                          <span className="tiny dim">{r.subject_title}{r.room ? ' · ' + r.room : ''}{r.note ? ' · ' + r.note : ''}</span>
                        </span>
                        <span className={`badge ${isDone ? 'badge-teal' : ''}`}>{isDone ? 'Completed' : 'Not completed'}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: 24, borderLeft: '4px solid var(--teal)' }}>
            <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
              <Icon name="shield" />
              <div>
                <b>Recommended schedule vs actual progress</b>
                <p className="small muted" style={{ margin: '6px 0 0' }}>
                  Of {scheduled} recommended slots in this semester you have completed <b>{done}</b>.
                  The remaining {Math.max(0, scheduled - done)} are simply still open — study them whenever you are ready.
                </p>
                <div style={{ marginTop: 12, maxWidth: 420 }}><ProgressBar percent={pct(done, Math.max(1, scheduled))} tone="teal" /></div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card"><EmptyState icon="calendar" title="No timetable published"
          text="Your administrator has not created a recommended schedule for this semester. You can still study every lesson in sequence."
          action={<Link className="btn btn-primary btn-sm" href="/student/learning">Go to my subjects</Link>} /></div>
      )}
    </Shell>
  );
}
