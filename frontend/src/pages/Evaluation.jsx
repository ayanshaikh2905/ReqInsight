import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, FlaskConical } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState, Spinner } from '../components/Card';
import { api } from '../api/client';

export default function Evaluation() {
  const { analysis } = useAnalysis();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!analysis) return;
    setLoading(true);
    api.getMetrics()
      .then(setMetrics)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [analysis]);

  if (!analysis) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          title="No analysis data"
          description="Load a demo SRS or upload a document first."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const cls = metrics?.classification;
  const chartData = cls ? [
    { name: 'Accuracy', value: parseFloat((cls.accuracy * 100).toFixed(1)), fill: '#6366f1' },
    { name: 'Precision', value: parseFloat((cls.precision * 100).toFixed(1)), fill: '#10b981' },
    { name: 'Recall', value: parseFloat((cls.recall * 100).toFixed(1)), fill: '#f59e0b' },
    { name: 'F1 Score', value: parseFloat((cls.f1_score * 100).toFixed(1)), fill: '#a855f7' },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader
        title="Evaluation Metrics"
        subtitle="Empirical performance metrics of the NLP pipeline on PROMISE NFR dataset benchmarks"
      />

      {loading && <div className="flex items-center gap-3 py-8"><Spinner /><span className="text-slate-400 text-sm">Loading metrics…</span></div>}
      {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-4">{error}</div>}

      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {chartData.map(({ name, value, fill }) => (
              <div key={name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: fill }}>{value}%</div>
                <div className="text-xs text-slate-400 mt-1">{name}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Classification Performance on PROMISE NFR Benchmark</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
                <Tooltip
                  formatter={(v) => [`${v}%`]}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">All Benchmarks</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 text-left">
                  <th className="py-1.5 pr-3">Task</th>
                  <th className="py-1.5 px-2 text-right">Accuracy</th>
                  <th className="py-1.5 px-2 text-right">Precision</th>
                  <th className="py-1.5 px-2 text-right">Recall</th>
                  <th className="py-1.5 px-2 text-right">F1</th>
                  <th className="py-1.5 pl-2 text-right">n</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  ['Functional / Non-functional', metrics.classification, metrics.classification?.model_description],
                  ['Ambiguity detection', metrics.ambiguity, metrics.ambiguity?.method],
                  ['Duplicate detection', metrics.duplicates, metrics.duplicates?.method],
                ].filter(([, m]) => m).map(([name, m, method]) => (
                  <tr key={name}>
                    <td className="py-2 pr-3">
                      <div className="text-slate-200">{name}</div>
                      {method && <div className="text-xs text-slate-500">{method}</div>}
                    </td>
                    {['accuracy', 'precision', 'recall', 'f1_score'].map(k => (
                      <td key={k} className="py-2 px-2 text-right text-slate-300 font-mono">{(m[k] * 100).toFixed(1)}%</td>
                    ))}
                    <td className="py-2 pl-2 text-right text-slate-500">{m.sample_size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-3">
              Small benchmark sets: treat these as sanity checks, not production accuracy figures.
            </p>
          </div>

          {metrics.dataset_info && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Dataset Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(metrics.dataset_info).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-slate-800">
                    <span className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="text-white font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.model_info && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-indigo-400" /> Model Configuration
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(metrics.model_info).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-slate-800">
                    <span className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="text-white font-medium font-mono text-xs">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
