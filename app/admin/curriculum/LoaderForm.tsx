'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import Icon from '@/components/Icon';
import { AlertBox } from '@/components/ui';
import { runLoader, type LoaderState } from './actions';

export default function LoaderForm({ ready, hasVideos }: { ready: boolean; hasVideos: boolean }) {
  const [state, action, pending] = useActionState<LoaderState, FormData>(runLoader, { log: null, error: null });

  return (
    <>
      {state.error ? <AlertBox type="error">{state.error}</AlertBox> : null}

      <form action={action} style={{ marginTop: 18 }}
            onSubmit={e => { if (!window.confirm('Rebuild Semester 1? The current Semester 1 subjects, lessons and any progress recorded against them will be replaced.')) e.preventDefault(); }}>
        <input type="hidden" name="task" value="curriculum" />
        <button className="btn btn-primary btn-lg" type="submit" disabled={!ready || pending}>
          <Icon name="refresh" /> {pending ? 'Loading…' : 'Load the Semester 1 curriculum'}
        </button>
        {!ready ? <div className="hint">Some source files are missing — see the panel on the right.</div> : null}
      </form>

      <form action={action} style={{ marginTop: 12 }}>
        <input type="hidden" name="task" value="subtitles" />
        <button className="btn btn-ghost" type="submit" disabled={!hasVideos || pending}>
          <Icon name="message" className="icon-sm" /> Generate Pashto subtitle tracks
        </button>
        <div className="hint">Builds a synchronised Pashto study track for every Semester 1 lesson with a video (not a word-for-word translation).</div>
      </form>

      {state.log !== null ? (
        <section className="card card--pad-lg" style={{ marginTop: 20 }}>
          <div className="card__head"><h3 className="card__title">What the loader did</h3></div>
          <pre style={{ margin: 0, padding: 16, background: 'var(--surface-2)', border: '1px solid var(--line)',
                        borderRadius: 'var(--r-md)', overflowX: 'auto', fontSize: '.82rem', lineHeight: 1.7 }}>{state.log}</pre>
          <div className="row" style={{ marginTop: 16 }}>
            <Link className="btn btn-ghost btn-sm" href="/admin/lessons"><Icon name="list" className="icon-sm" /> Review the lessons</Link>
            <Link className="btn btn-ghost btn-sm" href="/admin/subjects"><Icon name="book" className="icon-sm" /> Review the subjects</Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
