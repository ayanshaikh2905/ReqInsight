const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Unable to reach the ReqInsight API. Start the backend and try again.');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errBody.detail || `API error ${res.status}`);
  }
  return res;
}

export const api = {
  loadDemoSRS: () => request('/demo-srs').then(r => r.json()),
  uploadDocument: (file, threshold) => {
    const fd = new FormData();
    fd.append('file', file);
    // Omitted threshold -> the backend uses the saved Settings value.
    if (threshold != null) fd.append('threshold', threshold);
    return request('/upload', { method: 'POST', body: fd }).then(r => r.json());
  },
  analyzeText: (text, documentName = 'Pasted SRS') =>
    request('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, document_name: documentName }),
    }).then(r => r.json()),
  getRequirements: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
    return request(`/requirements${qs ? '?' + qs : ''}`).then(r => r.json());
  },
  getRequirementById: (id) => request(`/requirements/${id}`).then(r => r.json()),
  getDuplicates: (threshold) => {
    const qs = threshold != null ? `?threshold=${threshold}` : '';
    return request(`/duplicates${qs}`).then(r => r.json());
  },
  getConflicts: () => request('/conflicts').then(r => r.json()),
  getTopics: () => request('/topics').then(r => r.json()),
  getMetrics: () => request('/metrics').then(r => r.json()),
  getReport: () => request('/report').then(r => r.json()),
  getSettings: () => request('/settings').then(r => r.json()),
  updateSettings: (settings) =>
    request('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).then(r => r.json()),
  rewrite: (text) =>
    request('/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(r => r.json()),
  generateUserStory: (text) =>
    request('/user-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(r => r.json()),
  generateAcceptanceCriteria: (text) =>
    request('/acceptance-criteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(r => r.json()),
  exportReport: (format) => request(`/export/${format}`),
  getCorrectedSRS: () => request('/corrected-srs').then(r => r.json()),
  exportCorrectedSRS: (format) => request(`/export/corrected/${format}`).then(r => r.blob()),
  listHistory: (limit = 50) => request(`/history?limit=${limit}`).then(r => r.json()),
  activateRun: (runId) =>
    request(`/history/${encodeURIComponent(runId)}/activate`, { method: 'POST' }).then(r => r.json()),
  deleteRun: (runId) =>
    request(`/history/${encodeURIComponent(runId)}`, { method: 'DELETE' }).then(r => r.json()),
  compareRuns: (base, target) =>
    request(`/compare?${new URLSearchParams({ base, target })}`).then(r => r.json()),
};
