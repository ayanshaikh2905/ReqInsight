import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Download } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState } from '../components/Card';
import { Badge, TypeBadge, ScoreBadge } from '../components/Badge';
import { api } from '../api/client';

export default function Report() {
  const { analysis } = useAnalysis();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(null);

  if (!analysis) {
    return (
      <div className="p-6">
        <EmptyState
          icon={BookOpen}
          title="No analysis data"
          description="Load a demo SRS or upload a document first."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const res = await api.exportReport(format);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reqinsight_report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(null);
    }
  };

  const s = analysis.summary;
  const reqs = analysis.requirements || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="Analysis Report"
        subtitle={`Full report for: ${analysis.document_name}`}
        actions={
          <div className="flex gap-2">
            {['json', 'csv', 'pdf'].map(fmt => (
              <button
                key={fmt}
                id={`btn-export-${fmt}`}
                onClick={() => handleExport(fmt)}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      {/* Executive summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-base font-bold text-white">📋 Executive Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[
            { label: 'Total Requirements', value: s.total_requirements },
            { label: 'Functional', value: s.functional_count },
            { label: 'Non-Functional', value: s.non_functional_count },
            { label: 'Avg Quality', value: `${s.average_quality_score}/100` },
            { label: 'Ambiguous', value: s.ambiguous_count },
            { label: 'Incomplete', value: s.incomplete_count },
            { label: 'Duplicate Pairs', value: s.duplicate_pairs_count },
            { label: 'Conflict Pairs', value: s.conflict_pairs_count },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-3">
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Findings narrative */}
        <div className="text-sm text-slate-300 leading-relaxed space-y-2">
          <p>
            The analyzed document <strong className="text-white">"{analysis.document_name}"</strong> contains{' '}
            <strong className="text-white">{s.total_requirements}</strong> identified requirements —{' '}
            <strong className="text-emerald-400">{s.functional_count}</strong> functional and{' '}
            <strong className="text-purple-400">{s.non_functional_count}</strong> non-functional.
          </p>
          <p>
            The average quality score is <strong style={{ color: s.average_quality_score >= 70 ? '#10b981' : '#f59e0b' }}>{s.average_quality_score}/100</strong>.{' '}
            {s.ambiguous_count > 0 && <>{s.ambiguous_count} requirements were flagged as potentially ambiguous. </>}
            {s.incomplete_count > 0 && <>{s.incomplete_count} requirements appear incomplete.</>}
          </p>
          {s.duplicate_pairs_count > 0 && <p>{s.duplicate_pairs_count} duplicate pairs were detected using semantic similarity analysis.</p>}
          {s.conflict_pairs_count > 0 && <p className="text-amber-300">{s.conflict_pairs_count} potential conflicts were identified between requirements.</p>}
        </div>
      </div>

      {/* Requirement Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">Full Requirements Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">ID</th>
                <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">Text</th>
                <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">Type</th>
                <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">Quality</th>
                <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reqs.map(req => (
                <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-indigo-400 font-bold">{req.id}</td>
                  <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate" title={req.text}>{req.text}</td>
                  <td className="px-4 py-2.5"><TypeBadge type={req.type} /></td>
                  <td className="px-4 py-2.5"><ScoreBadge score={req.quality_score} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {req.is_ambiguous && <Badge variant="warning">Ambiguous</Badge>}
                      {req.is_incomplete && <Badge variant="danger">Incomplete</Badge>}
                      {req.potential_conflicts?.length > 0 && <Badge variant="danger">Conflict</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
