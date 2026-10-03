export function Badge({ variant = 'default', children, className = '' }) {
  const variants = {
    default: 'bg-slate-700 text-slate-300',
    functional: 'bg-emerald-900/60 text-emerald-400 border border-emerald-800',
    nonfunctional: 'bg-purple-900/60 text-purple-400 border border-purple-800',
    danger: 'bg-red-900/60 text-red-400 border border-red-800',
    warning: 'bg-amber-900/60 text-amber-400 border border-amber-800',
    info: 'bg-sky-900/60 text-sky-400 border border-sky-800',
    success: 'bg-emerald-900/60 text-emerald-400 border border-emerald-800',
    indigo: 'bg-indigo-900/60 text-indigo-400 border border-indigo-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}

export function ScoreBadge({ score }) {
  const color = score >= 85 ? 'text-emerald-400' : score >= 65 ? 'text-amber-400' : 'text-red-400';
  return <span className={`font-bold text-sm ${color}`}>{score}/100</span>;
}

export function TypeBadge({ type }) {
  return (
    <Badge variant={type === 'Functional' ? 'functional' : 'nonfunctional'}>
      {type === 'Functional' ? '⚡ F' : '🔧 NF'}
    </Badge>
  );
}
