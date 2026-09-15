'use client';
/** Keeps the lesson dropdown in step with the chosen subject. */
import { useEffect } from 'react';

export default function LessonFilter() {
  useEffect(() => {
    const sub = document.getElementById('subject_id') as HTMLSelectElement | null;
    const les = document.getElementById('lesson_id') as HTMLSelectElement | null;
    if (!sub || !les) return;
    const opts = Array.from(les.options);
    const sync = () => {
      const sid = sub.value;
      opts.forEach(o => { if (o.value) o.hidden = o.dataset.subject !== sid; });
      if (les.selectedOptions[0] && les.selectedOptions[0].hidden) les.value = '';
    };
    sub.addEventListener('change', sync);
    sync();
    return () => sub.removeEventListener('change', sync);
  }, []);
  return null;
}
