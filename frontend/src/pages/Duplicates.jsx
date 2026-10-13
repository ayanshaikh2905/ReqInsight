import { useState, useEffect } from 'react';
import { Copy, AlertCircle, GitMerge } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState, Spinner, StatCard } from '../components/Card';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function Duplicates() {
  const { analysis } = useAnalysis();
  // null threshold = the pairs computed with the analysis' own threshold (no request needed).
  const [threshold, setThreshold] = useState(null);
  const [duplicates, setDuplicates] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!analysis || threshold == null) return;
    let cancelled = false;
    // Debounce slider drags; the backend re-thresholds a cached similarity matrix.
    const timer = setTimeout(() => {
      setLoading(true);
      api.getDuplicates(threshold)
        .then(result => { if (!cancelled) setDuplicates(result); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [analysis, threshold]);

  if (!analysis) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Copy}
          title="No analysis data"
          description="Load a demo SRS or upload a document first."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const pairs = threshold != null && Array.isArray(duplicates) ? duplicates : (analysis?.duplicates || []);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="Duplicate Requirements"
        subtitle="Semantically similar requirements detected via SBERT/TF-IDF cosine similarity"
      />

      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-4">
        <label htmlFor="dup-threshold" className="text-sm text-slate-300 whitespace-nowrap">Similarity threshold</label>
        <input
          id="dup-threshold"
          type="range"
          min={0.5}
          max={0.99}
          step={0.01}
          value={threshold ?? 0.85}
          onChange={e => setThreshold(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-500"
        />
        <span className="text-xs font-bold text-indigo-400 w-10 text-right">{(threshold ?? 0.85).toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Copy} label="Duplicate Pairs Found" value={pairs.length} color="amber" />
        <StatCard icon={GitMerge} label="Conflict Pairs Found" value={analysis.summary?.conflict_pairs_count || 0} color="red" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : pairs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-900/30 flex items-center justify-center mb-4">
            <Copy className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold text-emerald-300 mb-2">No Duplicates Found</h3>
          <p className="text-sm text-slate-400">All requirements are sufficiently distinct at the current threshold.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair, i) => (
            <div key={i} className="bg-slate-900 border border-amber-800/40 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-800 bg-amber-950/20">
                <span className="text-xs font-semibold text-amber-400">Pair #{i + 1}</span>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    {((pair.similarity ?? pair.score ?? 0) * 100).toFixed(1)}% similar
                  </span>
                </div>
              </div>
              <div className="p-4 grid md:grid-cols-2 gap-4">
                {[[pair.req_a_id, pair.req_a_text], [pair.req_b_id, pair.req_b_text]].map(([id, text]) => (
                  <div key={id} className="rounded-lg bg-slate-800 p-3 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-indigo-400">{id}</span>
                    <p className="text-sm text-slate-200">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
