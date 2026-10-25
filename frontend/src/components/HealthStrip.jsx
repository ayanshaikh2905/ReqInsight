import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BANDS, TONE, bandFor } from '../lib/quality';

/**
 * "Spec skyline": one bar per requirement in document order. Height encodes
 * the quality score and colour encodes its band, so weak stretches of the
 * document are visible at a glance. Bars grow in left-to-right on mount.
 */
export function HealthStrip({ requirements }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(null);
  const current = active != null ? requirements[active] : null;

  return (
    <div>
      <div
        className="flex h-28 items-end gap-[3px] [&:has(button:hover)>button:not(:hover)]:opacity-40 [&:has(button:focus-visible)>button:not(:focus-visible)]:opacity-40"
        role="group"
        aria-label="Quality score of each requirement, in document order"
      >
        {requirements.map((r, i) => {
          const tone = TONE[bandFor(r.quality_score).tone];
          return (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => navigate(`/requirements?focus=${encodeURIComponent(r.id)}`)}
              aria-label={`${r.id}, quality ${r.quality_score} out of 100`}
              className={`bar-rise min-w-[3px] flex-1 rounded-t-[3px] transition-opacity duration-200 ${tone.bg}`}
              style={{
                height: `${Math.max(14, r.quality_score)}%`,
                animationDelay: `${Math.min(i * 22, 1100)}ms`,
              }}
            />
          );
        })}
      </div>

      <div className="mt-3 flex min-h-[2.75rem] flex-col justify-between gap-2 text-xs sm:flex-row sm:items-start">
        <div className="min-w-0 sm:max-w-[60%]" aria-live="polite">
          {current ? (
            <>
              <span className="font-mono text-ink">{current.id}</span>
              <span className="mx-2 text-faint">{current.quality_score}/100</span>
              <span className="line-clamp-2 text-muted">{current.text}</span>
            </>
          ) : (
            <span className="text-faint">Hover a bar to read the requirement. Click to open it.</span>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
          {BANDS.map((b) => (
            <li key={b.key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-sm ${TONE[b.tone].bg}`} aria-hidden="true" />
              {b.label} <span className="text-faint">{b.range}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Decorative placeholder shown before any document has been analysed. */
export function GhostSkyline({ bars = 36 }) {
  const heights = Array.from({ length: bars }, (_, i) => 28 + ((Math.sin(i * 1.7) + Math.sin(i * 0.63 + 1)) * 0.25 + 0.5) * 62);
  return (
    <div className="flex h-24 items-end gap-[3px]" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="ghost-bar min-w-[3px] flex-1 rounded-t-[3px] bg-faint"
          style={{ height: `${h}%`, animationDelay: `${(i % 12) * 140}ms` }}
        />
      ))}
    </div>
  );
}
