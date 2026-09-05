import { useSearchParams } from 'react-router';

/**
 * Client-side paging for an admin table, with the page in the URL.
 *
 * **Paged here rather than on the server, deliberately.** The admin list
 * endpoints answer with the whole filtered set (capped at 200–300) and every
 * KPI tile on these screens is summed from those rows. Asking the server for
 * one page would mean the tile row silently described only the page in view,
 * and a "Total customers" figure that changes when you turn the page is worse
 * than no figure at all. If a list outgrows its cap this moves server-side, and
 * the tiles have to get their own aggregate first.
 *
 * **The page lives in the URL** so a view is a link — "the third page of unpaid
 * invoices" is something an operator can send someone.
 *
 * Two guards that a hand-rolled version keeps getting wrong:
 *
 *   - **Clamped on read.** A filter change can strand the URL on page 4 of a
 *     two-page set; clamping shows the last page rather than an empty table
 *     with working arrows.
 *   - **Any other change resets to page 1.** Staying on page 3 of a set that
 *     now has one page shows nothing, which reads as "the filter broke".
 *     `setParam` here does that for every key except `page` itself.
 */

/** Ten. Small enough that a table is scannable without scrolling the page. */
export const DEFAULT_PER_PAGE = 10;

/**
 * The row-count choices, one definition.
 *
 * This was forked — the customers screen offered 25/50/100 and the tickets
 * screen 10/25/50/100 — so the same control had a different first option
 * depending on which list you were on.
 */
export const PER_PAGE_OPTIONS = [10, 25, 50, 100].map((n) => ({
  value: String(n),
  label: `${n} per page`,
}));

export function useTablePage(rows = []) {
  const [searchParams, setSearchParams] = useSearchParams();

  const perPage = searchParams.get('perPage') ?? String(DEFAULT_PER_PAGE);
  const size = Number(perPage) || DEFAULT_PER_PAGE;
  const requested = Math.max(1, Number(searchParams.get('page') ?? 1));

  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(requested, totalPages);
  const pageRows = rows.slice((page - 1) * size, page * size);

  /**
   * Write a filter parameter. Everything but `page` returns to page 1 — see the
   * note above. An empty value or `'all'` drops the key rather than writing a
   * parameter that means "the default".
   */
  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    if (key !== 'page') params.delete('page');
    setSearchParams(params, { replace: true });
  }

  function setPage(next) {
    setParam('page', next <= 1 ? '' : String(next));
  }

  return {
    /** The rows to render — never more than `perPage` of them. */
    pageRows,
    page,
    totalPages,
    perPage,
    /** 1-based index of the first row on screen, for `CountLine`'s `from`. */
    from: rows.length === 0 ? 0 : (page - 1) * size + 1,
    setPage,
    setParam,
    /** For `FilterStrip`: the row count only counts as a filter once changed. */
    perPageIsDefault: size === DEFAULT_PER_PAGE,
  };
}

export default useTablePage;
