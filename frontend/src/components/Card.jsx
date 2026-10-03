export function Card({ children, className = '' }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, color = 'indigo', sub }) {
  const colors = {
    indigo: { bg: 'bg-indigo-900/40', icon: 'text-indigo-400', border: 'border-indigo-800/40' },
    emerald: { bg: 'bg-emerald-900/40', icon: 'text-emerald-400', border: 'border-emerald-800/40' },
    purple: { bg: 'bg-purple-900/40', icon: 'text-purple-400', border: 'border-purple-800/40' },
    amber: { bg: 'bg-amber-900/40', icon: 'text-amber-400', border: 'border-amber-800/40' },
    red: { bg: 'bg-red-900/40', icon: 'text-red-400', border: 'border-red-800/40' },
    sky: { bg: 'bg-sky-900/40', icon: 'text-sky-400', border: 'border-sky-800/40' },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-400 font-medium mt-0.5 truncate">{label}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-300 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-6">{description}</p>
      {action}
    </div>
  );
}

export function Spinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <div className={`${sz} border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin`} />
  );
}
