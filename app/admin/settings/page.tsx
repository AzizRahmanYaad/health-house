import Icon from '@/components/Icon';
import Shell from '@/components/Shell';
import { Avatar } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { APP_INSTITUTION, APP_NAME, MAX_UPLOAD_SIZE } from '@/lib/config';
import { fetchAll, fetchValue } from '@/lib/db';
import { allSettings } from '@/lib/lms';
import { humanSize, timeAgo } from '@/lib/text';
import { UPLOAD_PATH, uploadsWritable } from '@/lib/uploads';
import { changeAdminPassword, deleteAnnouncement, publishAnnouncement, saveSiteSettings, updateAdminProfile } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

interface Semester { id: number; number: number }
interface Announcement { id: number; title: string; created_at: Date; semester_number: number | null }

export default async function SettingsPage() {
  const user = await requireAdmin('/admin/settings');

  const settings = await allSettings();
  const semesters = await fetchAll<Semester>('SELECT * FROM semesters ORDER BY sort_order, number');
  const announcements = await fetchAll<Announcement>(
    `SELECT a.*, sem.number AS semester_number FROM announcements a
       LEFT JOIN semesters sem ON sem.id = a.semester_id
      ORDER BY a.created_at DESC LIMIT 20`);

  const pgVersion = String(await fetchValue('SHOW server_version', [], '—'));
  const dbInfo: [string, string][] = [
    ['Node.js version', process.version],
    ['PostgreSQL version', pgVersion],
    ['Upload max size', humanSize(MAX_UPLOAD_SIZE)],
    ['Upload folder', UPLOAD_PATH],
    ['Uploads writable', (await uploadsWritable()) ? 'Yes' : 'No — check folder permissions'],
    ['Environment', process.env.NODE_ENV ?? 'development'],
  ];

  return (
    <Shell user={user} title="Settings" subtitle="Portal configuration, your account and announcements">
      <div className="split">
        <div className="stack">

          <form className="card card--pad-lg" action={updateAdminProfile} encType="multipart/form-data">
            <div className="card__head"><h2 className="card__title">Administrator profile</h2></div>
            <div className="row" style={{ gap: 18, marginBottom: 20 }}>
              <Avatar user={user} size="avatar-lg" />
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="label">Profile photo</label>
                <div className="file-drop" style={{ padding: 14 }}>
                  <input type="file" name="avatar" accept="image/*" hidden />
                  <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
                    <Icon name="upload" className="icon-sm" /><span data-file-name>Click or drop an image</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="full_name">Full name</label>
                <input className="input" id="full_name" name="full_name" defaultValue={user.full_name} required /></div>
              <div className="field"><label htmlFor="phone">Phone</label>
                <input className="input" id="phone" name="phone" defaultValue={user.phone ?? ''} /></div>
            </div>
            <div className="field"><label htmlFor="email">Email</label>
              <input className="input" type="email" id="email" name="email" defaultValue={user.email} required /></div>
            <button className="btn btn-primary" type="submit"><Icon name="save" className="icon-sm" /> Save profile</button>
          </form>

          <form className="card card--pad-lg" action={changeAdminPassword}>
            <div className="card__head"><h2 className="card__title">Change password</h2></div>
            <div className="field"><label htmlFor="current_password">Current password</label>
              <input className="input" type="password" id="current_password" name="current_password" required /></div>
            <div className="field-row">
              <div className="field"><label htmlFor="new_password">New password</label>
                <input className="input" type="password" id="new_password" name="new_password" minLength={8} required /></div>
              <div className="field"><label htmlFor="confirm_password">Confirm</label>
                <input className="input" type="password" id="confirm_password" name="confirm_password" minLength={8} required /></div>
            </div>
            <button className="btn btn-dark" type="submit"><Icon name="lock" className="icon-sm" /> Update password</button>
          </form>

          <form className="card card--pad-lg" action={saveSiteSettings}>
            <div className="card__head"><h2 className="card__title">Portal details</h2></div>
            <div className="field"><label htmlFor="site_name">Portal name</label>
              <input className="input" id="site_name" name="site_name" defaultValue={settings.site_name ?? APP_NAME} /></div>
            <div className="field-row">
              <div className="field"><label htmlFor="institution">Institution</label>
                <input className="input" id="institution" name="institution" defaultValue={settings.institution ?? APP_INSTITUTION} /></div>
              <div className="field"><label htmlFor="support_email">Support email</label>
                <input className="input" type="email" id="support_email" name="support_email" defaultValue={settings.support_email ?? ''} /></div>
            </div>
            <div className="hint" style={{ marginBottom: 16 }}>
              The name shown in the sidebar comes from the <code>APP_NAME</code> / <code>APP_SHORT</code> environment variables; these values are stored for use in reports and emails.
            </div>
            <button className="btn btn-primary" type="submit"><Icon name="save" className="icon-sm" /> Save settings</button>
          </form>

          <form className="card card--pad-lg" action={publishAnnouncement}>
            <div className="card__head"><h2 className="card__title">Publish an announcement</h2></div>
            <div className="field"><label htmlFor="a_title">Title</label>
              <input className="input" id="a_title" name="a_title" placeholder="Semester 1 practical session" required /></div>
            <div className="field"><label htmlFor="a_body">Message</label>
              <textarea className="textarea" id="a_body" name="a_body" style={{ minHeight: 90 }}></textarea></div>
            <div className="field"><label htmlFor="a_semester">Audience</label>
              <select className="select" id="a_semester" name="a_semester" defaultValue="">
                <option value="">All students</option>
                {semesters.map(s => <option key={s.id} value={s.id}>Semester {s.number} only</option>)}
              </select></div>
            <button className="btn btn-dark" type="submit"><Icon name="bell" className="icon-sm" /> Publish</button>
          </form>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card__head"><h3 className="card__title">System information</h3></div>
            <div className="stack" style={{ gap: 11 }}>
              {dbInfo.map(([k, v]) => (
                <div key={k} className="row between"><span className="small muted">{k}</span><b className="small" style={{ textAlign: 'right', wordBreak: 'break-all' }}>{v}</b></div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card__head"><h3 className="card__title">Recent announcements</h3></div>
            <div className="stack" style={{ gap: 14 }}>
              {announcements.map(a => (
                <div key={a.id} className="row between" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: '.87rem', display: 'block' }}>{a.title}</b>
                    <span className="tiny dim">{a.semester_number ? `Semester ${a.semester_number}` : 'All students'} · {timeAgo(a.created_at)}</span>
                  </div>
                  <form action={deleteAnnouncement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn btn-danger btn-sm" type="submit" data-confirm="Delete this announcement?"><Icon name="trash" className="icon-sm" /></button>
                  </form>
                </div>
              ))}
              {!announcements.length ? <p className="small dim">Nothing published yet.</p> : null}
            </div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <b style={{ fontSize: '.9rem' }}>Before going live</b>
            <ul className="small muted" style={{ paddingLeft: '1.1em', margin: '10px 0 0', lineHeight: 1.8 }}>
              <li>Set a long random <code>SESSION_SECRET</code>.</li>
              <li>Run with <code>NODE_ENV=production</code> (<code>npm run build &amp;&amp; npm start</code>).</li>
              <li>Change the demo passwords.</li>
              <li>Make sure the upload folder is writable and backed up.</li>
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
