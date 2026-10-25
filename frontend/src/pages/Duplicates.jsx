import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { api, isAbort } from '../api/client';
import { useAnalysis } from '../context/AnalysisContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Card, EmptyState, InlineError, PageHeader } from '../components/Card';
import { NoAnalysis } from '../components/NoAnalysis';
import { Ring } from '../components/Ring';
import { AnimatedNumber } from '../components/AnimatedNumber';

function Side({ id, text }) {
  return (
    <div className="min-w-0 p-5">
      <Link to={`/requirements?focus=${encodeURIComponent(id)}`} className="font-mono text-xs text-accent hover:underline">
        {id}
      </Link>
      <p className="mt-2 text-sm leading-relaxed text-ink">{text}</p>
    </div>
  );
}

export default function Duplicates() {
  usePageTitle('Duplicates');
  const { analysis } = useAnalysis();
  const [custom, setCustom] = useState(null); // null: show pairs from the original analysis
  const [fetched, setFetched] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  // Re-check at another threshold once the slider settles.
  useEffect(() => {
    if (custom == null) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        setFetched(await api.getDuplicates(custom, { signal: controller.signal }));
      } catch (e) {
        if (!isAbort(e)) setError(e.message);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [custom, attempt]);

  if (!analysis) {
    return (
      <>
        <PageHeader title="Duplicates" subtitle="Requirements that say nearly the same thing." />
        <NoAnalysis icon={Copy} what="duplicate pairs" />
      </>
    );
  }

  const pairs = [...((custom != null && fetched) || analysis.duplicates || [])].sort(
    (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0),
  );
  const slider = custom ?? 0.85;

  return (
    <>
      <PageHeader
        title="Duplicates"
        subtitle="Pairs of requirements whose meaning overlaps, found by comparing their embeddings."
      />

      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-3">
            <div className="font-display text-5xl font-semibold leading-none tracking-tight text-ink">
              <AnimatedNumber value={pairs.length} duration={600} />
            </div>
            <div className="text-sm text-muted">duplicate pair{pairs.length === 1 ? '' : 's'}</div>
          </div>
          <div className="w-full sm:max-w-sm">
            <div className="flex items-baseline justify-between">
              <label htmlFor="dup-threshold" className="text-sm font-medium text-ink">Similarity threshold</label>
              <span className="font-mono text-sm tabular-nums text-accent">{slider.toFixed(2)}</span>
            </div>
            <input
              id="dup-threshold"
              type="range"
              min="0.5"
              max="0.99"
              step="0.01"
              value={slider}
              onChange={(e) => setCustom(parseFloat(e.target.value))}
              className="mt-3 w-full accent-[rgb(var(--c-accent))]"
            />
            <p className="mt-1.5 text-xs text-faint">
              {custom == null
                ? 'Showing the pairs found during analysis. Move the slider to re-check at another threshold.'
                : 'Lower values catch looser paraphrases. Higher values keep only near-identical wording.'}
            </p>
          </div>
        </div>
      </Card>

      {error && <InlineError className="mb-4" onRetry={() => setAttempt((n) => n + 1)}>{error}</InlineError>}

      {pairs.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No duplicates at this threshold"
          description="Every requirement is distinct enough. Lower the threshold to look for looser matches."
        />
      ) : (
        <ul className={`space-y-3 transition-opacity duration-200 ${busy ? 'opacity-50' : ''}`} aria-busy={busy}>
          {pairs.map((pair) => {
            const pct = Math.round((pair.similarity ?? 0) * 100);
            return (
              <li key={`${pair.req_a_id}-${pair.req_b_id}`} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="grid divide-y divide-line md:grid-cols-[1fr_auto_1fr] md:divide-x md:divide-y-0">
                  <Side id={pair.req_a_id} text={pair.req_a_text} />
                  <div className="flex items-center justify-center gap-3 px-6 py-4 md:flex-col md:gap-2">
                    <Ring value={pct} label={`${pct}%`} size={60} tone={pct >= 95 ? 'bad' : 'warn'} />
                    <span className="text-xs text-faint">similar</span>
                  </div>
                  <Side id={pair.req_b_id} text={pair.req_b_text} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
