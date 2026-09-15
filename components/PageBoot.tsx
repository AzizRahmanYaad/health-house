'use client';
/**
 * Re-runs the vanilla interaction layer (public/js/hh-*.js) after every
 * client-side navigation. The scripts themselves run once on the first
 * full page load; this keeps them working when Next.js swaps the page
 * without reloading the document.
 */
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    HH?: {
      initApp?: () => void; initReader?: () => void; initEditor?: () => void;
      initUploader?: () => void; initSubs?: () => void;
    };
  }
}

export default function PageBoot() {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = pathname + '?' + search.toString();

  useEffect(() => {
    const hh = window.HH;
    if (!hh) return;                     // scripts not loaded yet: they self-initialise
    hh.initApp?.();
    hh.initReader?.();
    hh.initEditor?.();
    hh.initUploader?.();
    hh.initSubs?.();
  }, [key]);

  return null;
}
