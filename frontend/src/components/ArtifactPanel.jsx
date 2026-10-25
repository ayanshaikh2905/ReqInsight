import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Copy, ListChecks, PenLine, RefreshCw } from 'lucide-react';
import { api, isAbort } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Badge } from './Badge';
import { InlineError, Spinner } from './Card';

const TABS = [
  { key: 'story', label: 'User story', icon: BookOpen, run: (t, o) => api.generateUserStory(t, o) },
  { key: 'ac', label: 'Acceptance criteria', icon: ListChecks, run: (t, o) => api.generateAcceptanceCriteria(t, o) },
  { key: 'rewrite', label: 'Rewrite', icon: PenLine, run: (t, o) => api.rewrite(t, o) },
];

const GHERKIN = /^(Scenario:|Given|When|Then|And|But)\b\s*/i;

// The API returns criteria as one Given/When/Then string; tolerate an array too.
const toLines = (v) =>
  (Array.isArray(v) ? v.map(String) : String(v || '').split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);

function Story({ data }) {
  return (
    <div className="space-y-3">
      <blockquote className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink">{data.user_story}</blockquote>
      {(data.actor || data.action || data.benefit) && (
        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          {[['As a', data.actor], ['I want to', data.action], ['So that', data.benefit]].map(
            ([k, v]) => v && (
              <div key={k}>
                <dt className="text-faint">{k}</dt>
                <dd className="mt-0.5 text-muted">{v}</dd>
              </div>
            ),
          )}
        </dl>
      )}
    </div>
  );
}

function Criteria({ data }) {
  const lines = toLines(data.acceptance_criteria);
  if (!lines.length) return <p className="text-sm text-muted">No criteria were returned for this requirement.</p>;
  return (
    <div className="space-y-1 font-mono text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        const m = line.match(GHERKIN);
        const scenario = m && /^scenario/i.test(m[1]);
        return (
          <p key={i} className={`${scenario ? 'mt-3 first:mt-0' : ''} ${m && !scenario && /^(and|but)$/i.test(m[1]) ? 'pl-4' : ''} text-muted`}>
            {m ? (
              <>
                <span className="font-semibold text-accent">{m[1]}</span> <span className="text-ink">{line.slice(m[0].length)}</span>
              </>
            ) : (
              line
            )}
          </p>
        );
      })}
    </div>
  );
}

function Rewrite({ data, original }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="mb-1 text-xs text-faint">Original</div>
        <p className="text-muted line-through decoration-faint/60">{data.original_text || original}</p>
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-faint">
          Improved {data.method && <Badge variant="accent">{data.method}</Badge>}
        </div>
        <p className="leading-relaxed text-ink">{data.improved_text}</p>
      </div>
      {data.changes_made?.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted">
          {data.changes_made.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
    </div>
  );
}

function copyText(tab, data) {
  if (tab === 'story') return data.user_story;
  if (tab === 'ac') return toLines(data.acceptance_criteria).join('\n');
  return data.improved_text;
}

/**
 * Generates a user story, acceptance criteria or rewrite for one requirement.
 * Results are cached per tab. With `auto`, the first tab generates on mount.
 */
export function ArtifactPanel({ text, auto = false }) {
  const { toast } = useToast();
  const [tab, setTab] = useState(auto ? 'story' : null);
  const [results, setResults] = useState({});
  const inFlight = useRef(new Map());

  const generate = useCallback(
    async (key, { force = false } = {}) => {
      if (inFlight.current.has(key)) return;
      const tabDef = TABS.find((t) => t.key === key);
      const controller = new AbortController();
      inFlight.current.set(key, controller);
      setResults((r) => (!force && r[key]?.data ? r : { ...r, [key]: { status: 'loading' } }));
      try {
        const data = await tabDef.run(text, { signal: controller.signal });
        setResults((r) => ({ ...r, [key]: { status: 'done', data } }));
      } catch (e) {
        if (!isAbort(e)) setResults((r) => ({ ...r, [key]: { status: 'error', error: e.message } }));
      } finally {
        inFlight.current.delete(key);
      }
    },
    [text],
  );

  useEffect(() => {
    const flights = inFlight.current;
    return () => flights.forEach((c) => c.abort());
  }, []);

  useEffect(() => {
    if (auto) generate('story');
  }, [auto, generate]);

  const select = (key) => {
    setTab(key);
    if (!results[key]?.data) generate(key);
  };

  const current = tab ? results[tab] : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(tab, current.data));
      toast({ tone: 'ok', title: 'Copied to clipboard' });
    } catch {
      toast({ tone: 'bad', title: 'Could not copy', description: 'Your browser blocked clipboard access.' });
    }
  };

  return (
    <div>
      <div role="tablist" aria-label="Generate an artifact" className="flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(key)}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                active ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:border-faint hover:text-ink'
              }`}
            >
              {results[key]?.status === 'loading' ? <Spinner size="sm" /> : results[key]?.data ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-live="polite" className="mt-3">
        {!tab && <p className="text-xs text-faint">Choose an artifact to generate it from this requirement.</p>}
        {current?.status === 'loading' && (
          <div className="space-y-2 rounded-lg border border-line bg-canvas/50 p-4">
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        )}
        {current?.status === 'error' && <InlineError onRetry={() => generate(tab, { force: true })}>{current.error}</InlineError>}
        {current?.data && (
          <div className="relative rounded-lg border border-line bg-canvas/50 p-4">
            <div className="absolute right-2 top-2 flex gap-1">
              <button type="button" onClick={() => generate(tab, { force: true })} aria-label="Regenerate" title="Regenerate" className="rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={copy} aria-label="Copy" title="Copy" className="rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="pr-14">
              {tab === 'story' && <Story data={current.data} />}
              {tab === 'ac' && <Criteria data={current.data} />}
              {tab === 'rewrite' && <Rewrite data={current.data} original={text} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
