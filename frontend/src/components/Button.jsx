import { Link } from 'react-router-dom';
import { Spinner } from './Card';

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:brightness-110 disabled:hover:brightness-100',
  secondary: 'border border-line bg-raised text-ink hover:border-faint',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
  danger: 'border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20',
};

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-sm',
};

function classes({ variant, size, className }) {
  return `inline-flex select-none items-center justify-center rounded-lg font-medium transition-[filter,background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export function Button({ variant = 'secondary', size = 'md', loading = false, disabled, className = '', children, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'secondary', size = 'md', className = '', children, ...props }) {
  return (
    <Link to={to} className={classes({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
