import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Star } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { useAnalysis } from '../context/AnalysisContext';
import { useThemeColors } from '../context/ThemeContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Badge, ScoreBadge } from '../components/Badge';
import { Card, PageHeader, SectionTitle, Stat, StatStrip } from '../components/Card';
import { Collapse } from '../components/Collapse';
import { NoAnalysis } from '../components/NoAnalysis';
import { ScoreBars } from '../components/ScoreBars';
import { Segmented } from '../components/Segmented';
import { BANDS, DIMENSIONS, TONE, bandFor, toneForScore } from '../lib/quality';

function ScoreRow({ req }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[bandFor(req.quality_score).tone];
  const id = `score-${req.id}`;
  return (
    <li className="relative overflow-hidden rounded-xl border border-line bg-surface">
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bg}`} aria-hidden="true" />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 py-3 pl-5 pr-4 text-left transition-colors hover:bg-raised/70"
      >
        <span className="w-24 shrink-0 font-mono text-xs text-accent">{req.id}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{req.text}</span>
        <span className="hidden w-28 shrink-0 sm:block">
          <span className="block h-1.5 overflow-hidden rounded-full bg-line/70">
            <span className={`bar-run block h-full rounded-full ${tone.bg}`} style={{ width: `${req.quality_score}%` }} />
          </span>
        </span>
        <ScoreBadge score={req.quality_score} className="shrink-0" />
        <ChevronDown className={`h-4 w-4 shrink-0 text-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <Collapse open={open} id={id}>
        <div className="space-y-3 border-t border-line px-5 py-4 md:pl-[8.25rem]">
          <ScoreBars scores={req.scores} className="max-w-xl" />
          <div className="flex flex-wrap items-center gap-2">
            {req.is_ambiguous && <Badge variant="warn">Ambiguous</Badge>}
            {req.is_incomplete && <Badge variant="warn">Incomplete</Badge>}
            {(req.smells || []).map((s, i) => <Badge key={i}>{s.smell}</Badge>)}
            <Link to={`/requirements?focus=${encodeURIComponent(req.id)}`} className="ml-auto text-xs text-accent hover:underline">
              Open in Requirements
            </Link>
          </div>
        </div>
      </Collapse>
    </li>
  );
}

export default function QualityAnalysis() {
  usePageTitle('Quality');
  const { analysis } = useAnalysis();
  const colors = useThemeColors();
  const [band, setBand] = useState('all');
  const [order, setOrder] = useState('low');

  const reqs = useMemo(() => analysis?.requirements || [], [analysis]);

  const averages = useMemo(
    () =>
      DIMENSIONS.map((d) => {
        const vals = reqs.map((r) => r.scores?.[d]).filter((v) => typeof v === 'number');
        return { dimension: d, value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 };
      }),
    [reqs],
  );

  const counts = useMemo(
    () => Object.fromEntries(BANDS.map((b) => [b.key, reqs.filter((r) => bandFor(r.quality_score).key === b.key).length])),
    [reqs],
  );

  const list = useMemo(() => {
    const filtered = band === 'all' ? reqs : reqs.filter((r) => bandFor(r.quality_score).key === band);
    return [...filtered].sort((a, b) => (order === 'low' ? a.quality_score - b.quality_score : b.quality_score - a.quality_score));
  }, [reqs, band, order]);

  if (!analysis) {
    return (
      <>
        <PageHeader title="Quality" subtitle="How clear, complete and testable the requirements are." />
        <NoAnalysis icon={Star} what="quality scores" />
      </>
    );
  }

  const s = analysis.summary;
  const smelly = reqs.filter((r) => (r.smells || []).length > 0).length;
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <>
      <PageHeader
        title="Quality"
        subtitle="Each requirement is scored on clarity, completeness, specificity, consistency, testability and uniqueness."
      />

      <StatStrip>
        <Stat label="Average score" value={s.average_quality_score} decimals={1} tone={TONE[toneForScore(s.average_quality_score)].text} />
        <Stat label="Strong (75 or higher)" value={counts.excellent + counts.good} tone="text-ok" delay={80} />
        <Stat label="Needs work (below 60)" value={counts.poor} tone={counts.poor ? 'text-bad' : 'text-ink'} delay={160} />
        <Stat label="With smells" value={smelly} delay={240} />
      </StatStrip>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionTitle aside="average across requirements">Dimensions</SectionTitle>
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <div className="h-56" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={averages} outerRadius="62%" margin={{ left: 30, right: 30 }}>
                  <PolarGrid stroke={colors.line} />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: colors.muted, fontSize: 11 }} tickFormatter={(v) => v[0].toUpperCase() + v.slice(1)} />
                  <Radar dataKey="value" stroke={colors.accent} strokeWidth={2} fill={colors.accent} fillOpacity={0.22} animationDuration={1100} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm sm:min-w-[9rem]">
              {averages.map((a) => (
                <li key={a.dimension} className="flex items-baseline justify-between gap-4">
                  <span className="capitalize text-muted">{a.dimension}</span>
                  <span className={`font-mono text-xs tabular-nums ${TONE[toneForScore(a.value)].text}`}>{a.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle aside="requirements per band">Score bands</SectionTitle>
          <div className="space-y-5">
            {BANDS.map((b, i) => (
              <div key={b.key}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="text-ink">{b.label} <span className="text-xs text-faint">{b.range}</span></span>
                  <span className="font-mono text-xs tabular-nums text-muted">{counts[b.key]}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-line/70">
                  <div className={`bar-run h-full rounded-full ${TONE[b.tone].bg}`} style={{ width: `${(counts[b.key] / maxCount) * 100}%`, animationDelay: `${i * 90}ms` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">All requirements</h2>
          <div className="flex flex-wrap gap-3">
            <Segmented
              label="Score band"
              value={band}
              onChange={setBand}
              options={[{ value: 'all', label: 'All', count: reqs.length }, ...BANDS.map((b) => ({ value: b.key, label: b.label, count: counts[b.key] }))]}
            />
            <Segmented
              label="Sort order"
              value={order}
              onChange={setOrder}
              options={[{ value: 'low', label: 'Lowest first' }, { value: 'high', label: 'Highest first' }]}
            />
          </div>
        </div>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">No requirements fall in this band.</p>
        ) : (
          <ul className="space-y-2.5">{list.map((r) => <ScoreRow key={r.id} req={r} />)}</ul>
        )}
      </section>
    </>
  );
}
