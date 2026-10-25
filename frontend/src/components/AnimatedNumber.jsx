import { useCountUp } from '../hooks/useCountUp';

export function AnimatedNumber({ value, decimals = 0, duration = 1000, delay = 0, className = '' }) {
  const shown = useCountUp(value, { duration, delay });
  const format = (n) => n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <>
      <span aria-hidden="true" className={`tabular-nums ${className}`}>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
