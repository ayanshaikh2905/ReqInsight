import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitMerge } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Badge } from '../components/Badge';
import { EmptyState, PageHeader } from '../components/Card';
import { MarkedText } from '../components/MarkedText';
import { NoAnalysis } from '../components/NoAnalysis';

function Side({ id, text, value }) {
  return (
    <div className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/requirements?focus=${encodeURIComponent(id)}`} className="font-mono text-xs text-accent hover:underline">{id}</Link>
        {value && <Badge variant="bad">{value}</Badge>}
      </div>
      <MarkedText text={text || 'Requirement text unavailable.'} terms={value ? [value] : []} tone="bad" className="mt-2 text-sm leading-relaxed text-ink" />
    </div>
  );
}

export default function Conflicts() {
  usePageTitle('Conflicts');
  const { analysis } = useAnalysis();
  const [type, setType] = useState('all');
  const conflicts = useMemo(() => analysis?.conflicts || [], [analysis]);

  const types = useMemo(() => {
    const counts = new Map();
    conflicts.forEach((c) => counts.set(c.conflict_type, (counts.get(c.conflict_type) || 0) + 1));
    return [...counts.entries()];
  }, [conflicts]);

  if (!analysis) {
    return (
      <>
        <PageHeader title="Conflicts" subtitle="Requirements that cannot both be satisfied." />
        <NoAnalysis icon={GitMerge} what="conflicts" />
      </>
    );
  }

  const shown = type === 'all' ? conflicts : conflicts.filter((c) => c.conflict_type === type);

  return (
    <>
      <PageHeader
        title="Conflicts"
        subtitle="Pairs of requirements that contradict each other, such as different limits for the same attribute."
      />

      {conflicts.length === 0 ? (
        <EmptyState icon={GitMerge} title="No conflicts detected" description="No two requirements in this document contradict each other." />
      ) : (
        <>
          {types.length > 1 && (
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by conflict type">
              {[['all', conflicts.length], ...types].map(([key, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  aria-pressed={type === key}
                  className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ${
                    type === key ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:border-faint hover:text-ink'
                  }`}
                >
                  {key === 'all' ? 'All conflicts' : key}
                  <span className="font-mono text-faint">{n}</span>
                </button>
              ))}
            </div>
          )}

          <ul className="space-y-3">
            {shown.map((c) => (
              <li key={`${c.req_a_id}-${c.req_b_id}-${c.attribute}`} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bad/5 px-5 py-3">
                  <Badge variant="bad">{c.conflict_type || 'Contradiction'}</Badge>
                  {c.attribute && <Badge>{c.attribute}</Badge>}
                  {typeof c.confidence === 'number' && (
                    <span className="ml-auto text-xs text-faint">{Math.round(c.confidence * 100)}% confidence</span>
                  )}
                </div>
                <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
                  <Side id={c.req_a_id} text={c.req_a_text} value={c.value_a} />
                  <Side id={c.req_b_id} text={c.req_b_text} value={c.value_b} />
                </div>
                {c.explanation && <p className="border-t border-line px-5 py-3 text-sm text-muted">{c.explanation}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
