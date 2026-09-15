import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { Avatar, ProgressRing } from '@/components/ui';
import { requireStudent } from '@/lib/auth';
import { fetchOne, toInt } from '@/lib/db';
import { overallProgress } from '@/lib/progress';
import { fmtDate, timeAgo } from '@/lib/text';
import { changePassword, updateProfile } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My profile' };

export default async function ProfilePage() {
  const user = await requireStudent('/student/profile');
  const uid = user.id;

  const semester = user.semester_id ? await fetchOne<{ title: string }>('SELECT * FROM semesters WHERE id = ?', [user.semester_id]) : null;
  const overall = await overallProgress(uid);
  const stats = (await fetchOne(
    `SELECT (SELECT COUNT(*) FROM lesson_progress WHERE user_id = ? AND status = 'completed') AS lessons,
            (SELECT COUNT(*) FROM quiz_attempts   WHERE user_id = ? AND completed_at IS NOT NULL) AS quizzes,
            (SELECT COUNT(*) FROM quiz_attempts   WHERE user_id = ? AND passed = TRUE) AS passed`,
    [uid, uid, uid])) ?? { lessons: 0, quizzes: 0, passed: 0 };

  return (
    <Shell user={user} title="My profile" subtitle="Account details and password">
      <div className="split">
        <div className="stack">

          <form className="card card--pad-lg" action={updateProfile} encType="multipart/form-data">
            <div className="card__head"><h2 className="card__title">Personal details</h2></div>

            <div className="row" style={{ gap: 18, marginBottom: 22 }}>
              <Avatar user={user} size="avatar-lg" />
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="label">Profile photo</label>
                <div className="file-drop" style={{ padding: 14 }}>
                  <input type="file" name="avatar" accept="image/*" hidden />
                  <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
                    <Icon name="upload" className="icon-sm" /><span data-file-name>Click or drop an image here</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="full_name">Full name</label>
                <input className="input" id="full_name" name="full_name" defaultValue={user.full_name} required />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input className="input" id="phone" name="phone" defaultValue={user.phone ?? ''} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Email address</label>
                <input className="input" defaultValue={user.email} disabled />
                <div className="hint">Only an administrator can change your email address.</div>
              </div>
              <div className="field">
                <label>Student code</label>
                <input className="input" defaultValue={user.student_code || '—'} disabled />
              </div>
            </div>

            <button className="btn btn-primary" type="submit"><Icon name="save" className="icon-sm" /> Save changes</button>
          </form>

          <form className="card card--pad-lg" action={changePassword}>
            <div className="card__head"><h2 className="card__title">Change password</h2></div>
            <div className="field">
              <label htmlFor="current_password">Current password</label>
              <input className="input" type="password" id="current_password" name="current_password" required autoComplete="current-password" />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="new_password">New password</label>
                <input className="input" type="password" id="new_password" name="new_password" required minLength={6} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="confirm_password">Confirm new password</label>
                <input className="input" type="password" id="confirm_password" name="confirm_password" required minLength={6} autoComplete="new-password" />
              </div>
            </div>
            <button className="btn btn-dark" type="submit"><Icon name="lock" className="icon-sm" /> Update password</button>
          </form>
        </div>

        <aside className="stack">
          <div className="card center">
            <ProgressRing percent={overall.percent} size={150} stroke={13} caption="programme" />
            <h3 style={{ margin: '16px 0 4px' }}>{user.full_name}</h3>
            <p className="small muted" style={{ margin: 0 }}>{semester ? semester.title : 'No semester assigned'}</p>
          </div>

          <div className="card">
            <div className="card__head"><h3 className="card__title">At a glance</h3></div>
            <div className="stack" style={{ gap: 12 }}>
              <div className="row between"><span className="small muted">Lessons completed</span><b>{toInt(stats.lessons)}</b></div>
              <div className="row between"><span className="small muted">Quiz attempts</span><b>{toInt(stats.quizzes)}</b></div>
              <div className="row between"><span className="small muted">Quizzes passed</span><b>{toInt(stats.passed)}</b></div>
              <div className="row between"><span className="small muted">Member since</span><b className="small">{fmtDate(user.created_at)}</b></div>
              <div className="row between"><span className="small muted">Last sign-in</span><b className="small">{timeAgo(user.last_login_at)}</b></div>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
