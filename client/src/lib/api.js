/**
 * Thin fetch wrapper for the Cellvix API.
 *
 * Every error the server raises arrives as `{ error: { code, message } }`
 * (PROJECT_INSTRUCTIONS.md §5.1). This normalises that into an ApiError so callers
 * can branch on `err.code` — never on message text.
 */

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
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
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
