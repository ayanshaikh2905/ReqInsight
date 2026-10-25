const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');

const DEFAULT_TIMEOUT = 30_000;
const ANALYSIS_TIMEOUT = 180_000;

export class ApiError extends Error {
  constructor(message, { status, kind = 'http' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind; // 'network' | 'timeout' | 'http'
  }
}

/** FastAPI returns `detail` as a string, or a list of validation errors. */
function readDetail(body, fallback) {
  const detail = body?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d?.msg).filter(Boolean).join('; ') || fallback;
  }
  return fallback;
}

async function request(path, { timeout = DEFAULT_TIMEOUT, signal, ...options } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, signal: controller.signal });
  } catch (err) {
    if (signal?.aborted) throw err; // caller cancelled: let AbortError through
    if (timedOut) {
      throw new ApiError('The ReqInsight API took too long to respond. Try again in a moment.', { kind: 'timeout' });
    }
    throw new ApiError('Unable to reach the ReqInsight API. Start the backend and try again.', { kind: 'network' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(readDetail(body, `Request failed (${res.status} ${res.statusText || 'error'})`), {
      status: res.status,
    });
  }
  return res;
}

const json = (path, options) => request(path, options).then((r) => r.json());

const jsonBody = (method, body, extra = {}) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  ...extra,
});

export const isAbort = (err) => err?.name === 'AbortError';

export const api = {
  loadDemoSRS: () => json('/demo-srs', { timeout: ANALYSIS_TIMEOUT }),
  uploadDocument: (file, threshold = 0.85) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('threshold', threshold);
    return json('/upload', { method: 'POST', body: fd, timeout: ANALYSIS_TIMEOUT });
  },
  analyzeText: (text, documentName = 'Pasted SRS') =>
    json('/analyze', jsonBody('POST', { text, document_name: documentName }, { timeout: ANALYSIS_TIMEOUT })),
  getRequirements: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ''),
    ).toString();
    return json(`/requirements${qs ? `?${qs}` : ''}`);
  },
  getRequirementById: (id) => json(`/requirements/${encodeURIComponent(id)}`),
  getDuplicates: (threshold, opts) =>
    json(`/duplicates${threshold != null ? `?threshold=${threshold}` : ''}`, opts),
  getConflicts: (opts) => json('/conflicts', opts),
  getTopics: (opts) => json('/topics', opts),
  getMetrics: (opts) => json('/metrics', { timeout: 90_000, ...opts }),
  getReport: (opts) => json('/report', opts),
  getSettings: (opts) => json('/settings', opts),
  updateSettings: (settings) => json('/settings', jsonBody('POST', settings)),
  rewrite: (text, opts) => json('/rewrite', jsonBody('POST', { text }, opts)),
  generateUserStory: (text, opts) => json('/user-story', jsonBody('POST', { text }, opts)),
  generateAcceptanceCriteria: (text, opts) => json('/acceptance-criteria', jsonBody('POST', { text }, opts)),
  exportReport: (format) => request(`/export/${format}`, { timeout: 90_000 }),
  getCorrectedSRS: (opts) => json('/corrected-srs', opts),
  exportCorrectedSRS: (format) =>
    request(`/export/corrected/${format}`, { timeout: 90_000 }).then((r) => r.blob()),
};
