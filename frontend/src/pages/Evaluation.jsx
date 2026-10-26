import { useCallback, useEffect, useState } from 'react';
import { api, isAbort } from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, InlineError, PageHeader } from '../components/Card';

const METRICS = [
  ['accuracy', 'Accuracy'],
  ['precision', 'Precision'],
  ['recall', 'Recall'],
  ['f1_score', 'F1 score'],
];

const pct = (v) => (v ?? 0) * 100;

function Bar({ value, tone = 'bg-accent', delay = 0 }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line/70">
      <div className={`bar-run h-full rounded-full ${tone}`} style={{ width: `${value}%`, animationDelay: `${delay}ms` }} />
    </div>
  );
}

function MetricList({ data, delay = 0 }) {
  return (
    <div className="space-y-4">
      {METRICS.map(([key, label], i) => (
        <div key={key}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-muted">{label}</span>
            <span className="font-mono text-sm text-ink">
              <AnimatedNumber value={pct(data[key])} decimals={1} duration={1100} delay={delay + i * 80} />%
            </span>
          </div>
          <Bar value={pct(data[key])} delay={delay + i * 80} />
        </div>
      ))}
    </div>
  );
}

// Same model, three ways of testing it, against the do-nothing baseline.
function ProtocolComparison({ cls }) {
  const rows = [
    { label: 'Always guess the majority class', note: cls.baseline?.description, value: cls.baseline?.accuracy, tone: 'bg-faint' },
    { label: 'Unseen projects', note: cls.cross_project?.protocol, value: cls.cross_project?.accuracy, tone: 'bg-info' },
    { label: 'Cross-validation', note: `${cls.fold_accuracies?.length ?? 10} folds, every requirement tested once`, value: cls.accuracy, tone: 'bg-accent' },
  ].filter((r) => typeof r.value === 'number');
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">
              {r.label}
              {r.note && <span className="ml-2 hidden text-xs text-faint sm:inline">{r.note}</span>}
            </span>
            <span className="font-mono text-sm text-ink">
              <AnimatedNumber value={pct(r.value)} decimals={1} duration={1100} delay={i * 120} />%
            </span>
          </div>
          <Bar value={pct(r.value)} tone={r.tone} delay={i * 120} />
        </li>
      ))}
    </ul>
  );
}

