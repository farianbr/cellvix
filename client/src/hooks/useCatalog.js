import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import api from '@/lib/api';
import { useFilterStore, toQueryParams } from '@/store/filterStore';

/** The full category tree. One request feeds sidebar, mega menu and wizard. */
export function useTaxonomy() {
  return useQuery({
    queryKey: ['taxonomy'],
    queryFn: () => api.get('/taxonomy'),
    staleTime: 10 * 60 * 1000,
    select: (data) => data.tree,
  });
}

/**
 * Every part type the catalogue actually carries, with its label.
 *
 * Read from the unfiltered facet counts rather than a hardcoded list, so an
 * admin form can never target a part type that does not exist. One row of
 * products is requested because the facets ride along with any product response.
 */
export function usePartTypes() {
  return useQuery({
    queryKey: ['facets', 'partType'],
    queryFn: () => api.get('/products', { limit: 1 }),
    select: (data) => data.facets?.partType ?? [],
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * The product grid query.
 *
 * `placeholderData: keepPreviousData` is load-bearing: the previous grid stays
 * on screen while the next one loads, so changing a filter reads as instant
 * rather than as a flash of empty page.
 */
export function useProducts() {
  // useShallow is required: zustand v5 compares with Object.is, so returning a
  // fresh object from the selector without it re-renders on every store touch.
  const state = useFilterStore(
    useShallow((s) => ({
      path: s.path,
      facets: s.facets,
      q: s.q,
      sort: s.sort,
      page: s.page,
    })),
  );

  const params = toQueryParams(state);

  return useQuery({
    queryKey: ['products', params],
    queryFn: ({ signal }) => api.get('/products', params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

/** Header type-ahead. Only fires from two characters up. */
export function useSearchSuggestions(q) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => api.get('/products/search', { q }, { signal }),
    enabled: q.trim().length >= 2,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
