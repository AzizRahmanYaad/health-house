/** SVG icon sprite reference — the icon() helper of the PHP portal. */
export default function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={`icon ${className}`.trim()} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