function ConfusionMatrix({ data }) {
  if (!data?.matrix) return null;
  const { labels, matrix } = data;
  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-xs">
        <span />
        {labels.map((l) => <span key={l} className="px-2 pb-1 text-center text-faint">Predicted {l}</span>)}
        {matrix.map((row, i) => {
          const total = row.reduce((a, b) => a + b, 0) || 1;
          return [
            <span key={`h${i}`} className="flex items-center pr-2 text-right text-faint">Actual {labels[i]}</span>,
            ...row.map((n, j) => {
              const share = n / total;
              const correct = i === j;
              return (
                <div
                  key={`${i}-${j}`}
                  className={`flex flex-col items-center justify-center rounded-lg border py-3 ${
                    correct ? 'border-ok/30 bg-ok/15' : 'border-bad/25 bg-bad/10'
                  }`}
                >
                  <span className="font-display text-xl font-semibold tabular-nums text-ink">{n}</span>
                  <span className="font-mono text-[11px] text-faint">{Math.round(share * 100)}%</span>
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

function FoldStrip({ folds, mean }) {
  if (!folds?.length) return null;
  const min = Math.min(...folds, mean) - 0.03;
  const max = Math.max(...folds, mean) + 0.03;
  const x = (v) => ((v - min) / (max - min)) * 100;
  return (
    <div>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <div className="absolute top-1 h-6 w-px bg-accent" style={{ left: `${x(mean)}%` }} title={`Mean ${(mean * 100).toFixed(1)}%`} />
        {folds.map((f, i) => (
          <span
            key={i}
            className="pop-in absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface bg-info"
            style={{ left: `${x(f)}%`, animationDelay: `${300 + i * 60}ms` }}
            title={`Fold ${i + 1}: ${(f * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-faint">
        <span>{(min * 100).toFixed(0)}%</span>
        <span>{(max * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function CategoryBars({ perClass }) {
  if (!perClass) return null;
  const rows = Object.entries(perClass).sort((a, b) => b[1].support - a[1].support);
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map(([name, m], i) => (
        <li key={name}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-ink">
              {name} <span className="text-xs text-faint">n={m.support}</span>
            </span>
            <span className="font-mono text-xs text-muted">F1 {pct(m.f1_score).toFixed(0)}%</span>
          </div>
          <Bar value={pct(m.f1_score)} tone="bg-info" delay={i * 50} />
        </li>
      ))}
    </ul>
  );
}

function SmallSetCard({ title, data }) {
  if (!data) return null;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        <span className="rounded-md border border-warn/30 bg-warn/15 px-1.5 py-0.5 text-xs text-warn">n={data.sample_size}</span>
      </div>
      {data.method && <p className="mt-1 text-xs leading-relaxed text-muted">{data.method}</p>}
      <div className="mt-4"><MetricList data={data} /></div>
      {data.note && <p className="mt-5 text-xs text-faint">{data.note}</p>}
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading metrics">
      <div className="skeleton h-80 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className="skeleton h-64 rounded-xl" />)}
      </div>
    </div>
  );
}

export default function Evaluation() {
  usePageTitle('Evaluation');
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getMetrics({ signal: controller.signal })
      .then(setMetrics)
      .catch((e) => !isAbort(e) && setError(e.message));
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const cls = metrics?.classification;
  const cat = metrics?.nfr_category;
  const info = metrics?.dataset_info;

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
          {cls && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">Functional vs Non-Functional</h2>
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
                    {cls.sample_size} expert-labelled requirements from {cls.n_projects} projects. {cls.model_description}.
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display text-4xl font-semibold tracking-tight text-ink">
                    <AnimatedNumber value={pct(cls.accuracy)} decimals={1} duration={1200} />%
                  </div>
                  {typeof cls.accuracy_std === 'number' && (
                    <div className="font-mono text-xs text-faint">± {pct(cls.accuracy_std).toFixed(1)} across folds</div>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-6">
                  <ProtocolComparison cls={cls} />
                  <div>
                    <h3 className="mb-2 text-xs font-medium text-faint">Accuracy of each fold</h3>
                    <FoldStrip folds={cls.fold_accuracies} mean={cls.accuracy} />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-xs font-medium text-faint">Confusion matrix (cross-validation)</h3>
                    <ConfusionMatrix data={cls.confusion_matrix} />
                  </div>
                  <dl className="grid grid-cols-3 gap-4">
                    {[['precision', 'Precision'], ['recall', 'Recall'], ['f1_score', 'Macro F1']].map(([k, label], i) => (
                      <div key={k}>
                        <dd className="font-display text-2xl font-semibold tracking-tight text-ink">
                          <AnimatedNumber value={pct(cls[k])} decimals={1} delay={i * 80} />%
                        </dd>
                        <dt className="mt-0.5 text-xs text-muted">{label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {cls.rules?.requirements_decided > 0 && (
                <p className="mt-6 border-t border-line pt-4 text-xs text-faint">
                  Attribute rules decided {cls.rules.requirements_decided} of {cls.sample_size} requirements and were right{' '}
                  {pct(cls.rules.accuracy).toFixed(1)}% of the time. The model alone scores {pct(cls.model_only?.accuracy).toFixed(1)}%.
                </p>
              )}
            </Card>
          )}

          {cat && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">Non-Functional category</h2>
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
                    {cat.n_classes} categories over {cat.sample_size} Non-Functional requirements, {cat.protocol.toLowerCase()}.
                    Rare categories score lower because there are few examples to learn from.
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display text-4xl font-semibold tracking-tight text-ink">
                    <AnimatedNumber value={pct(cat.accuracy)} decimals={1} duration={1200} />%
                  </div>
                  <div className="font-mono text-xs text-faint">baseline {pct(cat.baseline?.accuracy).toFixed(1)}%</div>
                </div>
              </div>
              <div className="mt-6"><CategoryBars perClass={cat.per_class} /></div>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <SmallSetCard title="Ambiguity detection" data={metrics.ambiguity} />
            <SmallSetCard title="Duplicate detection" data={metrics.duplicates} />
          </div>

          {info && (
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold text-ink">Data</h2>
              {info.primary_datasets?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {info.primary_datasets.map((d) => <span key={d} className="rounded-md border border-line px-2 py-0.5 text-xs text-muted">{d}</span>)}
                </div>
              )}
              {info.note && <p className="mt-3 max-w-prose text-sm text-muted">{info.note}</p>}
              {info.citation && <p className="mt-3 max-w-prose text-xs italic text-faint">{info.citation}</p>}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
