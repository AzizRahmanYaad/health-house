import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { Suspense } from 'react';
import IconSprite from '@/components/IconSprite';
import PageBoot from '@/components/PageBoot';
import { APP_NAME, APP_SHORT } from '@/lib/config';
import { peekFlashes } from '@/lib/session';

import '@/styles/app.css';
import '@/styles/rich.css';
import '@/styles/subtitles.css';
import '@/styles/lessonlist.css';
import '@/styles/shell.css';
import '@/styles/reader.css';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_SHORT}` },
  description: 'Health House — a structured, semester-wise learning platform for the six-semester midwifery programme.',
  icons: {
    /* The brand mark: a heart carrying a heartbeat. */
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%23D34E4E'/><g fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M12 19s-5.6-3.6-7.3-7A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7.3 3.8C17.6 15.4 12 19 12 19Z'/><path d='M8.6 12.9h1.7l.8-1.7 1.3 3.2.9-1.5h1.8'/></g></svg>",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#D34E4E',
};

/* Apply the saved theme + sidebar state before first paint to avoid a flash. */
const bootScript = `(function(){try{var t=localStorage.getItem('midwifery-theme');
if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
document.documentElement.setAttribute('data-theme',t);
if(localStorage.getItem('midwifery-sidebar')==='collapsed'){document.documentElement.setAttribute('data-sidebar','collapsed');}
if(localStorage.getItem('midwifery-focus')==='1'){document.documentElement.setAttribute('data-focus','1');}
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const flashes = await peekFlashes();

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;550;600;650;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <style>{`html[data-theme="light"] .only-dark { display: none; } html[data-theme="dark"] .only-light { display: none; }`}</style>
      </head>
      <body>
        <IconSprite />

        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#7C5CFF" />
              <stop offset="55%"  stopColor="#6C4CF1" />
              <stop offset="100%" stopColor="#E8557E" />
            </linearGradient>
            <linearGradient id="ringGradTeal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#2ED3B7" />
              <stop offset="100%" stopColor="#12B5A6" />
            </linearGradient>
          </defs>
        </svg>

        {flashes.length ? (
          <script type="application/json" id="flash-data" dangerouslySetInnerHTML={{ __html: JSON.stringify(flashes).replace(/</g, '\\u003c') }} />
        ) : null}

        {children}

        <Suspense fallback={null}><PageBoot /></Suspense>

        <Script src="/js/hh-app.js" strategy="afterInteractive" />
        <Script src="/js/hh-reader.js" strategy="afterInteractive" />
        <Script src="/js/hh-editor.js" strategy="afterInteractive" />
        <Script src="/js/hh-uploader.js" strategy="afterInteractive" />
        <Script src="/js/hh-subtitles.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
