import { useEffect, useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/Card';
import { api } from '../api/client';

const FIELD_CONFIG = {
  similarity_threshold: { label: 'Duplicate Similarity Threshold', type: 'range', min: 0.5, max: 0.99, step: 0.01 },
  llm_provider: { label: 'Artifact Provider', type: 'text', placeholder: 'fallback, openai, ollama…' },
  use_local_fallback: { label: 'Use Local Fallback for Artifacts', type: 'toggle' },
  llm_model: { label: 'LLM Model Name', type: 'text', placeholder: 'e.g. gpt-4o-mini' },
  llm_api_key: { label: 'LLM API Key (kept server-side, never shown)', type: 'password', placeholder: 'API key' },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Configure NLP pipeline parameters and API credentials"
        actions={
          <button
            id="btn-save-settings"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Loading settings…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {Object.entries(FIELD_CONFIG).map(([key, cfg]) => (
            <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label htmlFor={`setting-${key}`} className="text-sm font-medium text-slate-200">{cfg.label}</label>
                {cfg.type === 'range' && (
                  <div className="text-xs text-slate-400 mt-0.5">Current: <span className="text-indigo-400 font-semibold">{settings[key] ?? cfg.min}</span></div>
                )}
              </div>
              <div className="flex-shrink-0">
                {cfg.type === 'toggle' && (
                  <button
                    id={`setting-${key}`}
                    onClick={() => update(key, !settings[key])}
                    className={`w-11 h-6 rounded-full transition-colors relative ${settings[key] ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[key] ? 'left-6' : 'left-1'}`} />
                  </button>
                )}
                {cfg.type === 'range' && (
                  <input
                    id={`setting-${key}`}
                    type="range"
                    min={cfg.min} max={cfg.max} step={cfg.step}
                    value={settings[key] ?? cfg.min}
                    onChange={e => update(key, parseFloat(e.target.value))}
                    className="w-36 accent-indigo-500"
                  />
                )}
                {cfg.type === 'number' && (
                  <input
                    id={`setting-${key}`}
                    type="number"
                    min={cfg.min} max={cfg.max}
                    value={settings[key] ?? cfg.min}
                    onChange={e => update(key, parseInt(e.target.value))}
                    className="w-24 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm px-3 py-1.5 focus:outline-none focus:border-indigo-600"
                  />
                )}
                {(cfg.type === 'text' || cfg.type === 'password') && (
                  <input
                    id={`setting-${key}`}
                    type={cfg.type}
                    placeholder={
                      key === 'llm_api_key' && settings.llm_api_key_set
                        ? '•••••••• saved (leave blank to keep)'
                        : cfg.placeholder
                    }
                    value={settings[key] || ''}
                    onChange={e => update(key, e.target.value)}
                    className="w-56 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm px-3 py-1.5 focus:outline-none focus:border-indigo-600 placeholder:text-slate-600"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-4 text-sm text-slate-300">
        <p className="font-semibold text-indigo-300 mb-2">🔑 Running Without OpenAI API Key</p>
        <p className="text-slate-400 leading-relaxed">
          The system fully works without an API key. LLM-powered artifact generation uses deterministic template-based fallbacks.
          To enable GPT-powered generation, add your OpenAI key above and turn on "Use LLM for Artifacts".
        </p>
      </div>
    </div>
  );
}
