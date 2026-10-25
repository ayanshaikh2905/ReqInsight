import { Check } from 'lucide-react';

const STAGES = [
  'Reading the document',
  'Extracting and classifying requirements',
  'Checking ambiguity, completeness and smells',
  'Comparing requirements for duplicates and conflicts',
  'Clustering topics',
  'Scoring quality',
];

const LINES = [92, 100, 78, 96, 64, 88, 100, 72, 90, 54];
const SCAN_SECONDS = 3;

/** A document being scanned, beside the pipeline stages it is moving through. */
export function AnalysisProgress({ progress = 0, title = 'Analyzing your document' }) {
  const stageSpan = 92 / STAGES.length;
  const activeIndex = progress >= 100 ? STAGES.length : Math.min(STAGES.length - 1, Math.floor(progress / stageSpan));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 py-16 sm:flex-row sm:items-center sm:gap-14">
      <div
        className="relative h-56 w-44 shrink-0 overflow-hidden rounded-lg border border-line bg-surface p-4"
        style={{ '--scan-distance': '212px' }}
        aria-hidden="true"
      >
        <div className="space-y-3">
          {LINES.map((w, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-line"
              style={{
                width: `${w}%`,
                animation: `line-lit ${SCAN_SECONDS}s linear infinite`,
                animationDelay: `${(i / LINES.length) * SCAN_SECONDS - 0.2}s`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-x-0 top-3 h-px bg-accent shadow-[0_0_14px_2px_rgb(var(--c-accent)/0.6)]"
          style={{ animation: `scan ${SCAN_SECONDS}s linear infinite` }}
        />
      </div>

      <div className="w-full max-w-sm">
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">This usually takes a few seconds.</p>
        <ol className="mt-6 space-y-3">
          {STAGES.map((label, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                    done ? 'border-ok bg-ok text-canvas' : active ? 'stage-active border-accent bg-accent/20' : 'border-line'
                  }`}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </span>
                <span className={`transition-colors duration-300 ${done ? 'text-muted' : active ? 'text-ink' : 'text-faint'}`}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <div
          className="mt-6 h-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Analysis progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
