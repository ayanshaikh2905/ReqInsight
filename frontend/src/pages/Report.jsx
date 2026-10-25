import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, Download } from 'lucide-react';
import { api, isAbort } from '../api/client';
import { useAnalysis } from '../context/AnalysisContext';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { downloadBlob } from '../lib/download';
import { Badge, ScoreBadge, TypeBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, InlineError, PageHeader, SectionTitle, Stat, StatStrip } from '../components/Card';
import { Collapse } from '../components/Collapse';
import { NoAnalysis } from '../components/NoAnalysis';
import { TONE, toneForScore } from '../lib/quality';

function SortHeader({ label, k, sort, onSort, className = '' }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-4 py-2.5 text-left text-xs font-medium text-muted ${className}`}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 transition-colors hover:text-ink">
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${active ? 'text-accent' : 'opacity-0'} ${active && sort.dir === 'asc' ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </th>
  );
}

function CorrectedPreview({ corrected }) {
  return (
    <div className="space-y-8 pt-6">
      {corrected.sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-3 text-sm font-semibold text-ink">{section.title}</h3>
          <ul className="space-y-3">
            {section.requirements.map((r) => (
              <li key={r.id} className="border-l-2 border-line pl-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent">{r.id}</span>
                  <Badge variant={r.status === 'unchanged' ? 'neutral' : 'info'}>{r.status}</Badge>
                </div>
                {r.status !== 'unchanged' && r.original_text !== r.corrected_text && (
                  <p className="mt-1.5 text-sm text-faint line-through decoration-faint/50">{r.original_text}</p>
                )}
                <p className="mt-1 text-sm text-ink">{r.corrected_text}</p>
                {r.notes && <p className="mt-1 text-xs text-muted">{r.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {corrected.needs_decision.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Needs a stakeholder decision</h3>
          <ul className="space-y-2 text-sm text-muted">
            {corrected.needs_decision.map((d) => (
              <li key={`${d.req_a_id}-${d.req_b_id}`}>
                <span className="font-mono text-xs text-warn">{d.req_a_id}</span> {d.req_a_text}
                <span className="mx-2 text-faint">conflicts with</span>
                <span className="font-mono text-xs text-warn">{d.req_b_id}</span> {d.req_b_text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {corrected.merged_duplicates?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Merged duplicates</h3>
          <ul className="space-y-1.5 text-sm text-muted">
            {corrected.merged_duplicates.map((m) => (
              <li key={`${m.kept_id}-${m.removed_id}`}>
                <span className="font-mono text-xs text-faint line-through">{m.removed_id}</span>
                <span className="mx-2 text-faint">folded into</span>
                <span className="font-mono text-xs text-accent">{m.kept_id}</span>
                <span className="ml-2 text-xs text-faint">{Math.round(m.similarity * 100)}% similar</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {corrected.open_items.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Open items</h3>
          <ul className="space-y-1.5 text-sm text-muted">
            {corrected.open_items.map((o) => (
              <li key={`${o.req_id}-${o.placeholder}`}>
                <span className="font-mono text-xs text-bad">{o.req_id}</span> {o.placeholder}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Report() {
  usePageTitle('Report');
  const { analysis } = useAnalysis();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  const [corrected, setCorrected] = useState(null);
  const [correctedError, setCorrectedError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState({ key: 'doc', dir: 'asc' });

  const hasAnalysis = !!analysis;
  useEffect(() => {
    if (!hasAnalysis) return undefined;
    const controller = new AbortController();
    api
      .getCorrectedSRS({ signal: controller.signal })
      .then(setCorrected)
      .catch((e) => !isAbort(e) && setCorrectedError(e.message));
    return () => controller.abort();
  }, [hasAnalysis, attempt]);

  const rows = useMemo(() => {
    const list = [...(analysis?.requirements || [])];
    const dir = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'quality') list.sort((a, b) => (a.quality_score - b.quality_score) * dir);
    else if (sort.key === 'type') list.sort((a, b) => a.type.localeCompare(b.type) * dir);
    else if (dir === -1) list.reverse();
    return list;
  }, [analysis, sort]);

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const download = async (id, fetchBlob, filename) => {
    setBusy(id);
    try {
      downloadBlob(await fetchBlob(), filename);
      toast({ tone: 'ok', title: 'Download started', description: filename });
    } catch (e) {
      toast({ tone: 'bad', title: 'Export failed', description: e.message });
    } finally {
      setBusy(null);
    }
  };

  if (!analysis) {
    return (
      <>
        <PageHeader title="Report" subtitle="A written summary of the analysis, with exports." />
        <NoAnalysis icon={BookOpen} what="the report" />
      </>
    );
  }

  const s = analysis.summary;
  const score = s.average_quality_score;

  return (
    <>
      <PageHeader
        title="Report"
        subtitle={analysis.document_name}
        actions={['json', 'csv', 'pdf'].map((fmt) => (
          <Button
            key={fmt}
            size="sm"
            loading={busy === fmt}
            disabled={!!busy}
            onClick={() => download(fmt, () => api.exportReport(fmt).then((r) => r.blob()), `reqinsight_report.${fmt}`)}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> {fmt.toUpperCase()}
          </Button>
        ))}
      />

      <Card className="p-5 sm:p-6">
        <SectionTitle>Summary</SectionTitle>
        <div className="max-w-prose space-y-3 text-[15px] leading-relaxed text-muted">
          <p>
            This document contains <strong className="font-semibold text-ink">{s.total_requirements}</strong> requirements:{' '}
            <strong className="font-semibold text-ink">{s.functional_count}</strong> functional and{' '}
            <strong className="font-semibold text-ink">{s.non_functional_count}</strong> non-functional. The average quality
            score is <strong className={`font-semibold ${TONE[toneForScore(score)].text}`}>{score}</strong> out of 100.
          </p>
          <p>
            {s.ambiguous_count > 0 ? `${s.ambiguous_count} requirements use ambiguous wording` : 'No requirements use ambiguous wording'}
            {s.incomplete_count > 0 ? ` and ${s.incomplete_count} look incomplete.` : '.'}{' '}
            {s.duplicate_pairs_count > 0 && `${s.duplicate_pairs_count} pairs overlap closely enough to be duplicates. `}
            {s.conflict_pairs_count > 0 && `${s.conflict_pairs_count} pairs contradict each other and need a decision.`}
          </p>
        </div>
        <StatStrip className="mt-6">
          <Stat label="Requirements" value={s.total_requirements} />
          <Stat label="Ambiguous" value={s.ambiguous_count} delay={60} />
          <Stat label="Duplicate pairs" value={s.duplicate_pairs_count} delay={120} />
          <Stat label="Conflict pairs" value={s.conflict_pairs_count} delay={180} />
        </StatStrip>
      </Card>

      <Card className="mt-6 p-5 sm:p-6">
        <SectionTitle aside={corrected ? null : undefined}>Corrected SRS</SectionTitle>
        <p className="-mt-2 mb-5 max-w-prose text-sm text-muted">
          A review-ready version of the document. Rewording is applied, duplicates are merged, and anything that needs a human decision is listed rather than guessed.
        </p>

        {correctedError && <InlineError onRetry={() => { setCorrectedError(null); setAttempt((n) => n + 1); }}>{correctedError}</InlineError>}
        {!corrected && !correctedError && <div className="skeleton h-24 rounded-xl" role="status" aria-label="Loading corrected SRS" />}

        {corrected && (
          <>
            <StatStrip cols={3}>
              <Stat label="Unchanged" value={corrected.summary.unchanged} />
              <Stat label="Reworded" value={corrected.summary.reworded} delay={60} />
              <Stat label="Merged" value={corrected.summary.merged} delay={120} />
              <Stat label="Need a decision" value={corrected.summary.needs_decision} delay={180} tone={corrected.summary.needs_decision ? 'text-warn' : 'text-ink'} />
              <Stat label="Open items" value={corrected.summary.open_items} delay={240} tone={corrected.summary.open_items ? 'text-bad' : 'text-ink'} />
              <Stat label="Total" value={corrected.summary.total} delay={300} />
            </StatStrip>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {['docx', 'pdf', 'txt'].map((fmt) => (
                <Button
                  key={fmt}
                  variant="primary"
                  size="sm"
                  loading={busy === `corrected-${fmt}`}
                  disabled={!!busy}
                  onClick={() => download(`corrected-${fmt}`, () => api.exportCorrectedSRS(fmt), `ReqInsight_Corrected_SRS.${fmt}`)}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> {fmt.toUpperCase()}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="ml-auto" aria-expanded={previewOpen} aria-controls="corrected-preview" onClick={() => setPreviewOpen((o) => !o)}>
                {previewOpen ? 'Hide preview' : 'Preview corrected text'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${previewOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </Button>
            </div>

            <Collapse open={previewOpen} id="corrected-preview">
              <CorrectedPreview corrected={corrected} />
            </Collapse>
          </>
        )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">All requirements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-raised/60">
              <tr>
                <SortHeader label="ID" k="doc" sort={sort} onSort={onSort} />
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-muted">Requirement</th>
                <SortHeader label="Type" k="type" sort={sort} onSort={onSort} />
                <SortHeader label="Quality" k="quality" sort={sort} onSort={onSort} />
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-muted">Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-raised/50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    <Link to={`/requirements?focus=${encodeURIComponent(r.id)}`} className="text-accent hover:underline">{r.id}</Link>
                  </td>
                  <td className="max-w-md px-4 py-3 text-muted"><span className="line-clamp-2" title={r.text}>{r.text}</span></td>
                  <td className="px-4 py-3"><TypeBadge type={r.type} /></td>
                  <td className="whitespace-nowrap px-4 py-3"><ScoreBadge score={r.quality_score} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.is_ambiguous && <Badge variant="warn">Ambiguous</Badge>}
                      {r.is_incomplete && <Badge variant="warn">Incomplete</Badge>}
                      {r.potential_conflicts?.length > 0 && <Badge variant="bad">Conflict</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
