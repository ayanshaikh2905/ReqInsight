/** Segmented control with a sliding thumb. Options: [{ value, label, count? }] */
export function Segmented({ options, value, onChange, label, className = '' }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative inline-grid rounded-lg border border-line bg-surface p-0.5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 rounded-md bg-raised shadow-sm ring-1 ring-line transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${
              active ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
            {o.count != null && <span className="font-mono text-[11px] tabular-nums text-faint">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
