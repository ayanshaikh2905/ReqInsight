import { useEffect, useState } from 'react';
import { TONE } from '../lib/quality';

/** Circular gauge that draws itself in. `value` is 0–100. */
export function Ring({ value, size = 56, stroke = 5, tone = 'accent', label, className = '' }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={drawn ? c * (1 - pct) : c}
          className={TONE[tone].text}
          style={{ transition: 'stroke-dashoffset 1000ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {label != null && (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-medium tabular-nums text-ink">
          {label}
        </span>
      )}
    </div>
  );
}
