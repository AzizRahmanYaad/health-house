'use client';
/**
 * The small page-level behaviours of the lesson editor (ported from the
 * inline script of admin/lesson_edit.php): video source switcher, live
 * link preview, material type switcher, and the "still uploading" guard.
 */
import { useEffect } from 'react';

function detect(u: string) {
  u = (u || '').trim();
  if (!u) return null;
  let m: RegExpMatchArray | null;
  if ((m = u.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i)))
    return { name: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0', frame: true };
  if ((m = u.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d{6,})/i)))
    return { name: 'Vimeo', src: 'https://player.vimeo.com/video/' + m[1], frame: true };
  if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{10,})/i)))
    return { name: 'Google Drive', src: 'https://drive.google.com/file/d/' + m[1] + '/preview', frame: true };
  if ((m = u.match(/dailymotion\.com\/(?:video\/|embed\/video\/)([A-Za-z0-9]+)/i)))
    return { name: 'Dailymotion', src: 'https://geo.dailymotion.com/player.html?video=' + m[1], frame: true };
  if (/\.(mp4|m4v|webm|ogv|ogg|mov)(\?|$)/i.test(u))
    return { name: 'Direct video file', src: u, frame: false };
  return { name: null, src: u, frame: false };
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export default function LessonEditorScripts() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const on = (el: Element | null, ev: string, fn: EventListener) => {
      if (!el) return;
      el.addEventListener(ev, fn);
      cleanups.push(() => el.removeEventListener(ev, fn));
    };

    /* ---- video source switcher ---- */
    const src = document.getElementById('video_source') as HTMLSelectElement | null;
    const linkF = document.getElementById('video-link-field');
    const upF = document.getElementById('video-upload-field');
    const syncVideo = () => {
      if (!src) return;
      if (linkF) linkF.hidden = src.value !== 'link';
      if (upF) upF.hidden = src.value !== 'file';
    };
    on(src, 'change', syncVideo);
    syncVideo();

    /* ---- live preview + provider detection for pasted links ---- */
    const url = document.getElementById('video_url') as HTMLInputElement | null;
    const prev = document.getElementById('link-preview');
    let t: ReturnType<typeof setTimeout> | undefined;
    const renderPreview = () => {
      if (!url || !prev) return;
      const d = detect(url.value);
      if (!d) { prev.innerHTML = ''; return; }
      if (!d.name) {
        prev.innerHTML = '<div class="alert alert-warning" style="margin:0">' +
          '<div>Not a recognised video host. Students will see this as a link they can open in a new tab. ' +
          'For an embedded player use YouTube, Vimeo, Google Drive or a direct .mp4 address.</div></div>';
        return;
      }
      prev.innerHTML =
        '<div class="row row-tight" style="margin-bottom:10px">' +
          '<span class="badge badge-teal">Detected: ' + esc(d.name) + '</span>' +
          '<span class="badge">Plays inside the portal</span></div>' +
        '<div class="player" style="aspect-ratio:16/9;border-radius:14px">' +
          (d.frame
            ? '<iframe src="' + esc(d.src) + '" allowfullscreen loading="lazy"></iframe>'
            : '<video controls preload="metadata" playsinline src="' + esc(d.src) + '"></video>') +
        '</div>';
    };
    on(url, 'input', () => { clearTimeout(t); t = setTimeout(renderPreview, 450); });
    if (url && url.value) renderPreview();

    /* ---- material type: file vs link, and the right upload folder ---- */
    const mt = document.getElementById('material_type') as HTMLSelectElement | null;
    const syncM = () => {
      if (!mt) return;
      const mFile = document.getElementById('material-file-field');
      const mUrl = document.getElementById('material-url-field');
      const mBox = document.getElementById('material-uploader');
      const mFold = document.getElementById('material_folder') as HTMLInputElement | null;
      const FOLDER: Record<string, string> = { pdf: 'pdfs', slides: 'slides', document: 'resources', audio: 'resources', other: 'resources' };
      const isLink = mt.value === 'link';
      if (mFile) mFile.hidden = isLink;
      if (mUrl) mUrl.hidden = !isLink;
      const folder = FOLDER[mt.value] || 'resources';
      if (mBox) mBox.dataset.kind = folder;
      if (mFold) mFold.value = folder;
    };
    on(mt, 'change', syncM);
    syncM();

    /* ---- warn if the admin saves while an upload is still running ---- */
    const form = document.getElementById('lesson-form');
    on(form, 'submit', (e) => {
      const st = document.querySelector('#video-upload-field .uploader__status');
      if (st && /Uploading/i.test(st.textContent || '')) {
        if (!window.confirm('The video is still uploading. Save anyway without it?')) { e.preventDefault(); e.stopImmediatePropagation(); }
      }
    });

    return () => { cleanups.forEach(fn => fn()); clearTimeout(t); };
  }, []);

  return null;
}
