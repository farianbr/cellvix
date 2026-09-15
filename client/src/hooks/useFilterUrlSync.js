import { useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useFilterStore, toQueryParams } from '@/store/filterStore';

/**
 * Mirrors the filter store into the URL, and hydrates it from the URL on mount.
 * The store is the source of truth after that - the URL is a projection, which
 * keeps deep links, refresh and the back button all working without the two
 * ever fighting each other.
 *
 * **Hydration runs BEFORE paint, and it is a full reset.** Both halves of that
 * were bugs.
 *
 * The store is a module-level Zustand store, so it outlives any one mount of
 * the Shop page; the "have I hydrated yet" ref does not. Arriving at
 * `/shop?deviceType=smartphone` from a link on another page therefore mounted
 * a fresh ShopPage against a store still holding whatever the last visit left
 * in it - and `useProducts` reads the store during that first render, so an
 * UNFILTERED request went out before the hydrating effect had run. The URL said
 * one thing, the grid showed another, and the chip row showed a filter that was
 * not applied. `useLayoutEffect` closes that window: the store is correct
 * before anything renders against it.
 *
 * And hydration now writes every key, including the ones the URL does not
 * carry. Setting only what was present meant a filter left over from a previous
 * visit survived a navigation that never mentioned it, so `/shop` could show a
 * narrowed catalogue with nothing on screen explaining why. A URL is the whole
 * filter state, not a patch over it.
 */
export function useFilterUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useRef(false);

  // The query string this hook last wrote out. Used to tell OUR OWN url
  // updates apart from a real navigation - without it, re-hydrating on every
  // `searchParams` change would fight the store-to-URL effect below.
  const lastWritten = useRef(null);

  // ---- URL -> store ------------------------------------------------------
  useLayoutEffect(() => {
    const current = searchParams.toString();

    // A change this hook caused itself. The store already holds it.
    if (hydrated.current && current === lastWritten.current) return;

    const store = useFilterStore.getState();
    const get = (key) => searchParams.get(key) || null;

    const path = {
      deviceType: get('deviceType'),
      brand: get('brand'),
      series: get('series'),
      model: get('model'),
    };
    // Always, not only when something is present: an absent level has to be
    // cleared, or it survives from the last visit.
    store.setPath(path);

    // setFacet, not setComponentType: hydrating must not cascade away the very
    // path the same URL is restoring. The wizard's label for it is filled in
    // once the taxonomy lands (see TabWizard's componentLabel effect).
    const partType = get('partType');
    const grade = get('grade');
    store.setFacet('partType', partType ? partType.split(',') : []);
    store.setFacet('grade', grade ? grade.split(',') : []);
    store.setFacet('inStockOnly', Boolean(get('inStockOnly')));
    store.setFacet('priceMin', get('priceMin') ? Number(get('priceMin')) : null);
    store.setFacet('priceMax', get('priceMax') ? Number(get('priceMax')) : null);
    store.setQuery(get('q') ?? '');
    store.setSort(get('sort') ?? 'relevance');
    store.setPage(get('page') ? Number(get('page')) : 1);

    hydrated.current = true;
    lastWritten.current = current;
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

      const serialised = next.toString();
      // Remember what we are about to write, so the hydrating effect above
      // recognises the resulting `searchParams` change as our own.
      lastWritten.current = serialised;

      // replace: filtering should not stack fifty history entries.
      setSearchParams(next, { replace: true });
    });
  }, [setSearchParams]);
}

export default useFilterUrlSync;
