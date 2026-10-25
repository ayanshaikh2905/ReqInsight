import { Link, useNavigate } from 'react-router-dom';
import { FlaskConical, UploadCloud } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Button, LinkButton } from '../components/Button';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Badge, ScoreBadge } from '../components/Badge';
import { Card, InlineError, PageHeader, SectionTitle, Stat, StatStrip } from '../components/Card';
import { GhostSkyline, HealthStrip } from '../components/HealthStrip';
import { BANDS, TONE, bandFor, hasIssues } from '../lib/quality';

function Bar({ value, max, tone = 'accent', delay = 0 }) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line/70">
      <div className={`bar-run h-full rounded-full ${TONE[tone].bg}`} style={{ width: `${pct}%`, animationDelay: `${delay}ms` }} />
    </div>
  );
}

function DashboardEmpty() {
  const { loadDemo, loading, error } = useAnalysis();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Review a requirements document"
        subtitle="ReqInsight reads a Software Requirements Specification and shows where requirements are vague, duplicated, in conflict or incomplete."
      />
      {error && <InlineError className="mb-6">{error}</InlineError>}
      <Card className="overflow-hidden p-6 sm:p-8">
        <GhostSkyline />
        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-md">
            <h2 className="font-display text-xl font-semibold text-ink">Start with a document</h2>
            <p className="mt-1.5 text-sm text-muted">
              Upload a PDF, DOCX or TXT file, or load the built-in sample. The sample runs entirely offline, so no API key is needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              onClick={() => loadDemo().catch(() => {})}
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" /> Load the demo SRS
            </Button>
            <Button size="lg" onClick={() => navigate('/upload')}>
              <UploadCloud className="h-4 w-4" aria-hidden="true" /> Upload a document
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

function DashboardView({ analysis }) {
  const { loadDemo } = useAnalysis();
  const s = analysis.summary;
  const reqs = analysis.requirements || [];
  const total = s.total_requirements || reqs.length || 0;
  const band = bandFor(s.average_quality_score);

  const bandCounts = BANDS.map((b, i) => ({
    ...b,
    count: reqs.filter((r) => bandFor(r.quality_score).key === b.key).length,
    delay: 500 + i * 90,
  }));
  const smells = Object.entries(s.smell_distribution || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topics = (s.topic_distribution || []).slice(0, 8);
  const smelly = reqs.filter((r) => (r.smells || []).length > 0).length;
  const attention = reqs
    .filter((r) => hasIssues(r) || r.quality_score < 75)
    .sort((a, b) => a.quality_score - b.quality_score)
    .slice(0, 6);
  const functionalShare = total ? (s.functional_count / total) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={analysis.document_name}
        actions={
          <>
            <Button size="sm" onClick={() => loadDemo().catch(() => {})}>
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" /> Reload demo
            </Button>
            <LinkButton to="/upload" size="sm" variant="primary">
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" /> Analyze another
            </LinkButton>
          </>
        }
      />

      <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
        <div>
          <div className="text-sm text-muted">Average quality score</div>
          <div className={`mt-2 font-display text-[88px] font-semibold leading-[0.9] tracking-[-0.04em] sm:text-[112px] ${TONE[band.tone].text}`}>
            <AnimatedNumber value={s.average_quality_score} decimals={1} duration={1400} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Badge variant={band.tone}>{band.label}</Badge>
            across {total} requirement{total === 1 ? '' : 's'}
          </div>
        </div>

        <StatStrip cols={3}>
          <Stat to="/requirements" label="Requirements" value={total} hint={`${s.functional_count} functional, ${s.non_functional_count} non-functional`} delay={150} />
          <Stat to="/requirements?issue=ambiguous" label="Ambiguous" value={s.ambiguous_count} tone={s.ambiguous_count ? 'text-warn' : 'text-ink'} delay={230} />
          <Stat to="/requirements?issue=incomplete" label="Incomplete" value={s.incomplete_count} tone={s.incomplete_count ? 'text-warn' : 'text-ink'} delay={310} />
          <Stat to="/duplicates" label="Duplicate pairs" value={s.duplicate_pairs_count} delay={390} />
          <Stat to="/conflicts" label="Conflict pairs" value={s.conflict_pairs_count} tone={s.conflict_pairs_count ? 'text-bad' : 'text-ink'} delay={470} />
          <Stat to="/quality" label="With smells" value={smelly} delay={550} />
        </StatStrip>
      </section>

      <Card className="mt-8 p-5 sm:p-6">
        <SectionTitle aside={`${reqs.length} requirements in document order`}>Quality across the document</SectionTitle>
        <HealthStrip requirements={reqs} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionTitle>Composition</SectionTitle>
          <div className="flex h-3 overflow-hidden rounded-full bg-line/70">
            <div className="bar-run h-full bg-accent" style={{ width: `${functionalShare}%`, animationDelay: '600ms' }} />
            <div className="bar-run h-full bg-info/70" style={{ width: `${100 - functionalShare}%`, animationDelay: '700ms' }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" />Functional <span className="font-mono text-ink">{s.functional_count}</span></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-info/70" />Non-functional <span className="font-mono text-ink">{s.non_functional_count}</span></span>
          </div>

          <div className="mt-8 space-y-4">
            {bandCounts.map((b) => (
              <div key={b.key}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="text-ink">{b.label} <span className="text-xs text-faint">{b.range}</span></span>
                  <span className="font-mono text-xs tabular-nums text-muted">{b.count}</span>
                </div>
                <Bar value={b.count} max={Math.max(...bandCounts.map((x) => x.count), 1)} tone={b.tone} delay={b.delay} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle aside={smells.length ? 'requirements affected' : null}>Most common smells</SectionTitle>
          {smells.length === 0 ? (
            <p className="text-sm text-muted">No requirement smells were detected in this document.</p>
          ) : (
            <div className="space-y-4">
              {smells.map(([name, count], i) => (
                <div key={name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">{count}</span>
                  </div>
                  <Bar value={count} max={smells[0][1]} tone="warn" delay={600 + i * 80} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle aside={`${topics.length} clusters`}>Topics</SectionTitle>
          {topics.length === 0 ? (
            <p className="text-sm text-muted">No topic clusters were found.</p>
          ) : (
            <ul className="space-y-3.5">
              {topics.map((t, i) => (
                <li key={t.topic}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{t.topic}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">{t.count}</span>
                  </div>
                  <Bar value={t.count} max={topics[0].count} tone="accent" delay={650 + i * 70} />
                  {t.keywords?.length > 0 && <p className="mt-1.5 truncate text-xs text-faint">{t.keywords.slice(0, 5).join(', ')}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle aside={attention.length ? 'lowest scores first' : null}>Needs attention</SectionTitle>
          {attention.length === 0 ? (
            <p className="text-sm text-muted">Every requirement scores 75 or above with no open issues.</p>
          ) : (
            <ul className="-mx-2 divide-y divide-line">
              {attention.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/requirements?focus=${encodeURIComponent(r.id)}`}
                    className="group flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-raised"
                  >
                    <span className="w-20 shrink-0 pt-0.5 font-mono text-xs text-accent">{r.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm text-muted transition-colors group-hover:text-ink">{r.text}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.is_ambiguous && <Badge variant="warn">Ambiguous</Badge>}
                        {r.is_incomplete && <Badge variant="warn">Incomplete</Badge>}
                        {r.potential_conflicts?.length > 0 && <Badge variant="bad">Conflict</Badge>}
                      </span>
                    </span>
                    <ScoreBadge score={r.quality_score} className="pt-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export default function Dashboard() {
  usePageTitle('Dashboard');
  const { analysis, loading, progress } = useAnalysis();
  if (loading) return <AnalysisProgress progress={progress} />;
  if (!analysis) return <DashboardEmpty />;
  return <DashboardView analysis={analysis} />;
}
