import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { EmptyState, ProgressRing } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll, fetchOne, fetchValue, toInt } from '@/lib/db';
import { semesterProgressMap, subjectFacts, subjectProgressMap, type SemesterProgress } from '@/lib/progress';
import { difficultyMeta, dirOf, duration } from '@/lib/text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Courses' };

interface Semester { id: number; number: number; title: string }
interface Subject { id: number; title: string; code: string | null; credits: number; description: string | null }

export default async function LearningPage({ searchParams }: { searchParams: Promise<{ semester?: string }> }) {
  const user = await requireStudent('/student/learning');
  const uid = user.id;
  const sp = await searchParams;

  const semesters = await fetchAll<Semester>('SELECT * FROM semesters WHERE is_active = TRUE ORDER BY sort_order, number');

  const requested = toInt(sp.semester);
  let selected = requested || (user.semester_id ?? semesters[0]?.id ?? 0);
  if (!semesters.some(s => s.id === selected)) selected = semesters[0]?.id ?? 0;

  const semMap = await semesterProgressMap(uid);
  let semester = selected ? await fetchOne<Semester>('SELECT * FROM semesters WHERE id = ?', [selected]) : null;
  let subjects = selected ? await fetchAll<Subject>('SELECT * FROM subjects WHERE semester_id = ? AND is_active = TRUE ORDER BY sort_order, id', [selected]) : [];
  let subProg = await subjectProgressMap(uid, selected || null);
  let semProg: SemesterProgress = semMap[selected] ?? { percent: 0, completed: 0, total: 0, remaining: 0, locked: true, status: 'Not yet available' };

  /* A semester with no published lessons is locked. Landing on one — because
     the student has not been assigned an open semester, or followed an old
     link — should show the first semester that does have material. */
  let selectedLocked = !!semProg.locked;
  if (selectedLocked && !requested) {
    for (const s of semesters) {
      if (!semMap[s.id]?.locked) {
        selected = s.id;
        semester = await fetchOne<Semester>('SELECT * FROM semesters WHERE id = ?', [selected]);
        subjects = await fetchAll<Subject>('SELECT * FROM subjects WHERE semester_id = ? AND is_active = TRUE ORDER BY sort_order, id', [selected]);
        subProg = await subjectProgressMap(uid, selected);
        semProg = semMap[selected];
        selectedLocked = false;
        break;
      }
    }
  }

  const facts = await subjectFacts(uid, subjects.map(s => s.id));
  const quizCounts: Record<number, number> = {};
  for (const s of subjects) {
    quizCounts[s.id] = toInt(await fetchValue(
      `SELECT COUNT(*) FROM quizzes q JOIN lessons l ON l.id = q.lesson_id
        WHERE l.subject_id = ? AND q.is_active = TRUE`, [s.id], 0));
  }
  const firstSemesterId = toInt(await fetchValue('SELECT id FROM semesters WHERE number = 1', [], 0));
  const tiles = ['tile-red', 'tile-teal', 'tile-purple', 'tile-amber', 'tile-blue', 'tile-pink'];

  return (
    <Shell user={user} title="Courses" subtitle="Explore all semester programs"
           crumbs={[{ label: 'Home', href: '/student/dashboard' }, { label: 'Courses' }]}>

      <div className="page-head">
        <div>
          <h1>Courses</h1>
          <p className="muted" style={{ margin: 0 }}>Explore all semester programs and start your learning journey.</p>
        </div>
      </div>

      {/* semester pills */}
      <div className="pills" style={{ marginBottom: 22 }}>
        {semesters.map(s => {
          const locked = !!(semMap[s.id]?.locked ?? true);
          return locked ? (
            <span key={s.id} className="pill is-locked" title="This semester has not been published yet" aria-disabled="true">
              <Icon name="lock" /> Semester {s.number}
            </span>
          ) : (
            <Link key={s.id} className={`pill ${s.id === selected ? 'is-active' : ''}`} href={`/student/learning?semester=${s.id}`}>
              Semester {s.number}
            </Link>
          );
        })}
      </div>

      {semester && !selectedLocked ? (
        <section className="sem-card">
          <div className="sem-card__head">
            <div style={{ minWidth: 0 }}>
              <h2>Semester {semester.number}</h2>
              <div className="sem-card__meta">
                {subjects.length} Subjects <i>•</i> {semProg.total} Lessons <i>•</i> {semProg.completed} Completed
              </div>
            </div>
            <div className="sem-card__ring">
              <div style={{ textAlign: 'right' }}>
                <div className="tiny dim">Progress</div>
                <div className="tiny dim">{semProg.completed} of {semProg.total}</div>
              </div>
              <ProgressRing percent={semProg.percent} size={58} stroke={6} caption="" />
            </div>
          </div>

          {subjects.length ? (
            <div>
              {subjects.map((s, i) => {
                const p = subProg[s.id] ?? { total: 0, completed: 0, percent: 0 };
                const fx = facts[s.id] ?? { minutes: 0, level: 'core' };
                const lvl = difficultyMeta(fx.level);
                const dir = dirOf(s.title);
                const pctV = p.percent;
                const quizN = quizCounts[s.id] ?? 0;
                const [cta, ctaCls] = pctV >= 100 ? ['Review', 'btn-ghost'] : pctV > 0 ? ['Continue', 'btn-primary'] : ['Start', 'btn-ghost'];
                return (
                  <div key={s.id} className="subject-row">
                    <span className={`subject-row__icon ${tiles[i % tiles.length]}`}>{[...s.title][0]?.toUpperCase()}</span>
                    <div className="subject-row__body">
                      <h3 className="subject-row__title" dir={dir} lang={dir === 'rtl' ? 'ps' : undefined}>{s.title}</h3>
                      <div className="subject-row__meta">
                        <span>{p.total} Lessons</span>
                        {fx.minutes ? <><i>•</i><span>{duration(fx.minutes)}</span></> : null}
                        {quizN ? <><i>•</i><span>{quizN} Quiz{quizN === 1 ? '' : 'zes'}</span></> : null}
                        <i>•</i><span className={`level ${lvl.class}`}>{lvl.label}</span>
                        {pctV > 0 ? <><i>•</i><span>{pctV}% complete</span></> : null}
                      </div>
                    </div>
                    <Link className={`btn ${ctaCls} btn-sm`} href={`/student/subject/${s.id}`}>{cta}</Link>
                    <Link href={`/student/subject/${s.id}`} aria-label="Open"><Icon name="chevron-right" className="subject-row__go" /></Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="book" title="No subjects yet" text="This semester does not contain any published subjects." />
          )}
        </section>
      ) : (
        <div className="card locked-panel">
          <span className="locked-panel__icon"><Icon name="lock" className="icon-lg" /></span>
          <h3>This semester is not open yet</h3>
          <p className="muted">
            Semester&nbsp;1 is the material available at the moment. The rest of the programme
            is being prepared and will appear here as each semester is published — you will not
            need to do anything to get it.
          </p>
          <Link className="btn btn-primary" href={`/student/learning?semester=${firstSemesterId}`}>
            <Icon name="book" className="icon-sm" /> Go to Semester 1
          </Link>
        </div>
      )}
    </Shell>
  );
}
