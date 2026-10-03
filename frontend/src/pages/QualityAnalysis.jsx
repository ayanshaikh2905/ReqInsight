import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState, StatCard } from '../components/Card';
import { ScoreBadge, Badge } from '../components/Badge';

const SCORE_COLOR = (s) => s >= 85 ? '#10b981' : s >= 65 ? '#f59e0b' : '#ef4444';

function RequirementScoreRow({ req }) {
  const [exp, setExp] = useState(false);
  const color = SCORE_COLOR(req.quality_score);
  const breakdown = req.quality_breakdown || {};
  return (
    <div className="border border-slate-800 rounded-lg">
      <div
        onClick={() => setExp(!exp)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
      >
        <span className="font-mono text-xs text-indigo-400 w-24 flex-shrink-0">{req.id}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-300 truncate">{req.text}</div>
        </div>
        {req.is_ambiguous && <Badge variant="warning">Ambiguous</Badge>}
        {req.is_incomplete && <Badge variant="danger">Incomplete</Badge>}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${req.quality_score}%`, background: color }} />
          </div>
          <ScoreBadge score={req.quality_score} />
          {exp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>
      {exp && Object.keys(breakdown).length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-900">
          <p className="text-xs text-slate-500 mb-3">Score Breakdown</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(breakdown).map(([k, v]) => (
              <div key={k} className="bg-slate-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold" style={{ color: SCORE_COLOR(v) }}>{v}</div>
                <div className="text-xs text-slate-400 mt-0.5 capitalize">{k.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QualityAnalysis() {
  const { analysis } = useAnalysis();
  const navigate = useNavigate();

  if (!analysis) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Star}
          title="No analysis data"
          description="Load a demo SRS or upload a document first."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const s = analysis.summary;
  const reqs = analysis.requirements || [];
  const sorted = [...reqs].sort((a, b) => a.quality_score - b.quality_score);

  const histData = [
    { label: '0-25', count: reqs.filter(r => r.quality_score < 25).length, fill: '#ef4444' },
    { label: '25-50', count: reqs.filter(r => r.quality_score >= 25 && r.quality_score < 50).length, fill: '#f59e0b' },
    { label: '50-75', count: reqs.filter(r => r.quality_score >= 50 && r.quality_score < 75).length, fill: '#6366f1' },
    { label: '75-100', count: reqs.filter(r => r.quality_score >= 75).length, fill: '#10b981' },
  ];

  const totalRequirements = Math.max(1, s.total_requirements);
  const radarData = [
    { axis: 'Completeness', value: 100 - (s.incomplete_count / totalRequirements) * 100 },
    { axis: 'Clarity', value: 100 - (s.ambiguous_count / totalRequirements) * 100 },
    { axis: 'Consistency', value: 100 - (s.conflict_pairs_count / Math.max(1, s.total_requirements)) * 100 },
    { axis: 'Uniqueness', value: 100 - (s.duplicate_pairs_count / Math.max(1, s.total_requirements)) * 100 },
    { axis: 'Quality Avg', value: s.average_quality_score },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <PageHeader
        title="Quality Analysis"
        subtitle="Composite quality scoring based on completeness, clarity, consistency, and uniqueness"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Star} label="Average Quality" value={`${s.average_quality_score}/100`} color="amber" />
        <StatCard icon={CheckCircle2} label="High Quality (≥85)" value={histData[3].count} color="emerald" />
        <StatCard icon={AlertCircle} label="Poor Quality (<50)" value={histData[0].count + histData[1].count} color="red" />
        <StatCard icon={AlertCircle} label="Smelly Requirements" value={reqs.filter(r => (r.smells || []).length > 0).length} color="amber" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Quality Score Histogram</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {histData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Quality Radar</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Radar dataKey="value" fill="#6366f1" fillOpacity={0.3} stroke="#6366f1" strokeWidth={2} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sorted list */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">All Requirements — Sorted by Quality</h3>
        <div className="space-y-2">
          {sorted.map(req => <RequirementScoreRow key={req.id} req={req} />)}
        </div>
      </div>
    </div>
  );
}
