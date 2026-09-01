import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useFilterStore, toQueryParams } from '@/store/filterStore';

/**
 * Mirrors the filter store into the URL, and hydrates it from the URL once on
 * mount. The store is the source of truth after that — the URL is a projection,
 * which keeps deep links, refresh and the back button all working without the
 * two ever fighting each other.
 */
export function useFilterUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useRef(false);

  // ---- URL -> store, once ------------------------------------------------
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const store = useFilterStore.getState();
    const get = (key) => searchParams.get(key) || null;

    const path = {
      deviceType: get('deviceType'),
      brand: get('brand'),
      series: get('series'),
      model: get('model'),
    };
    if (Object.values(path).some(Boolean)) store.setPath(path);

    const partType = get('partType');
    const grade = get('grade');
    // setFacet, not setComponentType: hydrating must not cascade away the very
    // path the same URL is restoring. The wizard's label for it is filled in
    // once the taxonomy lands (see TabWizard's componentLabel effect).
    if (partType) store.setFacet('partType', partType.split(','));
    if (grade) store.setFacet('grade', grade.split(','));
    if (get('inStockOnly')) store.setFacet('inStockOnly', true);
    if (get('priceMin')) store.setFacet('priceMin', Number(get('priceMin')));
    if (get('priceMax')) store.setFacet('priceMax', Number(get('priceMax')));
    if (get('q')) store.setQuery(get('q'));
    if (get('sort')) store.setSort(get('sort'));
    if (get('page')) store.setPage(Number(get('page')));
  }, [searchParams]);

  // ---- store -> URL, on every change -------------------------------------
  useEffect(() => {
    return useFilterStore.subscribe((state) => {
      if (!hydrated.current) return;

      const params = toQueryParams(state);
      const next = new URLSearchParams();

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === '') continue;
        if (Array.isArray(value)) {
          if (value.length) next.set(key, value.join(','));
        } else {
          next.set(key, String(value));
        }
      }

      // replace: filtering should not stack fifty history entries.
      setSearchParams(next, { replace: true });
    });
  }, [setSearchParams]);
}

export default useFilterUrlSync;
