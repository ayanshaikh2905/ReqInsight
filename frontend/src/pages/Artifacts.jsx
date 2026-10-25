import { useMemo, useState } from 'react';
import { ChevronDown, Search, Sparkles } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { ArtifactPanel } from '../components/ArtifactPanel';
import { ScoreBadge, TypeBadge } from '../components/Badge';
import { EmptyState, PageHeader } from '../components/Card';
import { Collapse } from '../components/Collapse';
import { NoAnalysis } from '../components/NoAnalysis';
import { Segmented } from '../components/Segmented';
import { TONE, bandFor } from '../lib/quality';

function ArtifactRow({ req }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[bandFor(req.quality_score).tone];
  const id = `artifact-${req.id}`;
  return (
    <li className="relative overflow-hidden rounded-xl border border-line bg-surface">
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bg}`} aria-hidden="true" />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 py-3.5 pl-5 pr-4 text-left transition-colors hover:bg-raised/70"
      >
        <span className="w-24 shrink-0 pt-px font-mono text-xs text-accent">{req.id}</span>
        <TypeBadge type={req.type} />
        <span className={`min-w-0 flex-1 text-sm text-ink ${open ? '' : 'truncate'}`}>{req.text}</span>
        <ScoreBadge score={req.quality_score} className="shrink-0 pt-px" />
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <Collapse open={open} id={id}>
        <div className="border-t border-line px-5 py-5 md:pl-[8.25rem]">
          <ArtifactPanel text={req.text} auto />
        </div>
      </Collapse>
    </li>
  );
}

export default function Artifacts() {
  usePageTitle('Artifacts');
  const { analysis } = useAnalysis();
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('low');

  const reqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (analysis?.requirements || []).filter(
      (r) => !q || r.text.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    );
    return order === 'low' ? [...list].sort((a, b) => a.quality_score - b.quality_score) : list;
  }, [analysis, search, order]);

  if (!analysis) {
    return (
      <>
        <PageHeader title="Artifacts" subtitle="User stories, acceptance criteria and cleaner wording for each requirement." />
        <NoAnalysis icon={Sparkles} what="generated artifacts" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Artifacts"
        subtitle="Open a requirement to generate a user story, Given/When/Then criteria, or a cleaner rewrite. Results are generated on demand."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by text or ID"
            aria-label="Filter requirements"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
          />
        </div>
        <Segmented
          label="Sort order"
          value={order}
          onChange={setOrder}
          options={[{ value: 'low', label: 'Weakest first' }, { value: 'doc', label: 'Document order' }]}
        />
      </div>

      {reqs.length === 0 ? (
        <EmptyState icon={Search} title="No requirements match" description="Try a different search term." />
      ) : (
        <ul className="space-y-2.5">{reqs.map((r) => <ArtifactRow key={r.id} req={r} />)}</ul>
      )}
    </>
  );
}
