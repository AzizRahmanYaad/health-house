/**
 * Reusable view components — ported from includes/components.php.
 * All are Server-Component friendly (no hooks).
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { uploadUrl } from '@/lib/media';
import { difficultyMeta, dirOf, duration, initials, plainText, statusMeta } from '@/lib/text';

export function ProgressRing({ percent, size = 128, stroke = 11, caption = 'complete', grad = 'ringGrad' }:
  { percent: number; size?: number; stroke?: number; caption?: string; grad?: string }) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  return (
    <div className="ring" data-value={percent} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-bg" cx={c} cy={c} r={r} strokeWidth={stroke}></circle>
        <circle className="ring-fg" cx={c} cy={c} r={r} strokeWidth={stroke} style={{ stroke: `url(#${grad})` }}></circle>
      </svg>
      <span className="ring__label">
        <b data-count={percent} data-suffix="%">0%</b>
        <span>{caption}</span>
      </span>
    </div>
  );
}

export function ProgressBar({ percent, tone = '', className = '' }: { percent: number; tone?: string; className?: string }) {
  return (
    <div className={`bar ${className}`.trim()}>
      <div className={`bar__fill ${tone}`.trim()} data-value={percent}></div>
    </div>
  );
}

export function StatCard({ icon, value, label, tone = '', foot, count = true }:
  { icon: string; value: number | string; label: string; tone?: string; foot?: ReactNode; count?: boolean }) {
  const isNum = typeof value === 'number' || /^-?\d+(\.\d+)?%?$/.test(String(value));
  const val = count && isNum
    ? <span data-count={parseInt(String(value), 10)} data-suffix={String(value).includes('%') ? '%' : ''}>0</span>
    : String(value);
  return (
    <article className="card card--hover stat reveal">
      <div className={`stat__icon ${tone}`.trim()}><Icon name={icon} /></div>
      <div className="stat__value">{val}</div>
      <div className="stat__label">{label}</div>
      {foot ? <div className="stat__delta" style={{ marginTop: 6 }}>{foot}</div> : null}
    </article>
  );
}

export function StatCardPercent({ icon, percent, label, tone = '', foot }:
  { icon: string; percent: number; label: string; tone?: string; foot?: ReactNode }) {
  const barTone = tone === 'teal' ? 'teal' : tone === 'rose' ? 'rose' : tone === 'amber' ? 'amber' : '';
  return (
    <article className="card card--hover stat reveal">
      <div className={`stat__icon ${tone}`.trim()}><Icon name={icon} /></div>
      <div className="stat__value"><span data-count={percent} data-suffix="%">0%</span></div>
      <div className="stat__label">{label}</div>
      <div style={{ marginTop: 12 }}><ProgressBar percent={percent} tone={barTone} className="bar-sm" /></div>
      {foot ? <div className="tiny dim" style={{ marginTop: 8 }}>{foot}</div> : null}
    </article>
  );
}

export interface SubjectLike {
  id: number; title: string; code?: string | null; credits: number; description?: string | null; color?: string;
}
export interface ProgLike { percent: number; total: number; completed: number }

/**
 * Topic card for one subject: what it is, what it covers, how demanding it
 * is, how long it takes, how far in you are, and what the next action is.
 */
export function SubjectCard({ subject, prog, href, extra = {} }:
  { subject: SubjectLike; prog: ProgLike; href: string; extra?: { minutes?: number; level?: string } }) {
  const pct = prog.percent, total = prog.total, done = prog.completed;
  const initial = [...subject.title][0]?.toUpperCase() ?? '';
  const dir = dirOf(subject.title);
  const minutes = extra.minutes ?? 0;
  const level = difficultyMeta(extra.level ?? 'core');

  let status: [string, string], cta: string;
  if (pct >= 100)  { status = ['Completed', 'badge-teal'];      cta = 'Review'; }
  else if (pct > 0) { status = ['In progress', 'badge-brand'];  cta = 'Continue'; }
  else              { status = ['Not started', 'badge-outline']; cta = 'Start'; }

  const desc = plainText(subject.description ?? '', 130);

  return (
    <Link className="topic reveal" href={href}>
      <div className="topic__head">
        <span className="topic__icon">{initial}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="topic__title" dir={dir} lang={dir === 'rtl' ? 'ps' : undefined}>{subject.title}</h3>
          <div className="topic__sub">{subject.code ? `${subject.code} · ` : ''}{subject.credits} credits</div>
        </div>
        <span className={`badge ${status[1]}`}>{status[0]}</span>
      </div>
      {desc !== '' ? <p className="topic__desc">{desc}</p> : null}
      <div className="topic__facts">
        <span className={`level ${level.class}`}>{level.label}</span>
        {minutes > 0 ? <span className="badge"><Icon name="clock" className="icon-sm" /> {duration(minutes)}</span> : null}
        <span className="badge"><Icon name="list" className="icon-sm" /> {total} lesson{total === 1 ? '' : 's'}</span>
      </div>
      <div>
        <ProgressBar percent={pct} tone={pct >= 100 ? 'teal' : ''} className="bar-sm" />
        <div className="row between" style={{ marginTop: 7 }}>
          <span className="topic__pct">{done} of {total} complete</span>
          <span className="topic__pct">{pct}%</span>
        </div>
      </div>
      <div className="topic__foot">
        <span className="btn btn-soft btn-sm">{cta} <Icon name="arrow-right" className="icon-sm" /></span>
      </div>
    </Link>
  );
}

