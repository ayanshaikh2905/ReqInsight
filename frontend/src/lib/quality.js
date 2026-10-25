// Score bands mirror the backend's quality_distribution buckets.
export const BANDS = [
  { key: 'excellent', label: 'Excellent', range: '90–100', min: 90, tone: 'ok' },
  { key: 'good', label: 'Good', range: '75–89', min: 75, tone: 'info' },
  { key: 'moderate', label: 'Moderate', range: '60–74', min: 60, tone: 'warn' },
  { key: 'poor', label: 'Needs work', range: 'below 60', min: -Infinity, tone: 'bad' },
];

export const bandFor = (score) => BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1];

// Full class names so Tailwind can see them at build time.
export const TONE = {
  ok: { text: 'text-ok', bg: 'bg-ok', soft: 'bg-ok/15 text-ok border-ok/30', ring: 'ring-ok/40' },
  info: { text: 'text-info', bg: 'bg-info', soft: 'bg-info/15 text-info border-info/30', ring: 'ring-info/40' },
  warn: { text: 'text-warn', bg: 'bg-warn', soft: 'bg-warn/15 text-warn border-warn/30', ring: 'ring-warn/40' },
  bad: { text: 'text-bad', bg: 'bg-bad', soft: 'bg-bad/15 text-bad border-bad/30', ring: 'ring-bad/40' },
  accent: { text: 'text-accent', bg: 'bg-accent', soft: 'bg-accent/15 text-accent border-accent/30', ring: 'ring-accent/40' },
  neutral: { text: 'text-muted', bg: 'bg-faint', soft: 'bg-raised text-muted border-line', ring: 'ring-line' },
};

export const toneForScore = (score) => bandFor(score).tone;

export const DIMENSIONS = ['clarity', 'completeness', 'specificity', 'consistency', 'testability', 'uniqueness'];

export const hasIssues = (r) =>
  r.is_ambiguous || r.is_incomplete || (r.potential_conflicts?.length ?? 0) > 0;
