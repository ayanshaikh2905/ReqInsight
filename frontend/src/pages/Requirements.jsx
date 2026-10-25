import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, FileText, Search, X } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { ArtifactPanel } from '../components/ArtifactPanel';
import { Badge, ScoreBadge, TypeBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState, PageHeader } from '../components/Card';
import { Collapse } from '../components/Collapse';
import { MarkedText } from '../components/MarkedText';
import { NoAnalysis } from '../components/NoAnalysis';
import { Segmented } from '../components/Segmented';
import { ScoreBars } from '../components/ScoreBars';
import { DIMENSIONS, TONE, bandFor } from '../lib/quality';

const SEVERITY_TONE = { danger: 'bad', warning: 'warn', info: 'info' };

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium text-faint">{title}</h4>
      {children}
    </div>
  );
}

function RequirementRow({ req, open, onToggle, flash, duplicate, onFocusRelated }) {
  const tone = TONE[bandFor(req.quality_score).tone];
  const scores = req.scores || {};
  const dims = DIMENSIONS.filter((d) => typeof scores[d] === 'number');
  const notes = [req.ambiguity_explanation, req.incompleteness_explanation, ...String(req.recommendation || '').split(/\r?\n/)]
    .map((n) => n && n.trim())
    .filter(Boolean);
  const panelId = `panel-${req.id}`;

  return (
    <div
      id={`req-${req.id}`}
      className={`relative scroll-mt-28 overflow-hidden rounded-xl border bg-surface transition-colors ${
        open ? 'border-faint/60' : 'border-line'
      } ${flash ? 'row-flash' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bg}`} aria-hidden="true" />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 py-3.5 pl-5 pr-4 text-left transition-colors hover:bg-raised/70"
      >
        <span className="w-24 shrink-0 pt-px font-mono text-xs text-accent">{req.id}</span>
        <TypeBadge type={req.type} />
        <span className={`min-w-0 flex-1 text-sm text-ink ${open ? '' : 'truncate'}`}>{req.text}</span>
        <span className="hidden shrink-0 items-center gap-1.5 md:flex">
          {req.is_ambiguous && <Badge variant="warn">Ambiguous</Badge>}
          {req.is_incomplete && <Badge variant="warn">Incomplete</Badge>}
          {req.potential_conflicts?.length > 0 && <Badge variant="bad">Conflict</Badge>}
          {duplicate && <Badge variant="info">Duplicate</Badge>}
        </span>
        <ScoreBadge score={req.quality_score} className="shrink-0 pt-px" />
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <Collapse open={open} id={panelId}>
        <div className="space-y-6 border-t border-line px-5 pb-5 pt-5 md:pl-[8.25rem]">
          <MarkedText text={req.text} terms={req.ambiguous_terms || []} className="max-w-prose text-[15px] leading-relaxed text-ink" />

          {notes.length > 0 && (
            <ul className="max-w-prose list-disc space-y-1 pl-5 text-sm text-muted">
              {notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}

          {dims.length > 0 && (
            <Section title="Score breakdown">
              <ScoreBars scores={scores} className="max-w-xl" />
            </Section>
          )}

          {req.smells?.length > 0 && (
            <Section title="Smells">
              <ul className="space-y-1.5">
                {req.smells.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant={SEVERITY_TONE[s.severity] || 'warn'}>{s.smell || String(s)}</Badge>
                    {s.description && <span className="text-muted">{s.description}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {req.missing_elements?.length > 0 && (
            <Section title="Missing elements">
              <div className="flex flex-wrap gap-1.5">
                {req.missing_elements.map((m, i) => <Badge key={i} variant="warn">{m}</Badge>)}
              </div>
            </Section>
          )}

          {(req.potential_conflicts?.length > 0 || req.similar_requirements?.length > 0) && (
            <Section title="Related requirements">
              <ul className="space-y-1.5 text-sm">
                {req.potential_conflicts?.map((c, i) => (
                  <li key={`c${i}`} className="flex flex-wrap items-baseline gap-2">
                    <Badge variant="bad">Conflict</Badge>
                    <button type="button" onClick={() => onFocusRelated(c.target_id)} className="font-mono text-xs text-accent hover:underline">{c.target_id}</button>
                    <span className="text-muted">{c.explanation}</span>
                  </li>
                ))}
                {req.similar_requirements?.map((s, i) => (
                  <li key={`s${i}`} className="flex flex-wrap items-baseline gap-2">
                    <Badge variant={s.is_duplicate ? 'info' : 'neutral'}>{s.is_duplicate ? 'Duplicate' : 'Similar'}</Badge>
                    <button type="button" onClick={() => onFocusRelated(s.target_id)} className="font-mono text-xs text-accent hover:underline">{s.target_id}</button>
                    <span className="text-muted">{Math.round(s.similarity * 100)}% match</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {req.entities?.length > 0 && (
            <Section title="Entities">
              <div className="flex flex-wrap gap-1.5">
                {req.entities.map((e, i) => (
                  <span key={i} title={e.explanation} className="rounded-md border border-line px-2 py-0.5 text-xs text-muted">
                    {e.text} <span className="text-faint">{e.category?.toLowerCase()}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          <Section title="Generate">
            <ArtifactPanel text={req.text} />
          </Section>
        </div>
      </Collapse>
    </div>
  );
}

const TYPE_FILTERS = ['all', 'functional', 'non-functional'];
const ISSUE_FILTERS = ['all', 'ambiguous', 'incomplete', 'conflict', 'duplicate'];
const SORTS = {
  doc: { label: 'Document order', fn: null },
  low: { label: 'Lowest quality first', fn: (a, b) => a.quality_score - b.quality_score },
  high: { label: 'Highest quality first', fn: (a, b) => b.quality_score - a.quality_score },
};

export default function Requirements() {
  usePageTitle('Requirements');
  const { analysis } = useAnalysis();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef(null);

  const query = params.get('q') || '';
  const type = TYPE_FILTERS.includes(params.get('type')) ? params.get('type') : 'all';
  const issue = ISSUE_FILTERS.includes(params.get('issue')) ? params.get('issue') : 'all';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'doc';
  const focusId = params.get('focus');

  const [openIds, setOpenIds] = useState(() => new Set(focusId ? [focusId] : []));
  const deferredQuery = useDeferredValue(query);

  const setParam = (key, value, fallback = '') =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  // Deep link (dashboard bars, related-requirement links): open, scroll, flash.
  const [seenFocus, setSeenFocus] = useState(focusId);
  if (focusId !== seenFocus) {
    setSeenFocus(focusId);
    if (focusId) setOpenIds((prev) => new Set(prev).add(focusId));
  }
  useEffect(() => {
    if (!focusId) return undefined;
    const t = setTimeout(() => {
      document.getElementById(`req-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(t);
  }, [focusId]);

  // "/" jumps to search, like most list UIs.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const all = useMemo(() => analysis?.requirements || [], [analysis]);
  const duplicateIds = useMemo(
    () => new Set((analysis?.duplicates || []).flatMap((p) => [p.req_a_id, p.req_b_id])),
    [analysis],
  );

  const matchers = useMemo(
    () => ({
      type: (r, v) => v === 'all' || r.type.toLowerCase() === v,
      issue: (r, v) =>
        v === 'all' ||
        (v === 'ambiguous' && r.is_ambiguous) ||
        (v === 'incomplete' && r.is_incomplete) ||
        (v === 'conflict' && r.potential_conflicts?.length > 0) ||
        (v === 'duplicate' && duplicateIds.has(r.id)),
    }),
    [duplicateIds],
  );

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = all.filter(
      (r) =>
        matchers.type(r, type) &&
        matchers.issue(r, issue) &&
        (!q || r.text.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.topic || '').toLowerCase().includes(q)),
    );
    const fn = SORTS[sort].fn;
    return fn ? [...list].sort(fn) : list;
  }, [all, matchers, type, issue, sort, deferredQuery]);

  const count = (key, value) => all.filter((r) => matchers[key](r, value)).length;

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });
  const filtered = query || type !== 'all' || issue !== 'all';

  if (!analysis) {
    return (
      <>
        <PageHeader title="Requirements" subtitle="Every extracted requirement with its score, issues and generated artifacts." />
        <NoAnalysis icon={FileText} what="the requirements list" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Requirements"
        subtitle={`${visible.length} of ${all.length} requirements${filtered ? ' match your filters' : ''}.`}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setOpenIds(openIds.size ? new Set() : new Set(visible.map((r) => r.id)))}>
            {openIds.size ? 'Collapse all' : 'Expand all'}
          </Button>
        }
      />

      <div className="sticky top-0 z-10 -mx-5 mb-5 border-b border-line bg-canvas/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search text, ID or topic  ( / )"
              aria-label="Search requirements"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setParam('q', '')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value, 'doc')}
            aria-label="Sort requirements"
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
          >
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="-mb-1 mt-3 flex gap-3 overflow-x-auto pb-1">
          <Segmented
            label="Requirement type"
            value={type}
            onChange={(v) => setParam('type', v, 'all')}
            options={[
              { value: 'all', label: 'All', count: all.length },
              { value: 'functional', label: 'Functional', count: count('type', 'functional') },
              { value: 'non-functional', label: 'Non-functional', count: count('type', 'non-functional') },
            ]}
          />
          <Segmented
            label="Issue"
            value={issue}
            onChange={(v) => setParam('issue', v, 'all')}
            options={[
              { value: 'all', label: 'Any issue' },
              { value: 'ambiguous', label: 'Ambiguous', count: count('issue', 'ambiguous') },
              { value: 'incomplete', label: 'Incomplete', count: count('issue', 'incomplete') },
              { value: 'conflict', label: 'Conflict', count: count('issue', 'conflict') },
              { value: 'duplicate', label: 'Duplicate', count: count('issue', 'duplicate') },
            ]}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No requirements match"
          description="Try a different search term, or clear the filters to see everything."
          action={<Button onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((req) => (
            <RequirementRow
              key={req.id}
              req={req}
              open={openIds.has(req.id)}
              onToggle={() => toggle(req.id)}
              flash={focusId === req.id}
              duplicate={duplicateIds.has(req.id)}
              onFocusRelated={(id) => setParams({ focus: id }, { replace: true })}
            />
          ))}
        </div>
      )}
    </>
  );
}
