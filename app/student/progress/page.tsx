import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { ProgressBar, ProgressRing } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchValue, toInt } from '@/lib/db';
import { overallProgress, semesterProgressMap, subjectProgressMap } from '@/lib/progress';
import { semesterShortTitle } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Six-semester progress' };

interface Semester { id: number; number: number; title: string }
interface Subject { id: number; semester_id: number; title: string; color: string }

export default async function ProgressPage() {
  const user = await requireStudent('/student/progress');
  const uid = user.id;

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters WHERE is_active = TRUE ORDER BY sort_order, number');
  const semMap  = await semesterProgressMap(uid);
  const subProg = await subjectProgressMap(uid);
  const overall = await overallProgress(uid);

  const subjectsBySemester: Record<number, Subject[]> = {};
  for (const s of await fetchAll<Subject>('SELECT * FROM subjects WHERE is_active = TRUE ORDER BY sort_order, id')) {
    (subjectsBySemester[s.semester_id] ||= []).push(s);
  }

  const completedCount = overall.completed;
  const inProgress = toInt(await fetchValue("SELECT COUNT(*) FROM lesson_progress WHERE user_id = ? AND status = 'in_progress'", [uid], 0));
  const quizPassed = toInt(await fetchValue('SELECT COUNT(DISTINCT quiz_id) FROM quiz_attempts WHERE user_id = ? AND passed = TRUE', [uid], 0));

  return (
    <Shell user={user} title="Six-semester progress" subtitle="Your complete academic journey">
      <section className="card card--pad-lg reveal" style={{ marginBottom: 26 }}>
        <div className="row between" style={{ gap: 30, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className="eyebrow"><Icon name="graduation" className="icon-sm" /> Whole programme</span>
            <h1 style={{ fontSize: '1.9rem', margin: '14px 0 6px' }}>{overall.percent}% of the midwifery programme completed</h1>
            <p className="muted">{completedCount} of {overall.total} lessons finished across all six semesters.</p>
            <div className="row" style={{ gap: 26, marginTop: 20, flexWrap: 'wrap' }}>
              <div><b style={{ fontSize: '1.35rem', color: 'var(--teal)' }}>{completedCount}</b><div className="tiny dim">Lessons completed</div></div>
              <div><b style={{ fontSize: '1.35rem', color: 'var(--brand)' }}>{inProgress}</b><div className="tiny dim">In progress</div></div>
              <div><b style={{ fontSize: '1.35rem', color: 'var(--amber)' }}>{Math.max(0, overall.total - completedCount)}</b><div className="tiny dim">Remaining</div></div>
              <div><b style={{ fontSize: '1.35rem', color: 'var(--rose)' }}>{quizPassed}</b><div className="tiny dim">Quizzes passed</div></div>
            </div>
          </div>
          <div><ProgressRing percent={overall.percent} size={170} stroke={14} caption="programme" /></div>
        </div>
      </section>

      {/* summary table */}
      <section className="section">
        <div className="section__head"><h2>Semester summary</h2></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Semester</th><th>Subjects</th><th>Lessons</th><th style={{ minWidth: 220 }}>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {semesters.map(sem => {
                const p = semMap[sem.id] ?? { percent: 0, completed: 0, total: 0, status: 'Not yet available', locked: true };
                const locked = !!p.locked;
                const isNow = user.semester_id === sem.id;
                const tone = locked ? 'badge-outline' : (p.status === 'Completed' ? 'badge-teal' : (p.status === 'In Progress' ? 'badge-brand' : ''));
                return (
                  <tr key={sem.id} className={locked ? 'is-locked-row' : undefined}>
                    <td>
                      <b>Semester {sem.number}</b>
                      {isNow && !locked ? <span className="badge badge-amber" style={{ marginLeft: 8 }}>Current</span> : null}
                      <div className="tiny dim">{semesterShortTitle(sem.title)}</div>
                    </td>
                    <td>{locked ? '—' : (subjectsBySemester[sem.id] ?? []).length}</td>
                    <td>{locked ? '—' : `${p.completed} / ${p.total}`}</td>
                    <td>
                      {locked ? <span className="tiny dim">Not published yet</span> : (
                        <div className="row" style={{ gap: 10 }}>
                          <b style={{ minWidth: 44 }}>{p.percent}%</b>
                          <div style={{ flex: 1 }}><ProgressBar percent={p.percent} tone={p.percent >= 100 ? 'teal' : ''} className="bar-sm" /></div>
                        </div>
                      )}
                    </td>
                    <td><span className={`badge ${tone}`}>{locked ? <><Icon name="lock" className="icon-sm" /> </> : null}{p.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* per-semester subject breakdown */}
      {semesters.map(sem => {
        const subjects = subjectsBySemester[sem.id] ?? [];
        if (!subjects.length) return null;
        const p = semMap[sem.id] ?? { percent: 0 };
        return (
          <section key={sem.id} className="section">
            <div className="section__head">
              <h2 style={{ fontSize: '1.1rem' }}>Semester {sem.number} — {p.percent}% overall</h2>
              <Link className="btn btn-ghost btn-sm" href={`/student/learning?semester=${sem.id}`}>Open <Icon name="arrow-right" className="icon-sm" /></Link>
            </div>
            <div className="card">
              <div className="stack" style={{ gap: 18 }}>
                {subjects.map(s => {
                  const sp = subProg[s.id] ?? { percent: 0, completed: 0, total: 0 };
                  return (
                    <div key={s.id}>
                      <div className="row between" style={{ marginBottom: 7 }}>
                        <Link className="row row-tight" href={`/student/subject/${s.id}`} style={{ gap: 9 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }}></span>
                          <b style={{ fontSize: '.9rem' }}>{s.title}</b>
                        </Link>
                        <span className="small"><b>{sp.percent}%</b> <span className="dim">· {sp.completed}/{sp.total} lessons</span></span>
                      </div>
                      <ProgressBar percent={sp.percent} tone={sp.percent >= 100 ? 'teal' : ''} className="bar-sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </Shell>
  );
}
