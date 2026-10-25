import { Link } from 'react-router-dom';
import { AnimatedNumber } from './AnimatedNumber';

export function Card({ children, className = '', as: Tag = 'section', ...props }) {
  return (
    <Tag className={`rounded-xl border border-line bg-surface ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, aside, className = '' }) {
  return (
    <div className={`mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 ${className}`}>
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {aside && <div className="text-xs text-muted">{aside}</div>}
    </div>
  );
}

/** Plain number + label. Used in ruled strips instead of boxed cards. */
export function Stat({ label, value, suffix, hint, to, tone = 'text-ink', decimals = 0, delay = 0 }) {
  const body = (
    <>
      <div className={`font-display text-3xl font-semibold leading-none tracking-tight tabular-nums ${tone}`}>
        {typeof value === 'number' ? <AnimatedNumber value={value} decimals={decimals} delay={delay} /> : value}
        {suffix && <span className="ml-0.5 text-base font-medium text-faint">{suffix}</span>}
      </div>
      <div className="mt-2 text-xs text-muted">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </>
  );
  const base = 'block px-5 py-4';
  return to ? (
    <Link to={to} className={`${base} transition-colors hover:bg-raised`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

const STRIP_COLS = {
  3: 'sm:grid-cols-3 sm:[&>*:nth-child(n+4)]:border-t sm:[&>*:not(:nth-child(3n+1))]:border-l',
  4: 'sm:grid-cols-4 sm:[&>*:nth-child(n+5)]:border-t sm:[&>*:not(:nth-child(4n+1))]:border-l',
};

export function StatStrip({ children, cols = 4, className = '' }) {
  return (
    <div
      className={`grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface [&>*]:border-line max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:nth-child(even)]:border-l ${STRIP_COLS[cols]} ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-20 text-center ${className}`}
    >
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 'md', className = '' }) {
  const sz = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70 ${sz} ${className}`}
    />
  );
}

export function InlineError({ children, onRetry, className = '' }) {
  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-4 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad ${className}`}
    >
      <span>{children}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2 hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}
