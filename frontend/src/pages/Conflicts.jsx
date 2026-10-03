import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState, StatCard } from '../components/Card';

export default function Conflicts() {
  const { analysis } = useAnalysis();
  const navigate = useNavigate();

  if (!analysis) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="No analysis data"
          description="Load a demo SRS or upload a document first."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const conflicts = analysis.conflicts || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="Conflict Detection"
        subtitle="Requirements with logical or numerical contradictions identified by rule-based conflict analysis"
      />

      <StatCard icon={AlertTriangle} label="Conflict Pairs Found" value={conflicts.length} color="red" />

      {conflicts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-900/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold text-emerald-300 mb-2">No Conflicts Detected</h3>
          <p className="text-sm text-slate-400">No logical contradictions found between the requirements.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((c, i) => {
            const desc = c.explanation || c.conflict_type || 'Contradiction';
            return (
              <div key={i} className="bg-slate-900 border border-red-800/40 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-800 bg-red-950/20">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-300">{desc}</span>
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-4">
                  {[[c.req_a_id, c.req_a_text], [c.req_b_id, c.req_b_text]].map(([id, text], j) => (
                    <div key={j} className="rounded-lg bg-slate-800 p-3 space-y-1.5">
                      <span className="text-xs font-mono font-bold text-indigo-400">{id || `Req ${j + 1}`}</span>
                      <p className="text-sm text-slate-200">{text || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
