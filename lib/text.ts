/**
 * Pure text / view helpers — usable from both server and client code.
 * Mirrors the VIEW UTILITIES + TEXT DIRECTION sections of config/functions.php.
 */
import { APP_TIMEZONE } from './config';

/** Plain-text version of rich content, for lists and meta lines. */
export function plainText(html: string | null | undefined, limit = 0): string {
  let t = String(html ?? '').replace(/<[^>]*>/g, '');
  t = decodeEntities(t).trim().replace(/\s+/g, ' ');
  if (limit > 0 && [...t].length > limit) {
    t = [...t].slice(0, limit).join('') + '…';
  }
  return t;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** True when the text is predominantly right-to-left script. */
export function isRtlText(text: string | null | undefined): boolean {
  const t = plainText(text);
  if (t === '') return false;
  const rtl = t.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿֐-׿]/g)?.length ?? 0;
  const ltr = t.match(/[A-Za-z]/g)?.length ?? 0;
  if (rtl === 0) return false;
  // Pashto/Dari text routinely embeds English medical terms, so a meaningful
  // share of RTL letters (not an outright majority) is enough to read RTL.
  return rtl / Math.max(1, rtl + ltr) >= 0.2;
}

export type Dir = 'rtl' | 'ltr';

/** Just the direction word. */
export function dirOf(text: string | null | undefined): Dir {
  return isRtlText(text) ? 'rtl' : 'ltr';
}

/**
 * Direction props for a piece of user content (dir / lang / class), resolved
 * on the server so CSS can pick the right font and mirror the layout.
 */
export function dirProps(text: string | null | undefined, extraClass = ''): { dir: Dir; lang?: string; className?: string } {
  const rtl = isRtlText(text);
  const cls = ((rtl ? 'rtl-text ' : '') + extraClass).trim();
  return { dir: rtl ? 'rtl' : 'ltr', ...(rtl ? { lang: 'ps' } : {}), ...(cls ? { className: cls } : {}) };
}

/** Resolve a lesson's reading direction: explicit setting, else auto-detect. */
export function lessonDirection(lesson: { direction?: string | null; title?: string | null; description?: string | null; content?: string | null }): Dir {
  const d = lesson.direction ?? 'auto';
  if (d === 'rtl' || d === 'ltr') return d;
  return isRtlText(`${lesson.title ?? ''} ${lesson.description ?? ''} ${lesson.content ?? ''}`) ? 'rtl' : 'ltr';
}

export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const out = parts.slice(0, 2).map(p => [...p][0].toUpperCase()).join('');
  return out || 'U';
}

export function duration(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function humanSize(bytes: number): string {
  if (bytes <= 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = Math.floor(Math.log(bytes) / Math.log(1024));
  i = Math.min(i, u.length - 1);
  const v = bytes / Math.pow(1024, i);
  return (i ? v.toFixed(1) : Math.round(v).toString()) + ' ' + u[i];
}

export interface StatusMeta { label: string; class: string; icon: string }
export function statusMeta(status: string): StatusMeta {
  switch (status) {
    case 'completed':   return { label: 'Completed',   class: 'is-done',    icon: 'check' };
    case 'in_progress': return { label: 'In Progress', class: 'is-current', icon: 'play' };
    default:            return { label: 'Not Started', class: 'is-todo',    icon: 'circle' };
  }
}

export interface DifficultyMeta { label: string; class: string }
/**
 * Label and CSS class for a lesson's difficulty. "Introductory" opens a
 * subject, "Advanced" closes it. Anything unrecognised reads as Core.
 */
export function difficultyMeta(level: string | null | undefined): DifficultyMeta {
  switch (level) {
    case 'intro':    return { label: 'Introductory', class: 'level--intro' };
    case 'advanced': return { label: 'Advanced',     class: 'level--advanced' };
    default:         return { label: 'Core',         class: 'level--core' };
  }
}

export function dayName(dow: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow] ?? '—';
}
export function dayShort(dow: number): string {
  return dayName(dow).slice(0, 3);
}

/** Strip a leading "Semester N — " from a semester title. */
export function semesterShortTitle(title: string): string {
  return title.replace(/^Semester \d+\s*[—-]\s*/u, '');
}

/* ------------------------------ dates ------------------------------ */

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parts of a date in the application timezone (month as PHP's "M": Jan … Dec). */
function parts(d: Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE, year: 'numeric', month: 'numeric', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long',
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  p.month = MONTHS[parseInt(p.month, 10) - 1] ?? p.month;
  if (p.hour === '24') p.hour = '00';
  return p;
}

/** "14 Sep 2026" */
export function fmtDate(v: Date | string | null | undefined): string {
  const d = toDate(v); if (!d) return '—';
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}`;
}
/** "14 Sep 2026, 08:52" */
export function fmtDateTime(v: Date | string | null | undefined): string {
  const d = toDate(v); if (!d) return '—';
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}
/** "9 Sep 2026" (no leading zero) */
export function fmtDateShort(v: Date | string | null | undefined): string {
  const d = toDate(v); if (!d) return '—';
  const p = parts(d);
  return `${parseInt(p.day, 10)} ${p.month} ${p.year}`;
}
/** "Tuesday, 15 September 2026" */
export function fmtLongDate(v: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(v);
}
/** "15 September 2026" */
export function fmtDayMonthYear(v: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(v);
}
/** Day of week (0 = Sunday) in the application timezone. */
export function todayDow(v: Date = new Date()): number {
  const w = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(v);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
}
/** Current year in the application timezone. */
export function currentYear(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, year: 'numeric' }).format(new Date());
}
/** "08:00" from a TIME column value ("08:00:00"). */
export function fmtTime(t: string | null | undefined): string {
  return String(t ?? '').slice(0, 5);
}

export function timeAgo(v: Date | string | null | undefined): string {
  const d = toDate(v); if (!d) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400)  return Math.floor(diff / 3600) + ' h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' d ago';
  return fmtDate(d);
}

/** MySQL's number_format(x, 2) with trailing zeros trimmed, e.g. 7.5 / 10 */
export function trimNumber(v: number): string {
  return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function ucfirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
