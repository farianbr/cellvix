import { apiUrl } from './api';

/**
 * Starts a list export download (ERP rework §7.4, phase 12b).
 *
 * **The filters go on the URL, so the file matches the screen.** §7.4 is blunt:
 * an export that ignores the active filter set is a bug. Every caller passes
 * the same params object it gave the list query, so the two cannot disagree —
 * there is no second place here that decides what "current filters" means.
 *
 * **A plain navigation, not `fetch` + Blob.** The session lives in an httpOnly
 * cookie, which a top-level GET carries automatically; fetching the bytes into
 * memory only to hand them back to the browser would buy nothing and would put
 * a whole spreadsheet in a JS string. `Content-Disposition: attachment` on the
 * response is what makes the browser save rather than navigate, so the current
 * page is never replaced.
 *
 * Empty and null params are dropped, so an unfiltered export is a clean URL
 * rather than `?status=&q=`.
 */
export function downloadExport(resource, format, params = {}) {
  const search = new URLSearchParams({ format: String(format).toLowerCase() });

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    search.set(key, String(value));
  }

  // `assign` rather than `window.open`: a popup blocker will silently swallow
  // the second, and an attachment response does not navigate the page anyway.
  window.location.assign(apiUrl(`/admin/export/${resource}?${search}`));
}

export default downloadExport;
