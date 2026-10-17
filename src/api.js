import { useEffect, useState } from 'react';

// Backend address. Override with VITE_API_URL in .env.local (see README).
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(API_URL + path, options);
  } catch {
    throw new ApiError(0, 'BACKEND_UNREACHABLE', 'Backend unreachable');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body?.code, body?.message);
  return body;
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  liveQueue: () => request('/queue/live'),
  // Queue of the applications uploaded for one workspace country (same shape as the live queue).
  countryQueue: country => request(`/queue/country/${encodeURIComponent(country)}`),
  application: id => request(`/applications/${id}`),
  historical: (year, policy) => request(`/simulation/historical/${year}/${policy}`),
  // country: the workspace country, used when the documents do not name one.
  extract: (files, country) => {
    const form = new FormData();
    files.forEach(file => form.append('files', file));
    const query = country ? `?country=${encodeURIComponent(country)}` : '';
    return request('/applications/extract' + query, { method: 'POST', body: form });
  },
  correct: (id, revision, values, reason) => request(`/applications/${id}/observations`,
    json('PATCH', { expected_revision: revision, actor: 'dashboard-reviewer', values, reason })),
  runQueue: (applicationIds, capacity, policy = 'carbonqueue') => request('/queue/run',
    json('POST', { application_ids: applicationIds, policy: { name: policy, parameters: {} }, capacity })),
};

// Historical simulation results for one year, all policies: {fifo: {...}, carbon: {...}, ...}
export const HISTORICAL_POLICIES = ['fifo', 'carbon', 'carbon_withdrawal', 'carbon_withdrawal_effort', 'carbonqueue'];

export function useHistorical(year) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    Promise.all(HISTORICAL_POLICIES.map(policy => api.historical(year, policy)))
      .then(results => !cancelled && setState({ status: 'ready', data: Object.fromEntries(HISTORICAL_POLICIES.map((p, i) => [p, results[i]])) }))
      .catch(error => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [year]);
  return state;
}
