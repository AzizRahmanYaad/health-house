'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Sidebar link that knows whether it is the current page. */
export default function NavLink({ href, match, className = 'nav-link', children }:
  { href: string; match?: string[]; className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const patterns = match ?? [href];
  const active = patterns.some(p => pathname === p || pathname.startsWith(p + '/'));
  return <Link className={className + (active ? ' active' : '')} href={href}>{children}</Link>;
}
