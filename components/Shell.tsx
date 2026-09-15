/**
 * Health House application shell: compact sidebar + dashboard header.
 * Ported from includes/shell_start.php / shell_end.php.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import NavLink from './NavLink';
import { Avatar } from './ui';
import type { User } from '@/lib/auth';
import { fetchAll, fetchOne } from '@/lib/db';
import { APP_SHORT } from '@/lib/config';
import { fmtDateShort, plainText } from '@/lib/text';

export interface Crumb { label: string; href?: string | null }

interface Notice { id: number; title: string; body: string | null; created_at: Date }

export default async function Shell({ user, title, subtitle = '', crumbs, topbarActions, children }:
  { user: User; title: string; subtitle?: string; crumbs?: Crumb[]; topbarActions?: ReactNode; children: ReactNode }) {

  const isAdminUser = user.role === 'admin';

  const mySemester = (!isAdminUser && user.semester_id)
    ? await fetchOne<{ number: number; title: string }>('SELECT * FROM semesters WHERE id = ?', [user.semester_id])
    : null;

  /* --- notices for the bell: announcements addressed to everyone, or to
     this student's semester. Anything from the last seven days counts as
     new; there is no read/unread column, so the badge says "recent". */
  const notices = isAdminUser
    ? await fetchAll<Notice>('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 6')
    : await fetchAll<Notice>(
        `SELECT * FROM announcements WHERE semester_id IS NULL OR semester_id = ?
          ORDER BY created_at DESC LIMIT 6`, [user.semester_id ?? 0]);

  const weekAgo = Date.now() - 7 * 86400 * 1000;
  const isFresh = (n: Notice) => new Date(n.created_at).getTime() >= weekAgo;
  const freshCount = notices.filter(isFresh).length;

  const home = isAdminUser ? '/admin/dashboard' : '/student/dashboard';
  const crumbList: Crumb[] = crumbs && crumbs.length ? crumbs : [{ label: isAdminUser ? 'Administration' : 'Home', href: home }];

  return (
    <div className="app">
      <aside className="sidebar" id="sidebar">
        <div className="sidebar__brand">
          <Link className="logo" href={home}>
            <span className="logo__mark"><Icon name="logo" /></span>
            <span className="logo__text">
              <b>{APP_SHORT}</b>
              <span>{isAdminUser ? 'Administration' : 'Student portal'}</span>
            </span>
          </Link>
          <button className="sidebar__collapse" data-sidebar-toggle type="button"
                  aria-expanded="true" title="Collapse the menu" aria-label="Collapse the menu">
            <Icon name="chevrons-left" className="icon-sm" />
          </button>
        </div>

        <nav className="sidebar__nav">
          {isAdminUser ? (
            <>
              <div className="nav-group">
                <div className="nav-group__label">Overview</div>
                <NavLink href="/admin/dashboard"><Icon name="home" /> Dashboard</NavLink>
              </div>
              <div className="nav-group">
                <div className="nav-group__label">Curriculum</div>
                <NavLink href="/admin/semesters"><Icon name="layers" /> Semesters</NavLink>
                <NavLink href="/admin/subjects"><Icon name="book" /> Subjects</NavLink>
                <NavLink href="/admin/lessons" match={['/admin/lessons', '/admin/lesson']}><Icon name="list" /> Lessons</NavLink>
                <NavLink href="/admin/curriculum"><Icon name="upload" /> Curriculum loader</NavLink>
              </div>
              <div className="nav-group">
                <div className="nav-group__label">Assessment</div>
                <NavLink href="/admin/quizzes" match={['/admin/quizzes', '/admin/quiz']}><Icon name="clipboard" /> Quizzes</NavLink>
                <NavLink href="/admin/results"><Icon name="award" /> Results</NavLink>
              </div>
              <div className="nav-group">
                <div className="nav-group__label">People</div>
                <NavLink href="/admin/students" match={['/admin/students', '/admin/student']}><Icon name="users" /> Students</NavLink>
                <NavLink href="/admin/timetable"><Icon name="calendar" /> Timetable <span className="badge-count">optional</span></NavLink>
              </div>
              <div className="nav-group">
                <div className="nav-group__label">System</div>
                <NavLink href="/admin/progress"><Icon name="chart" /> Progress</NavLink>
                <NavLink href="/admin/settings"><Icon name="settings" /> Settings</NavLink>
              </div>
            </>
          ) : (
            <>
              <div className="nav-group">
                <NavLink href="/student/dashboard"><Icon name="home" /> Dashboard</NavLink>
                <NavLink href="/student/learning" match={['/student/learning', '/student/subject', '/student/lesson']}><Icon name="book" /> My Courses</NavLink>
                <NavLink href="/student/continue"><Icon name="play-circle" /> Continue Learning</NavLink>
                <NavLink href="/student/saved"><Icon name="bookmark" /> Saved Lessons</NavLink>
                <NavLink href="/student/results" match={['/student/results', '/student/result']}><Icon name="clipboard" /> Quizzes &amp; Results</NavLink>
                <NavLink href="/student/progress"><Icon name="chart" /> Progress</NavLink>
                <NavLink href="/student/timetable"><Icon name="calendar" /> Calendar</NavLink>
              </div>
              <div className="nav-group" style={{ marginTop: 'auto' }}>
                <NavLink href="/student/profile"><Icon name="settings" /> Settings</NavLink>
              </div>
            </>
          )}
        </nav>

        {!isAdminUser ? (
          <Link className="sidebar__user" href="/student/profile">
            <Avatar user={user} size="avatar-sm" />
            <span style={{ minWidth: 0 }}>
              <b>{user.full_name}</b>
              <span>{mySemester ? `Student · Semester ${mySemester.number}` : 'Student'}</span>
            </span>
            <Icon name="chevron-right" />
          </Link>
        ) : null}

        <div className="sidebar__foot">
          <a className="nav-link" href="/logout"><Icon name="logout" /> Sign out</a>
        </div>
      </aside>

      <div className="main">
        <div className="readbar" aria-hidden="true"><div className="readbar__fill"></div></div>

        <header className="topbar">
          <button className="iconbtn menu-toggle" data-menu-toggle type="button" aria-label="Open menu"><Icon name="menu" /></button>

          <div className="topbar__id">
            {crumbList.length ? (
              <nav className="crumbs hide-sm" aria-label="Breadcrumb">
                {crumbList.map((c, i) => (
                  <span key={i} style={{ display: 'contents' }}>
                    {i ? <Icon name="chevron-right" /> : null}
                    {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
                  </span>
                ))}
              </nav>
            ) : null}
            <h1 className="topbar__title">{title}</h1>
            {subtitle ? <div className="topbar__sub">{subtitle}</div> : null}
          </div>

          <div className="topbar__spacer"></div>

          <form className="topsearch" method="get" action="/search" role="search">
            <Icon name="search" className="icon-sm" />
            <input type="search" name="q" className="topsearch__input"
                   placeholder={isAdminUser ? 'Search lessons, subjects, students…' : 'Search lessons and subjects…'}
                   aria-label="Search" autoComplete="off" />
            <kbd className="topsearch__kbd">/</kbd>
          </form>

          <button className="iconbtn topsearch__open" data-search-open type="button" aria-label="Search"><Icon name="search" /></button>

          {topbarActions}

          <div className="has-menu">
            <button className="iconbtn" data-menu-toggle-btn="notices" type="button"
                    aria-haspopup="true" aria-expanded="false" aria-label="Notices">
              <Icon name="bell" />
              {freshCount ? <span className="dot" aria-hidden="true"></span> : null}
            </button>
            <div className="menu menu--wide" data-menu="notices" hidden>
              <div className="menu__head row between">
                <b style={{ fontSize: '.85rem' }}>Notices</b>
                {freshCount ? <span className="badge badge-brand">{freshCount} this week</span> : null}
              </div>
              {!notices.length ? (
                <div className="menu__blank">Nothing has been posted yet.</div>
              ) : notices.map(n => (
                <div key={n.id} className={`notice${isFresh(n) ? ' is-fresh' : ''}`}>
                  <b>{n.title}</b>
                  <p>{plainText(n.body, 110)}</p>
                  <span className="tiny dim">{fmtDateShort(n.created_at)}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="iconbtn" data-focus-toggle type="button" aria-pressed="false" title="Full page (F)" aria-label="Full page">
            <Icon name="maximize" />
          </button>

          <button className="iconbtn" data-theme-toggle type="button" aria-label="Toggle dark mode" title="Light / dark">
            <Icon name="sun" className="only-dark" /><Icon name="moon" className="only-light" />
          </button>

          <div className="has-menu">
            <button className="userbtn" data-menu-toggle-btn="account" type="button" aria-haspopup="true" aria-expanded="false">
              <Avatar user={user} />
              <span className="userbtn__text hide-sm">
                <b>{user.full_name}</b>
                <span>{isAdminUser ? 'Administrator' : (mySemester ? `Semester ${mySemester.number}` : 'Student')}</span>
              </span>
              <Icon name="chevron-down" className="icon-sm" />
            </button>
            <div className="menu" data-menu="account" hidden>
              <div className="menu__head">
                <b style={{ display: 'block', fontSize: '.86rem' }}>{user.full_name}</b>
                <span className="tiny dim">{user.email}</span>
              </div>
              <Link className="menu__item" href={isAdminUser ? '/admin/settings' : '/student/profile'}>
                <Icon name="user" /> {isAdminUser ? 'Settings' : 'My profile'}
              </Link>
              {!isAdminUser ? (
                <>
                  <Link className="menu__item" href="/student/progress"><Icon name="chart" /> My progress</Link>
                  <Link className="menu__item" href="/student/saved"><Icon name="bookmark" /> Saved lessons</Link>
                </>
              ) : null}
              <div className="menu__sep"></div>
              <a className="menu__item is-danger" href="/logout"><Icon name="logout" /> Sign out</a>
            </div>
          </div>
        </header>

        <main className="page">
          {children}
        </main>
      </div>

      <button className="to-top" type="button" aria-label="Back to top" title="Back to top">
        <Icon name="arrow-up" />
      </button>
      <button className="focus-exit" type="button">
        <Icon name="minimize" className="icon-sm" /> Leave full page <kbd>Esc</kbd>
      </button>
    </div>
  );
}
