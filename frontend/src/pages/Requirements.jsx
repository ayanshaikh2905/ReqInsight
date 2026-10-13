import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, Sparkles, BookOpen, Check } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { PageHeader, EmptyState, Spinner } from '../components/Card';
import { Badge, TypeBadge, ScoreBadge } from '../components/Badge';
import { api } from '../api/client';
import { Upload } from 'lucide-react';

function RequirementRow({ req, hasDuplicate }) {
  const [expanded, setExpanded] = useState(false);
  const [artifact, setArtifact] = useState(null);
  const [artifactError, setArtifactError] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async (type) => {
    setLoading(type);
    setArtifactError(null);
    try {
      let result;
      if (type === 'rewrite') result = await api.rewrite(req.text);
      else if (type === 'story') result = await api.generateUserStory(req.text);
      else result = await api.generateAcceptanceCriteria(req.text);
      setArtifact({ type, data: result });
    } catch (e) {
      setArtifactError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const smells = req.smells || [];

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-mono font-bold text-indigo-400 w-24 flex-shrink-0">{req.id}</span>
        <TypeBadge type={req.type} />
        <p className="flex-1 text-sm text-slate-300 truncate">{req.text}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {req.is_ambiguous && <Badge variant="warning">Ambiguous</Badge>}
          {req.is_incomplete && <Badge variant="danger">Incomplete</Badge>}
          {req.potential_conflicts?.length > 0 && <Badge variant="danger">Conflict</Badge>}
          {hasDuplicate && <Badge variant="warning">Duplicate</Badge>}
          <ScoreBadge score={req.quality_score} />
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-slate-900 border-t border-slate-800 space-y-4">
          {/* Full text */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Full Requirement Text</p>
            <p className="text-sm text-slate-200 leading-relaxed">{req.text}</p>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="text-slate-500 mb-1">Confidence</div>
                <div className="font-semibold text-white">{((req.confidence || 0) * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="text-slate-500 mb-1">Ambiguity Flags</div>
              <div className="font-semibold text-white">{req.ambiguous_terms?.length || 0}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="text-slate-500 mb-1">Smells</div>
              <div className="font-semibold text-white">{smells.length}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="text-slate-500 mb-1">Entities</div>
              <div className="font-semibold text-white">{req.entities?.length || 0}</div>
            </div>
          </div>

          {/* Smells */}
          {smells.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Detected Smells</p>
              <div className="flex flex-wrap gap-1.5">
                {smells.map((s, i) => <Badge key={i} variant="warning">{s.smell || s}</Badge>)}
              </div>
            </div>
          )}

          {/* Entities */}
          {req.entities?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Extracted Entities (NER)</p>
              <div className="flex flex-wrap gap-1.5">
                {req.entities.map((e, i) => (
                  <span key={i} className="text-xs bg-sky-900/40 border border-sky-800 text-sky-300 px-2 py-0.5 rounded-full">
                    {e.text} <span className="opacity-60">({e.label})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ambiguity flags */}
          {req.ambiguous_terms?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-500 mb-2">⚠ Ambiguity Flags</p>
              <div className="flex flex-wrap gap-1.5">
                {req.ambiguous_terms.map((f, i) => <Badge key={i} variant="warning">{f}</Badge>)}
              </div>
            </div>
          )}

          {/* Incompleteness flags */}
          {req.missing_elements?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-400 mb-2">🚨 Incompleteness Issues</p>
              <div className="flex flex-wrap gap-1.5">
                {req.missing_elements.map((f, i) => <Badge key={i} variant="danger">{f}</Badge>)}
              </div>
            </div>
          )}

          {/* AI generation buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-800 flex-wrap">
            <button
              onClick={() => generate('rewrite')}
              disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900/40 border border-indigo-800 text-indigo-400 text-xs font-medium hover:bg-indigo-900/60 transition-colors disabled:opacity-50"
            >
              {loading === 'rewrite' ? <Spinner size="sm" /> : <Sparkles className="w-3 h-3" />} Rewrite
            </button>
            <button
              onClick={() => generate('story')}
              disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/40 border border-purple-800 text-purple-400 text-xs font-medium hover:bg-purple-900/60 transition-colors disabled:opacity-50"
            >
              {loading === 'story' ? <Spinner size="sm" /> : <BookOpen className="w-3 h-3" />} User Story
            </button>
            <button
              onClick={() => generate('ac')}
              disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-800 text-emerald-400 text-xs font-medium hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
            >
              {loading === 'ac' ? <Spinner size="sm" /> : <Check className="w-3 h-3" />} Acceptance Criteria
            </button>
          </div>

          {artifactError && <p className="text-xs text-red-400">{artifactError}</p>}

          {/* Artifact display */}
          {artifact && (
            <div className="mt-2 p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
              {artifact.type === 'story' && artifact.data?.user_story && (
                <div>
                  <span className="text-purple-400 font-semibold">User Story: </span>
                  {artifact.data.user_story}
                  {artifact.data.acceptance_criteria?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-emerald-400 font-semibold">Acceptance Criteria:</span>
                      <ul className="mt-1 space-y-1 list-disc list-inside text-slate-300">
                        {artifact.data.acceptance_criteria.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {artifact.type === 'ac' && (
                <div>
                  <span className="text-emerald-400 font-semibold">Acceptance Criteria:</span>
                  <ul className="mt-1 space-y-1 list-disc list-inside text-slate-300">
                    {(artifact.data?.acceptance_criteria || []).map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {artifact.type === 'rewrite' && (
                <div>
                  <span className="text-indigo-400 font-semibold">Rewritten: </span>
                  {artifact.data?.improved_text || artifact.data?.rewritten || JSON.stringify(artifact.data)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Requirements() {
  const { analysis } = useAnalysis();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterIssue, setFilterIssue] = useState('all');

  if (!analysis) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Upload}
          title="No analysis data"
          description="Load a demo SRS or upload a document to see requirements."
          action={<button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Go to Upload</button>}
        />
      </div>
    );
  }

  const reqs = (analysis.requirements || []).filter(r => {
    if (filterType !== 'all' && r.type.toLowerCase() !== filterType) return false;
    if (filterIssue === 'ambiguous' && !r.is_ambiguous) return false;
    if (filterIssue === 'incomplete' && !r.is_incomplete) return false;
    if (filterIssue === 'conflict' && !r.potential_conflicts?.length) return false;
    if (search && !r.text.toLowerCase().includes(search.toLowerCase()) && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const duplicateIds = new Set(
    (analysis.duplicates || []).flatMap(pair => [pair.req_a_id, pair.req_b_id])
  );

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <PageHeader
        title="Requirements Explorer"
        subtitle={`${reqs.length} of ${analysis.requirements?.length} requirements shown`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="req-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requirements…"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-600"
          />
        </div>
        <select
          id="filter-type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-600"
        >
          <option value="all">All Types</option>
          <option value="functional">Functional</option>
          <option value="non-functional">Non-Functional</option>
        </select>
        <select
          id="filter-issue"
          value={filterIssue}
          onChange={(e) => setFilterIssue(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-600"
        >
          <option value="all">All Issues</option>
          <option value="ambiguous">Ambiguous Only</option>
          <option value="incomplete">Incomplete Only</option>
          <option value="conflict">Has Conflicts</option>
        </select>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500">{reqs.length} shown</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {reqs.map(req => <RequirementRow key={req.id} req={req} hasDuplicate={duplicateIds.has(req.id)} />)}
        {reqs.length === 0 && (
          <div className="text-center py-16 text-slate-500">No requirements match your filters.</div>
        )}
      </div>
    </div>
  );
}
