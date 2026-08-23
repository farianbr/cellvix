import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import cn from '@/lib/cn';
import { count as formatCount } from '@/lib/format';
import { GRADES, GRADE_ORDER } from '@/lib/constants';
import Checkbox from '@/components/ui/Checkbox';
import Skeleton from '@/components/ui/Skeleton';
import useFilterStore from '@/store/filterStore';
import { useTaxonomy } from '@/hooks/useCatalog';

const LEVEL_BY_DEPTH = ['deviceType', 'brand', 'series', 'model'];

/**
 * The nested hierarchy accordion (brief §5.1).
 *
 * Rendered from the same tree the mega menu and wizard use, and it writes
 * through the same store actions — selecting "Samsung" here flips the wizard's
 * Brand tab to completed in the same tick.
 */
function TreeBranch({ nodes, depth, path, onSelect }) {
  const level = LEVEL_BY_DEPTH[depth];
  const selectedSlug = path[level];

  return (
    <ul className={cn(depth > 0 && 'ml-3 border-l border-line pl-2')}>
      {nodes.map((node) => {
        const isSelected = selectedSlug === node.slug;
        const hasChildren = (node.children?.length ?? 0) > 0;
        // Expand the selected branch only — the tree is 177 nodes deep in total.
        const isExpanded = isSelected && hasChildren;

        return (
          <li key={node.slug}>
            <button
              type="button"
              onClick={() => onSelect(level, isSelected ? null : node.slug, isSelected ? null : node.name)}
              aria-expanded={hasChildren ? isExpanded : undefined}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] transition-colors',
                isSelected
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-ink-700 hover:bg-surface-2',
              )}
            >
              {hasChildren ? (
                <ChevronDown
                  className={cn(
                    'size-3.5 shrink-0 text-ink-300 transition-transform duration-200',
                    !isExpanded && '-rotate-90',
                  )}
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              ) : (
                <span className="size-3.5 shrink-0" aria-hidden="true" />
              )}

              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              <span className="tnum shrink-0 text-[11.5px] text-ink-300">
                {formatCount(node.count)}
              </span>
            </button>

            {isExpanded && (
              <TreeBranch nodes={node.children} depth={depth + 1} path={path} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-line py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-1 flex w-full items-center justify-between gap-2 px-2 py-1 text-left"
      >
        <span className="eyebrow text-ink-500">{title}</span>
        <ChevronDown
          className={cn(
            'size-4 text-ink-300 transition-transform duration-200',
            !open && '-rotate-90',
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {open && children}
    </div>
  );
}

export function SidebarFilter({ facets, className }) {
  const { data: tree, isLoading } = useTaxonomy();

  const { path, facetState, setPathLevel, toggleFacet, setFacet } = useFilterStore(
    useShallow((s) => ({
      path: s.path,
      facetState: s.facets,
      setPathLevel: s.setPathLevel,
      toggleFacet: s.toggleFacet,
      setFacet: s.setFacet,
    })),
  );

  return (
    <aside className={cn('rounded-[14px] border border-line bg-surface', className)}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <SlidersHorizontal className="size-4 text-ink-400" strokeWidth={2} aria-hidden="true" />
        <h2 className="font-display text-[14px] font-bold">Filters</h2>
      </header>

      <div className="px-2 py-1">
        <Section title="Category">
          {isLoading ? (
            <div className="space-y-2 px-2 py-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <TreeBranch nodes={tree ?? []} depth={0} path={path} onSelect={setPathLevel} />
          )}
        </Section>

        {facets?.partType?.length > 0 && (
          <Section title="Part Type">
            <div className="max-h-64 overflow-y-auto scroll-slim">
              {facets.partType.map((option) => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  count={option.count}
                  checked={facetState.partType.includes(option.value)}
                  onChange={() => toggleFacet('partType', option.value)}
                />
              ))}
            </div>
          </Section>
        )}

        {facets?.grade?.length > 0 && (
          <Section title="Condition Grade">
            {GRADE_ORDER.filter((grade) => facets.grade.some((g) => g.value === grade)).map(
              (grade) => {
                const option = facets.grade.find((g) => g.value === grade);
                return (
                  <Checkbox
                    key={grade}
                    label={GRADES[grade]?.label ?? grade}
                    count={option.count}
                    checked={facetState.grade.includes(grade)}
                    onChange={() => toggleFacet('grade', grade)}
                  />
                );
              },
            )}
          </Section>
        )}

        <Section title="Availability">
          <Checkbox
            label="In stock only"
            count={facets?.availability?.inStock}
            checked={facetState.inStockOnly}
            onChange={(event) => setFacet('inStockOnly', event.target.checked)}
          />
        </Section>
      </div>
    </aside>
  );
}

export default SidebarFilter;