export interface LessonLike {
  id: number; title: string; difficulty?: string | null; duration_minutes: number;
  video_type?: string | null; recommended_day: number; is_required?: boolean | null;
}

/** One row in an ordered lesson sequence. */
export function LessonItem({ lesson, status, href, index, isNext = false }:
  { lesson: LessonLike; status: string; href: string; index: number; isNext?: boolean }) {
  const meta = statusMeta(status);
  const cls = meta.class + (isNext ? ' is-current' : '');
  const mark = status === 'completed'
    ? <Icon name="check" className="icon-sm" />
    : (isNext || status === 'in_progress' ? <Icon name="play" className="icon-sm" /> : String(index));
  const lvl = difficultyMeta(lesson.difficulty ?? 'core');
  const dir = dirOf(lesson.title);

  const bits: ReactNode[] = [
    <span key="lvl" className={`level ${lvl.class}`}>{lvl.label}</span>,
  ];
  if (lesson.duration_minutes > 0) bits.push(<span key="dur"><Icon name="clock" className="icon-sm" /> {duration(lesson.duration_minutes)}</span>);
  if ((lesson.video_type ?? 'none') !== 'none') bits.push(<span key="vid"><Icon name="video" className="icon-sm" /> Video</span>);
  bits.push(<span key="day"><Icon name="calendar" className="icon-sm" /> Day {lesson.recommended_day}</span>);
  if (lesson.is_required === false) bits.push(<span key="opt" className="badge">Optional</span>);

  return (
    <Link className={`lesson-item ${cls}`} dir={dir} lang={dir === 'rtl' ? 'ps' : undefined} href={href}>
      <span className="lesson-item__num">{mark}</span>
      <span className="lesson-item__body">
        <span className="lesson-item__title" dir={dir}>{lesson.title}</span>
        <span className="lesson-item__meta">
          {bits.map((b, i) => <span key={i} className="row" style={{ gap: 4 }}>{b}</span>)}
        </span>
      </span>
      <span className={`badge ${status === 'completed' ? 'badge-teal' : status === 'in_progress' ? 'badge-brand' : ''} hide-sm`}>{meta.label}</span>
      <Icon name="chevron-right" className="icon-sm" />
    </Link>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon name={icon} className="icon-lg" /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  );
}

export function AlertBox({ type, children, style }: { type: 'success' | 'error' | 'warning' | 'info'; children: ReactNode; style?: React.CSSProperties }) {
  const icons = { success: 'check-circle', error: 'alert', warning: 'alert', info: 'info' };
  return (
    <div className={`alert alert-${type}`} style={style}>
      <Icon name={icons[type]} />
      <div>{children}</div>
    </div>
  );
}

export function Avatar({ user, size = '' }: { user: { full_name: string; avatar?: string | null }; size?: '' | 'avatar-sm' | 'avatar-lg' }) {
  return (
    <span className={`avatar ${size}`.trim()}>
      {user.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={uploadUrl('avatars/' + user.avatar)} alt="" />
        : initials(user.full_name)}
    </span>
  );
}

/** Text with server-resolved direction (dirAttr() in the PHP portal). */
export function Dir({ text, as: Tag = 'span', className = '', children, ...rest }:
  { text: string | null | undefined; as?: 'span' | 'p' | 'b' | 'h1' | 'h2' | 'h3' | 'div'; className?: string; children?: ReactNode; [k: string]: unknown }) {
  const dir = dirOf(text);
  const cls = ((dir === 'rtl' ? 'rtl-text ' : '') + className).trim();
  return <Tag dir={dir} lang={dir === 'rtl' ? 'ps' : undefined} className={cls || undefined} {...rest}>{children ?? text}</Tag>;
}
