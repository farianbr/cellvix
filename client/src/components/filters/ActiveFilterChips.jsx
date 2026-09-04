import { useShallow } from 'zustand/react/shallow';
import Chip from '@/components/ui/Chip';
import { FILTER_LEVELS, GRADES } from '@/lib/constants';
import useFilterStore from '@/store/filterStore';

/**
 * A single readout of everything the three filter systems have set. Without it
 * a user who filtered via the mega menu has no idea why the grid is narrow.
 */
export function ActiveFilterChips({ facetMeta }) {
  const { path, labels, facets, q, clearLevel, toggleFacet, setFacet, setQuery, resetAll } =
    useFilterStore(
      useShallow((s) => ({
        path: s.path,
        labels: s.labels,
        facets: s.facets,
        q: s.q,
        clearLevel: s.clearLevel,
        toggleFacet: s.toggleFacet,
        setFacet: s.setFacet,
        setQuery: s.setQuery,
        resetAll: s.resetAll,
      })),
    );

  const chips = [];

  if (q) chips.push({ key: `q`, label: 'Search', value: q, onRemove: () => setQuery('') });

  // Component type leads, matching the filter hierarchy the wizard and sidebar
  // both present (Component Type > Device Type > Brand > Series > Model).
  for (const value of facets.partType) {
    const meta = facetMeta?.partType?.find((p) => p.value === value);
    chips.push({
      key: `part-${value}`,
      label: 'Component',
      value: meta?.label ?? value,
      onRemove: () => toggleFacet('partType', value),
    });
  }

  for (const level of FILTER_LEVELS) {
    // componentType is a facet, not a path level — it is chipped just above.
    if (level.key === 'componentType' || !path[level.key]) continue;
    chips.push({
      key: `path-${level.key}`,
      label: level.short,
      value: labels[level.key] ?? path[level.key],
      onRemove: () => clearLevel(level.key),
    });
  }

  for (const value of facets.grade) {
    chips.push({
      key: `grade-${value}`,
      label: 'Grade',
      value: GRADES[value]?.label ?? value,
      onRemove: () => toggleFacet('grade', value),
    });
  }

  if (facets.inStockOnly) {
    chips.push({
      key: 'stock',
      label: null,
      value: 'In stock',
      onRemove: () => setFacet('inStockOnly', false),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Chip key={chip.key} label={chip.label} value={chip.value} onRemove={chip.onRemove} />
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          onClick={resetAll}
          className="ml-1 text-sm font-medium text-ink-400 underline-offset-2 transition-colors hover:text-brand hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

export default ActiveFilterChips;
