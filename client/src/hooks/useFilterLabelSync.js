import { useEffect } from 'react';
import { pathNodes } from '@/lib/taxonomy';
import useFilterStore from '@/store/filterStore';
import { useTaxonomy } from './useCatalog';

/**
 * Backfills human-readable labels for the active filter path.
 *
 * The URL only carries slugs (`?brand=samsung`), so a deep link or a refresh
 * lands with `path` set but `labels` empty — which would leave the wizard tabs
 * and the filter chips showing "samsung" instead of "Samsung". This resolves
 * them from the taxonomy tree as soon as it arrives.
 */
export function useFilterLabelSync() {
  const { data: tree } = useTaxonomy();

  useEffect(() => {
    if (!tree) return;

    const { path, labels, setLabels } = useFilterStore.getState();
    const nodes = pathNodes(tree, path);
    if (nodes.length === 0) return;

    const missing = {};
    for (const node of nodes) {
      if (!labels[node.level]) missing[node.level] = node.name;
    }

    if (Object.keys(missing).length > 0) setLabels(missing);
  }, [tree]);

  // Re-run whenever the path changes too — a mega-menu click sets labels, but a
  // browser Back can land on a path whose labels were never populated.
  useEffect(() => {
    if (!tree) return undefined;

    return useFilterStore.subscribe((state, previous) => {
      if (state.path === previous.path) return;

      const nodes = pathNodes(tree, state.path);
      const missing = {};
      for (const node of nodes) {
        if (!state.labels[node.level]) missing[node.level] = node.name;
      }
      if (Object.keys(missing).length > 0) useFilterStore.getState().setLabels(missing);
    });
  }, [tree]);
}

export default useFilterLabelSync;
