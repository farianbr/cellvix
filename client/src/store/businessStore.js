/**
 * Which business the panel is looking at.
 *
 * **Not React state, and not a context.** The value has to be readable from
 * `lib/api.js`, which is a plain module that every request passes through and
 * which cannot call a hook. A tiny store with a subscribe function serves both:
 * the API layer reads it synchronously, and `useBusiness()` subscribes so the
 * shell re-renders when it changes.
 *
 * **`null` means "not chosen yet", not "all businesses"** (SAAS_PLATFORM §4.1).
 *
 * It used to mean both, because an admin's default view spanned every business.
 * That view is gone: under database-per-business a request resolves to exactly
 * one database, so there is nothing for an unscoped admin query to read. The
 * switcher now lands on the default business when this is empty, and `null`
 * survives only as the state before that has happened.
 *
 * Persisted in `sessionStorage` for the same reason the date range is: the
 * business you are working in is a working context that should survive a
 * navigation and a reload, but not still be there next week. A staff member's
 * business is enforced server-side regardless, so a stale value here can never
 * widen what they are allowed to see.
 */

const KEY = 'cellvix:admin:business';

let current = read();
const listeners = new Set();

function read() {
  try {
    return sessionStorage.getItem(KEY) || null;
  } catch {
    // Storage blocked (private window, site data off). All businesses is the
    // right answer, and the panel must still render.
    return null;
  }
}

/** The selected business id, or null for all businesses. */
export function getBusiness() {
  return current;
}

export function setBusiness(id) {
  const next = id || null;
  if (next === current) return;
  current = next;

  try {
    if (next) sessionStorage.setItem(KEY, next);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Not persisting is survivable; the value still holds for this page.
  }

  for (const listener of listeners) listener(current);
}

export function subscribeBusiness(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export default getBusiness;
