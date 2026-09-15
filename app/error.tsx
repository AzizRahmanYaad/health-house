'use client';
/** Friendly global error page instead of Next.js' bare "Application error". */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ font: '16px/1.6 system-ui, Segoe UI, sans-serif', maxWidth: 640, margin: '80px auto', padding: '0 20px', color: '#1B2330' }}>
      <h1 style={{ fontSize: 22 }}>Something went wrong on the server</h1>
      <p>The page could not be rendered. On a fresh deployment this usually means the database is not
        configured yet or its tables have not been created.</p>
      <p>Open <a href="/api/health"><code>/api/health</code></a> to see what is missing, or
        <a href="/api/setup"> <code>/api/setup</code></a> to install the database.</p>
      {error.digest ? <p style={{ color: '#6B7280', fontSize: 13 }}>Reference: {error.digest}</p> : null}
      <button onClick={() => reset()} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #D5DBE3', background: '#fff', cursor: 'pointer' }}>Try again</button>
    </div>
  );
}
