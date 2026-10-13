import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History as HistoryIcon, GitCompare, Trash2, FolderOpen, ArrowRight, ArrowLeftRight,
  CheckCircle2, AlertTriangle, MinusCircle, Plus, Minus, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState, Spinner } from '../components/Card';
import { Badge, ScoreBadge } from '../components/Badge';
import { api } from '../api/client';

const METRICS = [
  { key: 'average_quality_score', label: 'Avg quality score' },
  { key: 'total_requirements', label: 'Requirements' },
  { key: 'ambiguous_count', label: 'Ambiguous' },
  { key: 'incomplete_count', label: 'Incomplete' },
  { key: 'duplicate_pairs_count', label: 'Duplicate pairs' },
  { key: 'conflict_pairs_count', label: 'Conflict pairs' },
];

const DIRECTION_STYLE = {
  better: 'text-emerald-400',
  worse: 'text-red-400',
  same: 'text-slate-500',
  neutral: 'text-sky-400',
};

const VERDICT = {
  improved: { icon: CheckCircle2, text: 'Specification improved', cls: 'border-emerald-800 bg-emerald-950/40 text-emerald-300' },
  regressed: { icon: AlertTriangle, text: 'Specification regressed', cls: 'border-red-800 bg-red-950/40 text-red-300' },
  unchanged: { icon: MinusCircle, text: 'No meaningful change', cls: 'border-slate-700 bg-slate-900 text-slate-300' },
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function signed(n) {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

function Section({ title, count, tone = 'slate', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const toneCls = {
    slate: 'text-slate-300', emerald: 'text-emerald-300', amber: 'text-amber-300', red: 'text-red-300',
  }[tone];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50"
      >
        <span className={`text-sm font-semibold ${toneCls}`}>{title}</span>
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {count}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>
      {open && <div className="border-t border-slate-800">{children}</div>}
    </div>
  );
}

function IssueChips({ resolved = [], introduced = [] }) {
  if (!resolved.length && !introduced.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {resolved.map(i => <Badge key={`r-${i}`} variant="success">✓ {i}</Badge>)}
      {introduced.map(i => <Badge key={`n-${i}`} variant="warning">+ {i}</Badge>)}
    </div>
  );
}

function ComparisonView({ diff, onSwap }) {
  const verdict = VERDICT[diff.verdict] || VERDICT.unchanged;
  const VerdictIcon = verdict.icon;
  const reqs = diff.requirements;
  const { resolved: conflictsResolved, introduced: conflictsIntroduced } = diff.conflicts;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${verdict.cls}`}>
        <VerdictIcon className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{verdict.text}</div>
          <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="truncate max-w-[16rem]">{diff.base.document_name}</span>
            <span className="text-slate-600">({formatDate(diff.base.created_at)})</span>
            <ArrowRight className="w-3 h-3" />
            <span className="truncate max-w-[16rem]">{diff.target.document_name}</span>
            <span className="text-slate-600">({formatDate(diff.target.created_at)})</span>
          </div>
        </div>
        <button
          onClick={onSwap}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Swap
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {METRICS.map(({ key, label }) => {
          const m = diff.summary_delta[key];
          if (!m) return null;
          return (
            <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400">{label}</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm text-slate-500">{m.before}</span>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span className="text-lg font-bold text-white">{m.after}</span>
                <span className={`text-xs font-semibold ml-auto ${DIRECTION_STYLE[m.direction]}`}>
                  {m.delta === 0 ? '±0' : signed(m.delta)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        {[
          ['Issues resolved', diff.issues.resolved, 'text-emerald-400'],
          ['Issues introduced', diff.issues.introduced, 'text-amber-400'],
          ['Requirements improved', reqs.improved, 'text-emerald-400'],
          ['Requirements regressed', reqs.regressed, 'text-red-400'],
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className={`text-2xl font-bold ${cls}`}>{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <Section
        title="Changed requirements"
        count={`${reqs.changed.length} changed · ${reqs.unchanged} unchanged`}
      >
        {reqs.changed.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">No matched requirement changed.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {reqs.changed.map(c => (
              <li key={`${c.base_id}-${c.target_id}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    {c.base_id === c.target_id ? c.target_id : `${c.base_id} → ${c.target_id}`}
                  </span>
                  {c.text_changed && <Badge variant="info">reworded</Badge>}
                  <span className="ml-auto flex items-center gap-1.5 text-xs">
                    <ScoreBadge score={c.base_score} />
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <ScoreBadge score={c.target_score} />
                    <span className={`font-semibold w-8 text-right ${c.score_delta > 0 ? 'text-emerald-400' : c.score_delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {signed(c.score_delta)}
                    </span>
                  </span>
                </div>
                {c.text_changed ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-slate-500 line-through decoration-slate-600">{c.base_text}</p>
                    <p className="text-slate-200">{c.target_text}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-300">{c.target_text}</p>
                )}
                <IssueChips resolved={c.resolved_issues} introduced={c.new_issues} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {reqs.added.length > 0 && (
        <Section title="Added requirements" count={reqs.added.length} tone="emerald" defaultOpen={false}>
          <ul className="divide-y divide-slate-800">
            {reqs.added.map(r => (
              <li key={`a-${r.id}`} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-indigo-400">{r.id}</span>
                  <span className="ml-auto"><ScoreBadge score={r.quality_score} /></span>
                </div>
                <p className="mt-1.5 text-sm text-slate-200">{r.text}</p>
                <IssueChips introduced={r.issues} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {reqs.removed.length > 0 && (
        <Section title="Removed requirements" count={reqs.removed.length} tone="red" defaultOpen={false}>
          <ul className="divide-y divide-slate-800">
            {reqs.removed.map(r => (
              <li key={`r-${r.id}`} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Minus className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-mono font-bold text-indigo-400">{r.id}</span>
                  <span className="ml-auto"><ScoreBadge score={r.quality_score} /></span>
                </div>
                <p className="mt-1.5 text-sm text-slate-400">{r.text}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(conflictsResolved.length > 0 || conflictsIntroduced.length > 0) && (
        <Section
          title="Conflicts"
          count={`${conflictsResolved.length} resolved · ${conflictsIntroduced.length} new`}
          tone={conflictsIntroduced.length ? 'amber' : 'emerald'}
        >
          <ul className="divide-y divide-slate-800">
            {[...conflictsResolved.map(c => ['resolved', c]), ...conflictsIntroduced.map(c => ['new', c])].map(([kind, c]) => (
              <li key={`${kind}-${c.req_a_id}-${c.req_b_id}`} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={kind === 'resolved' ? 'success' : 'danger'}>{kind === 'resolved' ? 'Resolved' : 'New'}</Badge>
                  <span className="font-mono text-xs text-indigo-400">{c.req_a_id} ↔ {c.req_b_id}</span>
                  {c.attribute && <span className="text-xs text-slate-500">{c.attribute.replace(/_/g, ' ')}</span>}
                </div>
                <p className="mt-1.5 text-slate-400 text-xs">{c.req_a_text}</p>
                <p className="text-slate-400 text-xs">{c.req_b_text}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const { loadRun, analysis } = useAnalysis();
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [diff, setDiff] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [order, setOrder] = useState(null); // explicit [base, target] after a swap

  const refresh = useCallback(() => {
    return api.listHistory(100)
      .then(list => {
        setRuns(list);
        setSelected(prev => {
          const kept = prev.filter(id => list.some(r => r.run_id === id));
          return kept.length ? kept : list.slice(0, 2).map(r => r.run_id);
        });
      })
      .catch(e => setError(e.message));
  }, []);

  // Reload the list whenever the active analysis changes (a new run may have been saved).
  useEffect(() => {
    let cancelled = false;
    api.listHistory(100)
      .then(list => {
        if (cancelled) return;
        setRuns(list);
        setSelected(prev => {
          const kept = prev.filter(id => list.some(r => r.run_id === id));
          return kept.length ? kept : list.slice(0, 2).map(r => r.run_id);
        });
      })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [analysis]);

  // Older run is the base by default; "Swap" overrides it.
  const pair = useMemo(() => {
    if (selected.length !== 2 || !runs) return null;
    if (order && order.every(id => selected.includes(id))) return order;
    const pos = id => runs.findIndex(r => r.run_id === id);
    return [...selected].sort((a, b) => pos(b) - pos(a));
  }, [selected, runs, order]);

  useEffect(() => {
    if (!pair) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => { if (!cancelled) setComparing(true); })
      .then(() => api.compareRuns(pair[0], pair[1]))
      .then(result => { if (!cancelled) { setDiff(result); setError(null); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setComparing(false); });
    return () => { cancelled = true; };
  }, [pair]);

  const toggle = (runId) => {
    setOrder(null);
    setSelected(prev => {
      if (prev.includes(runId)) return prev.filter(id => id !== runId);
      return [...prev, runId].slice(-2);
    });
  };

  const openRun = async (run) => {
    try {
      await loadRun(run.run_id, run.document_name);
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteRun = async (run) => {
    if (!window.confirm(`Delete the analysis of "${run.document_name}" from history?`)) return;
    try {
      await api.deleteRun(run.run_id);
      setDiff(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  if (runs === null && !error) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  }

  if (runs && runs.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={HistoryIcon}
          title="No saved analyses yet"
          description="Every analysis is saved automatically. Analyse a document to start building history."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const activeRunId = analysis?.run_id;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="History & Compare"
        subtitle="Re-open any past analysis, or pick two runs to see what a revision fixed and what it broke"
      />

      {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-4">{error}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 text-xs text-slate-400">
          <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
          Select two runs to compare ({selected.length}/2 selected)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 text-left">
                <th className="px-4 py-2 w-8"></th>
                <th className="px-2 py-2">Document</th>
                <th className="px-2 py-2">Analysed</th>
                <th className="px-2 py-2 text-right">Reqs</th>
                <th className="px-2 py-2 text-right">Avg score</th>
                <th className="px-2 py-2 text-right">Issues</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(runs || []).map(run => {
                const isSelected = selected.includes(run.run_id);
                const issues = run.ambiguous_count + run.incomplete_count + run.duplicate_pairs_count + run.conflict_pairs_count;
                return (
                  <tr key={run.run_id} className={isSelected ? 'bg-indigo-950/30' : 'hover:bg-slate-800/40'}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${run.document_name} for comparison`}
                        checked={isSelected}
                        onChange={() => toggle(run.run_id)}
                        className="accent-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-2.5 max-w-[16rem]">
                      <div className="text-slate-200 truncate">{run.document_name}</div>
                      {run.run_id === activeRunId && <span className="text-[11px] text-indigo-400">active</span>}
                    </td>
                    <td className="px-2 py-2.5 text-slate-400 whitespace-nowrap">{formatDate(run.created_at)}</td>
                    <td className="px-2 py-2.5 text-right text-slate-300">{run.total_requirements}</td>
                    <td className="px-2 py-2.5 text-right"><ScoreBadge score={run.average_quality_score} /></td>
                    <td className="px-2 py-2.5 text-right text-slate-300">{issues}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openRun(run)}
                          title="Open this analysis"
                          className="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-800"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRun(run)}
                          title="Delete from history"
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected.length < 2 && (
        <p className="text-sm text-slate-500">Select one more run to see a comparison.</p>
      )}
      {comparing && !diff && <div className="flex justify-center py-10"><Spinner /></div>}
      {diff && pair && (
        <div className={comparing ? 'opacity-60 transition-opacity' : ''}>
          <ComparisonView diff={diff} onSwap={() => setOrder([pair[1], pair[0]])} />
        </div>
      )}
    </div>
  );
}
