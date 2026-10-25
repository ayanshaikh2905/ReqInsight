import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, CheckCircle2, ChevronDown, FolderOpen,
  GitCompare, History as HistoryIcon, MinusCircle, Plus, Minus, Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAnalysis } from '../context/AnalysisContext';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Badge, ScoreBadge } from '../components/Badge';
import { Button, LinkButton } from '../components/Button';
import { Card, EmptyState, InlineError, PageHeader } from '../components/Card';
import { Collapse } from '../components/Collapse';

const METRICS = [
  { key: 'average_quality_score', label: 'Average quality', decimals: 1 },
  { key: 'total_requirements', label: 'Requirements' },
  { key: 'ambiguous_count', label: 'Ambiguous' },
  { key: 'incomplete_count', label: 'Incomplete' },
  { key: 'duplicate_pairs_count', label: 'Duplicate pairs' },
  { key: 'conflict_pairs_count', label: 'Conflict pairs' },
];

const DIRECTION_TEXT = { better: 'text-ok', worse: 'text-bad', same: 'text-faint', neutral: 'text-info' };

const VERDICT = {
  improved: { icon: CheckCircle2, text: 'Specification improved', cls: 'border-ok/40 bg-ok/10 text-ok' },
  regressed: { icon: AlertTriangle, text: 'Specification regressed', cls: 'border-bad/40 bg-bad/10 text-bad' },
  unchanged: { icon: MinusCircle, text: 'No meaningful change', cls: 'border-line bg-surface text-muted' },
};

