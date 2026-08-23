import { create } from 'zustand';
import { FILTER_LEVELS } from '@/lib/constants';

/**
 * THE unified filter state (PROJECT_INSTRUCTIONS.md §4).
 *
 * Three UIs write to this one store — the sidebar accordion, the header mega
 * menu, and the tab wizard. They never mutate state directly; they call the
 * actions below. The product grid is the only subscriber that triggers a fetch.
 */

const LEVELS = FILTER_LEVELS.map((l) => l.key); // deviceType, brand, series, model

const emptyPath = () => ({ deviceType: null, brand: null, series: null, model: null });

const emptyFacets = () => ({
  partType: [],
  grade: [],
  inStockOnly: false,
  priceMin: null,
  priceMax: null,
});

const initial = {
  path: emptyPath(),
  // Human-readable labels for the active path, so chips and completed wizard
  // tabs can render "Galaxy S23 Ultra" without another lookup.
  labels: emptyPath(),
  facets: emptyFacets(),
  q: '',
  sort: 'relevance',
  page: 1,
};

export const useFilterStore = create((set, get) => ({
  ...initial,

  /**
   * Sets one level of the hierarchy and CASCADES: every level below it is
   * cleared. This is what makes out-of-order wizard edits safe — picking a new
   * brand can never leave a stale model attached to it.
   */
  setPathLevel(level, value, label = null) {
    const index = LEVELS.indexOf(level);
    if (index === -1) return;

    set((state) => {
      const path = { ...state.path };
      const labels = { ...state.labels };

      path[level] = value;
      labels[level] = label;

      for (const below of LEVELS.slice(index + 1)) {
        path[below] = null;
        labels[below] = null;
      }

      return { path, labels, page: 1 };
    });
  },

  /** Applies a whole path at once — used when the mega menu jumps straight to a model. */
  setPath(partial, labels = {}) {
    set((state) => {
      const path = { ...emptyPath(), ...partial };
      const nextLabels = { ...emptyPath(), ...labels };
      return { path, labels: nextLabels, page: 1, q: state.q };
    });
  },

  clearLevel(level) {
    get().setPathLevel(level, null, null);
  },

  /**
   * Fills in display names for levels that only have a slug — the case after a
   * deep link or a refresh, where the URL carries slugs but no labels.
   * Does not touch the path, so it never triggers a refetch.
   */
  setLabels(partial) {
    set((state) => ({ labels: { ...state.labels, ...partial } }));
  },

  toggleFacet(key, value) {
    set((state) => {
      const current = state.facets[key];
      if (!Array.isArray(current)) return state;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { facets: { ...state.facets, [key]: next }, page: 1 };
    });
  },

  setFacet(key, value) {
    set((state) => ({ facets: { ...state.facets, [key]: value }, page: 1 }));
  },

  clearFacets() {
    set({ facets: emptyFacets(), page: 1 });
  },

  setQuery(q) {
    set({ q, page: 1 });
  },

  setSort(sort) {
    set({ sort, page: 1 });
  },

  setPage(page) {
    set({ page });
  },

  resetAll() {
    set({ ...initial, path: emptyPath(), labels: emptyPath(), facets: emptyFacets() });
  },

  /** How many levels of the hierarchy are set — drives the wizard's step state. */
  depth() {
    const { path } = get();
    let depth = 0;
    for (const level of LEVELS) {
      if (!path[level]) break;
      depth += 1;
    }
    return depth;
  },

  hasAnyFilter() {
    const { path, facets, q } = get();
    return (
      LEVELS.some((l) => path[l]) ||
      facets.partType.length > 0 ||
      facets.grade.length > 0 ||
      facets.inStockOnly ||
      facets.priceMin !== null ||
      facets.priceMax !== null ||
      q.length > 0
    );
  },
}));

/** The serialized query the API and the URL both consume. */
export function toQueryParams(state) {
  return {
    deviceType: state.path.deviceType,
    brand: state.path.brand,
    series: state.path.series,
    model: state.path.model,
    partType: state.facets.partType,
    grade: state.facets.grade,
    inStockOnly: state.facets.inStockOnly || null,
    priceMin: state.facets.priceMin,
    priceMax: state.facets.priceMax,
    q: state.q || null,
    sort: state.sort === 'relevance' ? null : state.sort,
    page: state.page > 1 ? state.page : null,
  };
}

export default useFilterStore;
