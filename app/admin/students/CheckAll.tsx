'use client';

/** The "select every row" checkbox of the students table. */
export default function CheckAll() {
  return (
    <input type="checkbox" id="check-all" style={{ accentColor: 'var(--brand)', width: 17, height: 17 }}
           onChange={e => {
             document.querySelectorAll<HTMLInputElement>('.row-check').forEach(c => { c.checked = e.currentTarget.checked; });
           }} />
  );
}
