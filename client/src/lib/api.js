/**
 * Thin fetch wrapper for the Cellvix API.
 *
 * Every error the server raises arrives as `{ error: { code, message } }`
 * (PROJECT_INSTRUCTIONS.md §5.1). This normalises that into an ApiError so callers
 * can branch on `err.code` — never on message text.
 */

import { getBusiness } from '@/store/businessStore';

const BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN', status = 0, fields = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function buildUrl(path, params) {
  const url = `${BASE}${path}`;

  /**
   * The selected business rides on every admin request.
   *
   * Injected here rather than at each call site because there are well over a
   * hundred of them, and one that forgot would silently show another shop's
   * data — the kind of bug nobody notices until the figures are wrong. The
   * server decides what to do with it: most admin lists scope by it, a few
   * (the catalogue, settings) deliberately do not.
   *
   * Only `/admin` paths **and `/auth/me`**, and never when a caller passed its
   * own `business` — the customer profile asks for one account's records across
   * all businesses, and the switcher must not narrow that.
   *
   * `/auth/me` is on the list because the **feature set** comes back with the
   * session, and a business's type is what decides which sections exist
   * (SAAS_PLATFORM §1.1). Without the scope on this one call the server would
   * resolve the union on every request and the sidebar would never change,
   * however many admin lists switched correctly underneath it.
   */
  const scopedPath = path.startsWith('/admin') || path === '/auth/me';
  const business = scopedPath ? getBusiness() : null;
  const scoped = business && !(params && 'business' in params) ? { ...params, business } : params;

  if (!scoped) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(scoped)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(path, { method = 'GET', body, params, signal } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      // The session is an httpOnly cookie — it must ride along on every call.
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the server. Check your connection.', {
      code: 'NETWORK_ERROR',
    });
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (response.ok) return response;
    throw new ApiError('Unexpected response from the server.', {
      code: 'BAD_RESPONSE',
      status: response.status,
    });
  }

  const payload = await response.json();

  if (!response.ok) {
    const err = payload?.error || {};
    throw new ApiError(err.message || 'Something went wrong.', {
      code: err.code || 'UNKNOWN',
      status: response.status,
      fields: err.fields || null,
    });
  }

  return payload;
}

/**
 * The absolute URL of an API path, for the places a browser has to fetch it
 * rather than this wrapper — a link the user opens in a new tab, an <img src>.
 */
export const apiUrl = (path) => `${BASE}${path}`;

export const api = {
  get: (path, params, options) => request(path, { ...options, params }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export default api;
