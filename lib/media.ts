/**
 * MEDIA HELPERS — work out how to play any pasted address.
 * Mirrors the MEDIA HELPERS section of config/functions.php.
 */

export function youtubeId(url: string): string | null {
  // watch?v= | youtu.be/ | /embed/ | /shorts/ | /live/ | /v/
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  return m ? m[1] : null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d{6,})/i);
  return m ? m[1] : null;
}

export function driveId(url: string): string | null {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{10,})/i);
  return m ? m[1] : null;
}

export function dailymotionId(url: string): string | null {
  const m = url.match(/dailymotion\.com\/(?:video\/|embed\/video\/)([A-Za-z0-9]+)/i);
  return m ? m[1] : null;
}

/** True when the address points straight at a playable media file. */
export function isDirectVideoUrl(url: string): boolean {
  let p = url;
  try { p = new URL(url).pathname; } catch { /* keep as-is */ }
  return /\.(mp4|m4v|webm|ogv|ogg|mov)$/i.test(p);
}

export type VideoKind = 'iframe' | 'video' | 'link' | 'none';
export interface VideoSource { kind: VideoKind; src: string; provider: string }

export function videoEmbed(url: string): VideoSource {
  url = (url || '').trim();
  if (url === '') return { kind: 'none', src: '', provider: '' };
  let id: string | null;
  if ((id = youtubeId(url)))     return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`, provider: 'YouTube' };
  if ((id = vimeoId(url)))       return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}`, provider: 'Vimeo' };
  if ((id = driveId(url)))       return { kind: 'iframe', src: `https://drive.google.com/file/d/${id}/preview`, provider: 'Google Drive' };
  if ((id = dailymotionId(url))) return { kind: 'iframe', src: `https://geo.dailymotion.com/player.html?video=${id}`, provider: 'Dailymotion' };
  if (isDirectVideoUrl(url))     return { kind: 'video', src: url, provider: 'Direct file' };
  // Unknown host: offer it as a link rather than silently showing nothing.
  return { kind: 'link', src: url, provider: 'External link' };
}

export function uploadUrl(relative: string | null | undefined): string {
  return relative ? '/uploads/' + relative.replace(/^\/+/, '') : '';
}

/** Returns how to play a lesson row's video. */
export function videoSource(lesson: { video_type?: string | null; video_url?: string | null; video_file?: string | null }): VideoSource {
  const type = lesson.video_type ?? 'none';
  // An uploaded file always wins - it is the most reliable source.
  if (type === 'file' || (lesson.video_file && !lesson.video_url)) {
    return lesson.video_file
      ? { kind: 'video', src: uploadUrl('videos/' + lesson.video_file), provider: 'Uploaded file' }
      : { kind: 'none', src: '', provider: '' };
  }
  if (type === 'none') return { kind: 'none', src: '', provider: '' };
  // youtube / vimeo / url are all just addresses - detect what they really are.
  return videoEmbed(String(lesson.video_url ?? ''));
}

/** Does this video kind support a native <track> element? */
export function supportsNativeTrack(kind: VideoKind): boolean {
  return kind === 'video';
}