function formatDate(value) {
  if (!value) return '–';
  const d = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

function Section({ title, count, tone = 'text-ink', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `section-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-raised/70"
      >
        <span className={`text-sm font-semibold ${tone}`}>{title}</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {count}
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      <Collapse open={open} id={id}>
        <div className="border-t border-line">{children}</div>
      </Collapse>
    </Card>
  );
}

function IssueChips({ resolved = [], introduced = [] }) {
  if (!resolved.length && !introduced.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {resolved.map((i) => <Badge key={`r-${i}`} variant="ok">Fixed: {i}</Badge>)}
      {introduced.map((i) => <Badge key={`n-${i}`} variant="warn">New: {i}</Badge>)}
    </div>
  );
}

function ComparisonView({ diff, onSwap }) {
  const verdict = VERDICT[diff.verdict] || VERDICT.unchanged;
  const VerdictIcon = verdict.icon;
  const reqs = diff.requirements;
  const { resolved: conflictsResolved, introduced: conflictsIntroduced } = diff.conflicts;

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${verdict.cls}`}>
        <VerdictIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-semibold">{verdict.text}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="max-w-[16rem] truncate">{diff.base.document_name}</span>
            <span className="text-faint">({formatDate(diff.base.created_at)})</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            <span className="max-w-[16rem] truncate">{diff.target.document_name}</span>
            <span className="text-faint">({formatDate(diff.target.created_at)})</span>
          </div>
        </div>
        <Button size="sm" onClick={onSwap}>
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" /> Swap
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {METRICS.map(({ key, label, decimals = 0 }) => {
          const m = diff.summary_delta[key];
          if (!m) return null;
          return (
            <Card key={key} className="p-4">
              <div className="text-xs text-muted">{label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-sm text-faint">{m.before}</span>
                <ArrowRight className="h-3 w-3 text-faint" aria-hidden="true" />
                <span className="font-display text-2xl font-semibold tracking-tight text-ink">
                  <AnimatedNumber value={m.after} decimals={decimals} duration={700} />
                </span>
                <span className={`ml-auto font-mono text-xs font-medium ${DIRECTION_TEXT[m.direction] || 'text-faint'}`}>
                  {m.delta === 0 ? '±0' : signed(m.delta)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Issues resolved', diff.issues.resolved, 'text-ok'],
          ['Issues introduced', diff.issues.introduced, 'text-warn'],
          ['Requirements improved', reqs.improved, 'text-ok'],
          ['Requirements regressed', reqs.regressed, 'text-bad'],
        ].map(([label, value, cls]) => (
          <Card key={label} className="p-4">
            <div className={`font-display text-3xl font-semibold leading-none tracking-tight ${cls}`}>
              <AnimatedNumber value={value} duration={700} />
            </div>
            <div className="mt-2 text-xs text-muted">{label}</div>
          </Card>
        ))}
      </div>

      <Section title="Changed requirements" count={`${reqs.changed.length} changed, ${reqs.unchanged} unchanged`}>
        {reqs.changed.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No matched requirement changed.</p>
        ) : (
          <ul className="divide-y divide-line">
            {reqs.changed.map((c) => (
              <li key={`${c.base_id}-${c.target_id}`} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-accent">
                    {c.base_id === c.target_id ? c.target_id : `${c.base_id} → ${c.target_id}`}
                  </span>
                  {c.text_changed && <Badge variant="info">Reworded</Badge>}
                  <span className="ml-auto flex items-center gap-1.5">
                    <ScoreBadge score={c.base_score} />
                    <ArrowRight className="h-3 w-3 text-faint" aria-hidden="true" />
                    <ScoreBadge score={c.target_score} />
                    <span className={`w-9 text-right font-mono text-xs font-medium ${c.score_delta > 0 ? 'text-ok' : c.score_delta < 0 ? 'text-bad' : 'text-faint'}`}>
                      {signed(c.score_delta)}
                    </span>
                  </span>
                </div>
                {c.text_changed ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-faint line-through decoration-faint/50">{c.base_text}</p>
                    <p className="text-ink">{c.target_text}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">{c.target_text}</p>
                )}
                <IssueChips resolved={c.resolved_issues} introduced={c.new_issues} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {reqs.added.length > 0 && (
        <Section title="Added requirements" count={reqs.added.length} tone="text-ok" defaultOpen={false}>
          <ul className="divide-y divide-line">
            {reqs.added.map((r) => (
              <li key={`a-${r.id}`} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
                  <span className="font-mono text-xs text-accent">{r.id}</span>
                  <span className="ml-auto"><ScoreBadge score={r.quality_score} /></span>
                </div>
                <p className="mt-1.5 text-sm text-ink">{r.text}</p>
                <IssueChips introduced={r.issues} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {reqs.removed.length > 0 && (
        <Section title="Removed requirements" count={reqs.removed.length} tone="text-bad" defaultOpen={false}>
          <ul className="divide-y divide-line">
            {reqs.removed.map((r) => (
              <li key={`r-${r.id}`} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <Minus className="h-3.5 w-3.5 text-bad" aria-hidden="true" />
                  <span className="font-mono text-xs text-accent">{r.id}</span>
                  <span className="ml-auto"><ScoreBadge score={r.quality_score} /></span>
                </div>
                <p className="mt-1.5 text-sm text-muted">{r.text}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(conflictsResolved.length > 0 || conflictsIntroduced.length > 0) && (
        <Section
          title="Conflicts"
          count={`${conflictsResolved.length} resolved, ${conflictsIntroduced.length} new`}
          tone={conflictsIntroduced.length ? 'text-warn' : 'text-ok'}
        >
          <ul className="divide-y divide-line">
            {[...conflictsResolved.map((c) => ['resolved', c]), ...conflictsIntroduced.map((c) => ['new', c])].map(([kind, c]) => (
              <li key={`${kind}-${c.req_a_id}-${c.req_b_id}`} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={kind === 'resolved' ? 'ok' : 'bad'}>{kind === 'resolved' ? 'Resolved' : 'New'}</Badge>
                  <span className="font-mono text-xs text-accent">{c.req_a_id} and {c.req_b_id}</span>
                  {c.attribute && <span className="text-xs text-faint">{c.attribute.replace(/_/g, ' ')}</span>}
                </div>
                <p className="mt-1.5 text-xs text-muted">{c.req_a_text}</p>
                <p className="text-xs text-muted">{c.req_b_text}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export default function History() {
  usePageTitle('History');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loadRun, analysis } = useAnalysis();
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [diff, setDiff] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [order, setOrder] = useState(null); // explicit [base, target] after a swap
  const [confirmId, setConfirmId] = useState(null);

  const applyList = useCallback((list) => {
    setRuns(list);
    setSelected((prev) => {
      const kept = prev.filter((id) => list.some((r) => r.run_id === id));
      return kept.length ? kept : list.slice(0, 2).map((r) => r.run_id);
    });
  }, []);

  const refresh = useCallback(() => api.listHistory(100).then(applyList).catch((e) => setError(e.message)), [applyList]);

  // Reload whenever the active analysis changes (a new run may have been saved).
  useEffect(() => {
    let cancelled = false;
    api
      .listHistory(100)
      .then((list) => !cancelled && applyList(list))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [analysis, applyList]);

  // The older run is the base by default; "Swap" overrides it.
  const pair = useMemo(() => {
    if (selected.length !== 2 || !runs) return null;
    if (order && order.every((id) => selected.includes(id))) return order;
    const pos = (id) => runs.findIndex((r) => r.run_id === id);
    return [...selected].sort((a, b) => pos(b) - pos(a));
  }, [selected, runs, order]);

  useEffect(() => {
    if (!pair) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => !cancelled && setComparing(true))
      .then(() => api.compareRuns(pair[0], pair[1]))
      .then((result) => {
        if (!cancelled) {
          setDiff(result);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setComparing(false));
    return () => {
      cancelled = true;
    };
  }, [pair]);

  const toggle = (runId) => {
    setOrder(null);
    setSelected((prev) => (prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId].slice(-2)));
  };

  const openRun = async (run) => {
    try {
      await loadRun(run.run_id, run.document_name);
      navigate('/');
    } catch (e) {
      toast({ tone: 'bad', title: 'Could not open that analysis', description: e.message });
    }
  };

  const deleteRun = async (run) => {
    try {
      await api.deleteRun(run.run_id);
      setConfirmId(null);
      setDiff(null);
      await refresh();
      toast({ tone: 'ok', title: 'Removed from history', description: run.document_name });
    } catch (e) {
      toast({ tone: 'bad', title: 'Could not delete', description: e.message });
    }
  };

  if (runs === null && !error) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading history">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
      </div>
    );
  }

  if (runs && runs.length === 0) {
    return (
      <>
        <PageHeader title="History & Compare" subtitle="Re-open a past analysis, or compare two runs." />
        <EmptyState
          icon={HistoryIcon}
          title="No saved analyses yet"
          description="Every analysis is saved automatically. Analyze a document to start building history."
          action={<LinkButton to="/upload" variant="primary">Upload a document</LinkButton>}
        />
      </>
    );
  }

  const activeRunId = analysis?.run_id;

  return (
    <>
      <PageHeader
        title="History & Compare"
        subtitle="Re-open any past analysis, or pick two runs to see what a revision fixed and what it broke."
      />

      {error && <InlineError className="mb-5" onRetry={() => { setError(null); refresh(); }}>{error}</InlineError>}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-xs text-muted">
          <GitCompare className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Select two runs to compare ({selected.length} of 2 selected)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-raised/60">
              <tr className="text-left text-xs font-medium text-muted">
                <th scope="col" className="w-10 px-5 py-2.5"><span className="sr-only">Select</span></th>
                <th scope="col" className="px-2 py-2.5">Document</th>
                <th scope="col" className="px-2 py-2.5">Analyzed</th>
                <th scope="col" className="px-2 py-2.5 text-right">Requirements</th>
                <th scope="col" className="px-2 py-2.5 text-right">Quality</th>
                <th scope="col" className="px-2 py-2.5 text-right">Issues</th>
                <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(runs || []).map((run) => {
                const isSelected = selected.includes(run.run_id);
                const issues = run.ambiguous_count + run.incomplete_count + run.duplicate_pairs_count + run.conflict_pairs_count;
                return (
                  <tr key={run.run_id} className={`transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-raised/50'}`}>
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${run.document_name} for comparison`}
                        checked={isSelected}
                        onChange={() => toggle(run.run_id)}
                        className="h-4 w-4 accent-[rgb(var(--c-accent))]"
                      />
                    </td>
                    <td className="max-w-[16rem] px-2 py-3">
                      <div className="truncate text-ink">{run.document_name}</div>
                      {run.run_id === activeRunId && <span className="text-xs text-accent">Active</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-muted">{formatDate(run.created_at)}</td>
                    <td className="px-2 py-3 text-right font-mono text-xs tabular-nums text-muted">{run.total_requirements}</td>
                    <td className="px-2 py-3 text-right"><ScoreBadge score={run.average_quality_score} /></td>
                    <td className="px-2 py-3 text-right font-mono text-xs tabular-nums text-muted">{issues}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {confirmId === run.run_id ? (
                          <>
                            <Button size="sm" variant="danger" onClick={() => deleteRun(run)}>Delete</Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => openRun(run)} title="Open this analysis" aria-label={`Open ${run.document_name}`} className="rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-accent">
                              <FolderOpen className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setConfirmId(run.run_id)} title="Delete from history" aria-label={`Delete ${run.document_name}`} className="rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-bad">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6">
        {selected.length < 2 && <p className="text-sm text-muted">Select one more run to see a comparison.</p>}
        {comparing && !diff && <div className="skeleton h-40 rounded-xl" role="status" aria-label="Comparing runs" />}
        {diff && pair && (
          <div className={`transition-opacity duration-200 ${comparing ? 'opacity-60' : ''}`}>
            <ComparisonView diff={diff} onSwap={() => setOrder([pair[1], pair[0]])} />
          </div>
        )}
      </div>
    </>
  );
}
