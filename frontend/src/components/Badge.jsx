import { TONE, toneForScore } from '../lib/quality';

// Older call sites used descriptive variant names; map them onto semantic tones.
const ALIASES = {
  default: 'neutral',
  functional: 'ok',
  nonfunctional: 'info',
  danger: 'bad',
  warning: 'warn',
  amber: 'warn',
  success: 'ok',
  indigo: 'accent',
};

export function Badge({ variant = 'neutral', children, className = '', title }) {
  const tone = TONE[ALIASES[variant] || variant] || TONE.neutral;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium leading-4 ${tone.soft} ${className}`}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score, className = '' }) {
  const tone = TONE[toneForScore(score)];
  return (
    <span className={`font-mono text-xs tabular-nums ${className}`} title={`Quality score ${score} out of 100`}>
      <span className={`font-medium ${tone.text}`}>{score}</span>
      <span className="text-faint">/100</span>
    </span>
  );
}

export function TypeBadge({ type, category }) {
  const functional = type === 'Functional';
  return (
    <Badge variant={functional ? 'ok' : 'info'} title={category ? `${type}: ${category}` : type}>
      {functional ? 'FR' : 'NFR'}
    </Badge>
  );
}
