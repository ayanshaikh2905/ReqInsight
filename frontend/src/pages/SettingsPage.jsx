import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Save } from 'lucide-react';
import { api, isAbort } from '../api/client';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Button } from '../components/Button';
import { Card, InlineError, PageHeader } from '../components/Card';

const PROVIDERS = ['fallback', 'openai', 'groq', 'ollama', 'mistral'];
const inputClass =
  'h-10 w-full rounded-lg border border-line bg-canvas/60 px-3 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent';

function Row({ label, htmlFor, description, children }) {
  return (
    <div className="grid gap-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,280px)] sm:items-center sm:gap-8">
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Switch({ id, checked, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  usePageTitle('Settings');
  const { toast } = useToast();
  const [saved, setSaved] = useState(null); // last values known to the server
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getSettings({ signal: controller.signal })
      .then((s) => {
        setSaved(s);
        setDraft(s);
      })
      .catch((e) => !isAbort(e) && setError(e.message));
    return () => controller.abort();
  }, [attempt]);

  const dirty = useMemo(() => !!draft && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const update = useCallback((key, value) => setDraft((d) => ({ ...d, [key]: value })), []);

  const save = async () => {
    setSaving(true);
    try {
      const next = await api.updateSettings(draft);
      setSaved(next);
      setDraft(next);
      toast({ tone: 'ok', title: 'Settings saved' });
    } catch (e) {
      toast({ tone: 'bad', title: 'Could not save settings', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Tune duplicate detection and choose how artifacts are generated."
        actions={
          draft && (
            <>
              {dirty && (
                <Button size="sm" variant="ghost" onClick={() => setDraft(saved)}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Discard
                </Button>
              )}
              <Button variant="primary" size="sm" loading={saving} disabled={!dirty} onClick={save}>
                <Save className="h-3.5 w-3.5" aria-hidden="true" /> Save changes
              </Button>
            </>
          )
        }
      />

      {error && <InlineError onRetry={() => { setError(null); setAttempt((n) => n + 1); }}>{error}</InlineError>}
      {!draft && !error && (
        <div className="space-y-3" role="status" aria-label="Loading settings">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      )}

      {draft && (
        <div className="max-w-3xl space-y-6">
          <Card className="divide-y divide-line">
            <Row
              label="Duplicate similarity threshold"
              htmlFor="similarity_threshold"
              description="Pairs at or above this similarity are reported as duplicates. Applies to pasted text and the demo."
            >
              <div className="flex items-center gap-3">
                <input
                  id="similarity_threshold"
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={draft.similarity_threshold ?? 0.85}
                  onChange={(e) => update('similarity_threshold', parseFloat(e.target.value))}
                  className="w-full accent-[rgb(var(--c-accent))]"
                />
                <span className="w-10 text-right font-mono text-sm tabular-nums text-accent">
                  {(draft.similarity_threshold ?? 0.85).toFixed(2)}
                </span>
              </div>
            </Row>
          </Card>

          <Card className="divide-y divide-line">
            <Row
              label="Use the built-in fallback"
              htmlFor="use_local_fallback"
              description="Generate artifacts from local templates when no provider is configured or a request fails."
            >
              <Switch id="use_local_fallback" checked={!!draft.use_local_fallback} onChange={(v) => update('use_local_fallback', v)} />
            </Row>
            <Row label="Provider" htmlFor="llm_provider" description="Use “fallback” to stay fully offline.">
              <input
                id="llm_provider"
                list="providers"
                value={draft.llm_provider || ''}
                onChange={(e) => update('llm_provider', e.target.value)}
                placeholder="fallback"
                className={inputClass}
              />
              <datalist id="providers">{PROVIDERS.map((p) => <option key={p} value={p} />)}</datalist>
            </Row>
            <Row label="Model" htmlFor="llm_model" description="For example gpt-4o-mini. Ignored by the fallback.">
              <input id="llm_model" value={draft.llm_model || ''} onChange={(e) => update('llm_model', e.target.value)} placeholder="gpt-4o-mini" className={inputClass} />
            </Row>
            <Row label="API base URL" htmlFor="llm_api_base" description="Optional. Set this for self-hosted or compatible endpoints.">
              <input id="llm_api_base" value={draft.llm_api_base || ''} onChange={(e) => update('llm_api_base', e.target.value)} placeholder="https://api.example.com/v1" className={inputClass} />
            </Row>
            <Row label="API key" htmlFor="llm_api_key" description="Kept on the server and never shown again. Leave blank to keep the saved key.">
              <div className="relative">
                <input
                  id="llm_api_key"
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  value={draft.llm_api_key || ''}
                  onChange={(e) => update('llm_api_key', e.target.value)}
                  placeholder={draft.llm_api_key_set ? '•••••••• saved' : 'Paste a key'}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint transition-colors hover:text-ink"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Row>
          </Card>

          <p className="max-w-prose text-sm leading-relaxed text-muted">
            ReqInsight works without any key. With the fallback on, user stories, acceptance criteria and rewrites come from deterministic templates.
          </p>
        </div>
      )}
    </>
  );
}
