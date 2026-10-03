import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState, Spinner } from '../components/Card';
import { TypeBadge } from '../components/Badge';
import { api } from '../api/client';

function ArtifactCard({ req }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('story');
  const [story, setStory] = useState(null);
  const [ac, setAc] = useState(null);
  const [rewrite, setRewrite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = async () => {
    if (tab === 'story' && story) return;
    if (tab === 'ac' && ac) return;
    if (tab === 'rewrite' && rewrite) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'story') setStory(await api.generateUserStory(req.text));
      else if (tab === 'ac') setAc(await api.generateAcceptanceCriteria(req.text));
      else setRewrite(await api.rewrite(req.text));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <div
        onClick={() => { setExpanded(!expanded); if (!expanded) generate(); }}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-mono text-xs text-indigo-400 w-24 flex-shrink-0">{req.id}</span>
        <TypeBadge type={req.type} />
        <p className="flex-1 text-sm text-slate-300 truncate">{req.text}</p>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </div>
      {expanded && (
        <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3">
          <div className="flex gap-1.5 rounded-lg bg-slate-800 p-1 w-fit">
            {['story', 'ac', 'rewrite'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'story' && !story) api.generateUserStory(req.text).then(setStory);
                  else if (t === 'ac' && !ac) api.generateAcceptanceCriteria(req.text).then(setAc);
                  else if (t === 'rewrite' && !rewrite) api.rewrite(req.text).then(setRewrite); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
              >
                {t === 'story' ? '📖 User Story' : t === 'ac' ? '✅ Acceptance Criteria' : '✏️ Rewritten'}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-4"><Spinner size="sm" /><span className="text-xs text-slate-400">Generating with LLM…</span></div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-200">
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {tab === 'story' && story && (
                <div>
                  <p className="text-purple-300 font-semibold mb-2">📖 {story.user_story}</p>
                  {story.acceptance_criteria?.length > 0 && (
                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                      {story.acceptance_criteria.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {tab === 'ac' && ac && (
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  {(ac.acceptance_criteria || []).map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              )}
              {tab === 'rewrite' && rewrite && (
                <p className="text-slate-200 leading-relaxed">{rewrite.improved_text || rewrite.rewritten || JSON.stringify(rewrite)}</p>
              )}
              {((tab === 'story' && !story) || (tab === 'ac' && !ac) || (tab === 'rewrite' && !rewrite)) && (
                <p className="text-slate-500 text-xs">Generating…</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Artifacts() {
  const { analysis } = useAnalysis();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  if (!analysis) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Sparkles}
          title="No analysis data"
          description="Load a demo SRS or upload a document first."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const reqs = (analysis.requirements || []).filter(r =>
    !search || r.text.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <PageHeader
        title="Generated Artifacts"
        subtitle="AI-generated user stories, acceptance criteria, and rewritten requirements using LLM"
      />
      <div className="flex gap-2 items-center bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter requirements…"
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
        />
      </div>
      <p className="text-xs text-slate-500">Click a requirement to expand it and generate AI artifacts on demand.</p>
      <div className="space-y-2">
        {reqs.map(req => <ArtifactCard key={req.id} req={req} />)}
      </div>
    </div>
  );
}
