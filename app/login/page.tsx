import Link from 'next/link';
import { redirect } from 'next/navigation';
import Icon from '@/components/Icon';
import { currentUser } from '@/lib/auth';
import { APP_INSTITUTION, APP_SHORT } from '@/lib/config';
import { currentYear } from '@/lib/text';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await currentUser();
  if (user) redirect(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
  const { next = '' } = await searchParams;

  return (
    <div className="auth">
      <aside className="auth__aside">
        <Link className="logo" href="/">
          <span className="logo__mark"><Icon name="logo" /></span>
          <span className="logo__text"><b>{APP_SHORT}</b><span>{APP_INSTITUTION}</span></span>
        </Link>

        <div>
          <h2>Your six-semester<br />learning journey.</h2>
          <p style={{ maxWidth: 400 }}>
            Structured, sequential and completely self-paced. Study when it suits you —
            your progress is measured by what you complete, never by attendance.
          </p>
          <div className="auth__points">
            <div className="auth__point"><i><Icon name="play-circle" className="icon-sm" /></i> Continue exactly where you stopped</div>
            <div className="auth__point"><i><Icon name="layers" className="icon-sm" /></i> Semester → subject → ordered lessons</div>
            <div className="auth__point"><i><Icon name="chart" className="icon-sm" /></i> Live progress at every level</div>
            <div className="auth__point"><i><Icon name="calendar" className="icon-sm" /></i> Timetable that guides, never blocks</div>
          </div>
        </div>

        <p className="tiny dim">© {currentYear()} {APP_INSTITUTION}</p>
      </aside>

      <section className="auth__form">
        <div className="auth__form-inner">
          <Link className="logo" href="/" style={{ marginBottom: 28 }}>
            <span className="logo__mark"><Icon name="logo" /></span>
            <span className="logo__text"><b>{APP_SHORT}</b><span>Sign in to continue</span></span>
          </Link>

          <h1 style={{ fontSize: '1.85rem', marginBottom: 6 }}>Welcome back</h1>
          <p className="muted" style={{ marginBottom: 26 }}>Sign in with the account issued by your programme administrator.</p>

          <LoginForm next={next} />

          <div style={{ marginTop: 26 }}>
            <div className="uppercase dim" style={{ marginBottom: 10 }}>Demo accounts — click to fill</div>
            <div className="demo-cred" data-fill="admin@midwifery.edu|admin123">
              <span><b>Administrator</b> · admin@midwifery.edu</span>
              <span className="badge badge-brand">admin123</span>
            </div>
            <div className="demo-cred" data-fill="sara@student.edu|student123">
              <span><b>Student</b> · sara@student.edu</span>
              <span className="badge badge-teal">student123</span>
            </div>
          </div>

          <p className="tiny dim center" style={{ marginTop: 26 }}>
            <Link href="/" style={{ fontWeight: 700, color: 'var(--brand)' }}>← Back to the home page</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
