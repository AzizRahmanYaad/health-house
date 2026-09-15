'use client';
import { useState } from 'react';

/** The accent-colour swatches of the subject form (radio inputs, hidden). */
export default function ColorPicker({ palette, value }: { palette: string[]; value: string }) {
  const [color, setColor] = useState(value);
  return (
    <div className="row row-tight" style={{ gap: 7 }}>
      {palette.map(c => (
        <label key={c} style={{ cursor: 'pointer' }}>
          <input type="radio" name="color" value={c} hidden checked={color === c} onChange={() => setColor(c)} />
          <span style={{ display: 'block', width: 30, height: 30, borderRadius: 10, background: c,
                         boxShadow: color === c ? '0 0 0 3px var(--brand)' : '0 0 0 1px var(--line)' }}></span>
        </label>
      ))}
    </div>
  );
}
