import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import {
  FileText, Zap, Shield, AlertTriangle, Copy, GitMerge,
  Star, TrendingUp, FlaskConical, UploadCloud
} from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { StatCard, EmptyState, Spinner, PageHeader } from '../components/Card';
import { Badge } from '../components/Badge';

const QUAL_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444'];
const PIE_COLORS = ['#6366f1', '#a855f7'];

export default function Dashboard() {
  const { analysis, loading, loadDemo, progress } = useAnalysis();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Spinner size="lg" />
        <div className="text-slate-400 text-sm">Running NLP analysis pipeline... {progress}%</div>
        <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8">
        <PageHeader title="ReqInsight AI Dashboard" subtitle="Intelligent Software Requirement Analysis & Specification Generation" />
        <EmptyState
          icon={FileText}
          title="No SRS document analyzed yet"
          description="Upload a PDF, DOCX, or TXT Software Requirement Specification, or load the academic demo to explore all features."
          action={
            <div className="flex gap-3">
              <button
                id="btn-load-demo"
                onClick={loadDemo}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-indigo-900/40"
              >
                <FlaskConical className="w-4 h-4" /> Load Professor Demo SRS
              </button>
              <button
                id="btn-go-upload"
                onClick={() => navigate('/upload')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors border border-slate-700"
              >
                <UploadCloud className="w-4 h-4" /> Upload SRS Document
              </button>
            </div>
          }
        />
      </div>
    );
  }

  const s = analysis.summary;

  const qualData = Object.entries(s.quality_distribution || {}).map(([label, count]) => ({ label, count }));
  const smellData = Object.entries(s.smell_distribution || {}).slice(0, 6).map(([name, count]) => ({ name, count }));
  const topicData = (s.topic_distribution || []).slice(0, 8).map(t => ({ name: t.topic, count: t.count }));
  const pieData = [
    { name: 'Functional', value: s.functional_count },
    { name: 'Non-Functional', value: s.non_functional_count }
  ];

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">
      <PageHeader
        title="Dashboard"
        subtitle={`Analysis of: ${analysis.document_name}`}
        actions={
          <button
            id="btn-demo-reload"
            onClick={loadDemo}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs font-medium hover:bg-indigo-600/30 border border-indigo-800/50 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5" /> Reload Demo
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Requirements" value={s.total_requirements} color="indigo" />
        <StatCard icon={Zap} label="Functional" value={s.functional_count} color="emerald" />
        <StatCard icon={Shield} label="Non-Functional" value={s.non_functional_count} color="purple" />
        <StatCard icon={Star} label="Avg Quality Score" value={`${s.average_quality_score}/100`} color="amber" />
        <StatCard icon={AlertTriangle} label="Potentially Ambiguous" value={s.ambiguous_count} color="amber" />
        <StatCard icon={FileText} label="Incomplete" value={s.incomplete_count} color="red" />
        <StatCard icon={Copy} label="Duplicate Pairs" value={s.duplicate_pairs_count} color="sky" />
        <StatCard icon={GitMerge} label="Conflict Pairs" value={s.conflict_pairs_count} color="red" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Functional vs NFR Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Functional vs Non-Functional</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quality Distribution Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Quality Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={qualData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {qualData.map((_, i) => <Cell key={i} fill={QUAL_COLORS[i % QUAL_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Smell Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Requirement Smell Types</h3>
          <div className="space-y-2 mt-2">
            {smellData.map(({ name, count }) => (
              <div key={name} className="flex items-center gap-3">
                <div className="text-xs text-slate-400 w-36 truncate">{name}</div>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, (count / (s.total_requirements || 1)) * 100)}%` }}
                  />
                </div>
                <div className="text-xs font-mono text-slate-400 w-5 text-right">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Topics & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Topic discovery */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" /> Discovered Topic Clusters
          </h3>
          <div className="space-y-2">
            {topicData.map(({ name, count }) => (
              <div key={name} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                <span className="text-sm text-slate-300 truncate">{name}</span>
                <Badge variant="indigo">{count} reqs</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Top issues requirements */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">⚠️ Top Issues Found</h3>
          <div className="space-y-3">
            {analysis.requirements
              .filter(r => r.quality_score < 70 || r.is_ambiguous || r.is_incomplete || r.potential_conflicts?.length > 0)
              .slice(0, 5)
              .map(r => (
                <div key={r.id} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
                  <div className="text-xs font-mono text-indigo-400 font-bold mt-0.5 w-20 flex-shrink-0">{r.id}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-300 truncate">{r.text}</div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {r.is_ambiguous && <Badge variant="amber">Ambiguous</Badge>}
                      {r.is_incomplete && <Badge variant="warning">Incomplete</Badge>}
                      {r.potential_conflicts?.length > 0 && <Badge variant="danger">Conflict</Badge>}
                      <Badge variant={r.quality_score >= 70 ? 'success' : 'danger'}>{r.quality_score}/100</Badge>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
