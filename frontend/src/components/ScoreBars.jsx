import { DIMENSIONS, TONE, toneForScore } from '../lib/quality';

/** One animated bar per quality dimension (clarity, completeness, …). */
export function ScoreBars({ scores = {}, className = '' }) {
  const dims = DIMENSIONS.filter((d) => typeof scores[d] === 'number');
  if (!dims.length) return null;
  return (
    <div className={`grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 ${className}`}>
      {dims.map((d, i) => (
        <div key={d} className="flex items-center gap-3 text-xs">
          <span className="w-24 capitalize text-muted">{d}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70">
            <div
              className={`bar-run h-full rounded-full ${TONE[toneForScore(scores[d])].bg}`}
              style={{ width: `${scores[d]}%`, animationDelay: `${150 + i * 60}ms` }}
            />
          </div>
          <span className="w-7 text-right font-mono tabular-nums text-muted">{scores[d]}</span>
        </div>
      ))}
    </div>
  );
}
