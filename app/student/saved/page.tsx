/**
 * Lessons the student has saved for later. Saving is deliberately separate
 * from progress, so the two never overwrite each other.
 */
import Link from 'next/link';
import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { Dir, EmptyState } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchAll } from '@/lib/db';
import { difficultyMeta, dirOf, duration, plainText, statusMeta } from '@/lib/text';
import { removeSaved } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saved lessons' };

interface Saved {
  id: number; title: string; description: string | null; duration_minutes: number; difficulty: string; recommended_day: number;
  subject_title: string; subject_id: number; semester_number: number; saved_at: Date; status: string;
}

export default async function SavedPage() {
  const user = await requireStudent('/student/saved');

  const saved = await fetchAll<Saved>(
    `SELECT l.id, l.title, l.description, l.duration_minutes, l.difficulty, l.recommended_day,
            s.title AS subject_title, s.id AS subject_id,
            sem.number AS semester_number,
            b.created_at AS saved_at,
            COALESCE(lp.status, 'not_started') AS status
       FROM lesson_bookmarks b
       JOIN lessons   l   ON l.id = b.lesson_id AND l.is_active = TRUE
       JOIN subjects  s   ON s.id = l.subject_id
       JOIN semesters sem ON sem.id = s.semester_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = b.user_id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC`, [user.id]);

  return (
    <Shell user={user} title="Saved lessons" subtitle={`${saved.length} lesson${saved.length === 1 ? '' : 's'} kept for later`}
           crumbs={[{ label: 'Home', href: '/student/dashboard' }, { label: 'Saved' }]}>

      <div className="page-head">
        <div>
          <h1>Saved lessons</h1>
          <p className="muted" style={{ margin: 0 }}>Anything you saved while studying. Saving never changes your progress.</p>
        </div>
      </div>

      {!saved.length ? (
        <div className="card">
          <EmptyState icon="bookmark" title="Nothing saved yet"
            text="Open a lesson and press Save to keep it here — useful for a topic you want to revisit before an exam."
            action={<Link className="btn btn-primary" href="/student/learning"><Icon name="book" className="icon-sm" /> Browse the curriculum</Link>} />
        </div>
      ) : (
        <div className="grid grid-3">
          {saved.map(l => {
            const lvl = difficultyMeta(l.difficulty);
            const meta = statusMeta(l.status);
            const dir = dirOf(l.title);
            return (
              <article key={l.id} className="topic">
                <div className="topic__head">
                  <span className="topic__icon"><Icon name="bookmark" /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="topic__title" dir={dir} lang={dir === 'rtl' ? 'ps' : undefined}>{l.title}</h3>
                    <div className="topic__sub">Semester {l.semester_number} · {plainText(l.subject_title, 34)}</div>
                  </div>
                  <span className={`badge ${l.status === 'completed' ? 'badge-teal' : l.status === 'in_progress' ? 'badge-brand' : 'badge-outline'}`}>{meta.label}</span>
                </div>

                {String(l.description ?? '').trim() !== '' ? (
                  <Dir as="p" text={l.description} className="topic__desc">{plainText(l.description, 120)}</Dir>
                ) : null}

                <div className="topic__facts">
                  <span className={`level ${lvl.class}`}>{lvl.label}</span>
                  {l.duration_minutes ? <span className="badge"><Icon name="clock" className="icon-sm" /> {duration(l.duration_minutes)}</span> : null}
                  <span className="badge"><Icon name="calendar" className="icon-sm" /> Day {l.recommended_day}</span>
                </div>

                <div className="topic__foot">
                  <Link className="btn btn-soft btn-sm" href={`/student/lesson/${l.id}`}>
                    {l.status === 'completed' ? 'Review' : l.status === 'in_progress' ? 'Continue' : 'Start'} <Icon name="arrow-right" className="icon-sm" />
                  </Link>
                  <form action={removeSaved} style={{ margin: 0 }}>
                    <input type="hidden" name="lesson_id" value={l.id} />
                    <button className="btn btn-ghost btn-sm" type="submit" title="Remove from saved">
                      <Icon name="trash" className="icon-sm" /> Remove
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
