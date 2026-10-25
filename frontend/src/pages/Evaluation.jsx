import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { api, isAbort } from '../api/client';
import { useAnalysis } from '../context/AnalysisContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, InlineError, PageHeader } from '../components/Card';
import { NoAnalysis } from '../components/NoAnalysis';

const METRICS = [
  ['accuracy', 'Accuracy'],
  ['precision', 'Precision'],
  ['recall', 'Recall'],
  ['f1_score', 'F1 score'],
];

function MetricCard({ title, caption, data }) {
  if (!data) return null;
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {caption && <p className="mt-1 min-h-[2.5rem] text-xs leading-relaxed text-muted">{caption}</p>}
      <div className="mt-4 space-y-4">
        {METRICS.map(([key, label], i) => {
          const pct = (data[key] ?? 0) * 100;
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-mono text-sm text-ink">
                  <AnimatedNumber value={pct} decimals={1} duration={1100} delay={i * 80} />%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line/70">
                <div className="bar-run h-full rounded-full bg-accent" style={{ width: `${pct}%`, animationDelay: `${i * 80}ms` }} />
              </div>
            </div>
          );
        })}
      </div>
      {data.sample_size != null && <p className="mt-5 text-xs text-faint">Evaluated on {data.sample_size} samples</p>}
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Loading metrics">
      {[0, 1, 2].map((i) => <div key={i} className="skeleton h-72 rounded-xl" />)}
    </div>
  );
}

export default function Evaluation() {
  usePageTitle('Evaluation');
  const { analysis } = useAnalysis();
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const hasAnalysis = !!analysis;
  useEffect(() => {
    if (!hasAnalysis) return undefined;
    const controller = new AbortController();
    api
      .getMetrics({ signal: controller.signal })
      .then(setMetrics)
      .catch((e) => !isAbort(e) && setError(e.message));
    return () => controller.abort();
  }, [hasAnalysis, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  if (!analysis) {
    return (
      <>
        <PageHeader title="Evaluation" subtitle="How well the analysis pipeline performs on benchmark data." />
        <NoAnalysis icon={Activity} what="evaluation metrics" />
      </>
    );
  }

  const gen = metrics?.text_generation;
  const datasets = metrics?.dataset_info?.primary_datasets;

  return (
    <>
      <PageHeader
        title="Evaluation"
        subtitle={metrics?.evaluation_type || 'How well the analysis pipeline performs on benchmark data.'}
      />

      {error && <InlineError className="mb-6" onRetry={retry}>{error}</InlineError>}
      {!metrics && !error && <Skeleton />}

      {metrics && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <MetricCard title="Type classification" caption={metrics.classification?.model_description} data={metrics.classification} />
            <MetricCard title="Ambiguity detection" caption={metrics.ambiguity?.method} data={metrics.ambiguity} />
            <MetricCard title="Duplicate detection" caption={metrics.duplicates?.method} data={metrics.duplicates} />
          </div>

          {gen && (
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold text-ink">Rewrite overlap</h2>
              {gen.evaluation_method && <p className="mt-1 text-xs text-muted">{gen.evaluation_method}</p>}
              <dl className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
                {[['bleu_score', 'BLEU'], ['rouge_1', 'ROUGE-1'], ['rouge_2', 'ROUGE-2'], ['rouge_l', 'ROUGE-L']].map(([k, label], i) =>
                  gen[k] != null ? (
                    <div key={k}>
                      <dd className="font-display text-3xl font-semibold tracking-tight text-ink">
                        <AnimatedNumber value={gen[k]} decimals={2} delay={i * 80} />
                      </dd>
                      <dt className="mt-1 text-xs text-muted">{label}</dt>
                    </div>
                  ) : null,
                )}
              </dl>
            </Card>
          )}

          {(datasets?.length > 0 || metrics.dataset_info?.note) && (
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold text-ink">Data</h2>
              {datasets?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {datasets.map((d) => <span key={d} className="rounded-md border border-line px-2 py-0.5 text-xs text-muted">{d}</span>)}
                </div>
              )}
              {metrics.dataset_info?.note && <p className="mt-3 max-w-prose text-sm text-muted">{metrics.dataset_info.note}</p>}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
