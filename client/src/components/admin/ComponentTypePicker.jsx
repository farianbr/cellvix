import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import Input from '@/components/ui/Input';
import { useComponentTypes } from '@/hooks/useCatalog';

/**
 * Pick component types — the tags that decide which suppliers can be asked for
 * a price (supplier process flow, §6.8a).
 *
 * **The list comes from the catalogue, never from a constant here.**
 * `GET /api/taxonomy` already carries `componentTypes`, aggregated from live
 * products by `taxonomyService`, and it is the same list step 1 of the
 * storefront wizard offers. A hard-coded copy would be a second source of truth
 * that goes stale the first time a new part type is stocked — and a supplier
 * tagged against a component nothing is sold under is a supplier who can never
 * be found by the picker that matters.
 *
 * Toggle buttons rather than a multi-select menu: the whole point of this
 * control is seeing at a glance what a supplier covers, and a closed menu
 * showing "3 selected" hides exactly that. `ConsentChannels` makes the same
 * choice for the same reason.
 *
 * Controlled and stateless, like `ConsentChannels`. The search box is local
 * because it is a way of finding a button, not part of the answer.
 */
export function ComponentTypePicker({
  value = [],
  onChange,
  disabled = false,
  /** Above this many types the search box appears. Below it, it is noise. */
  searchThreshold = 12,
  emptyHint = 'No component types in the catalogue yet.',
  className,
}) {
  const { data: types = [] } = useComponentTypes();
  const [query, setQuery] = useState('');



  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return types;
    return types.filter(
      (type) =>
        type.name.toLowerCase().includes(needle) || type.slug.toLowerCase().includes(needle),
    );
  }, [types, query]);

  const selected = new Set(value);

  function toggle(slug) {
    onChange?.(selected.has(slug) ? value.filter((item) => item !== slug) : [...value, slug]);
  }

  if (!types.length) {
    return <p className={cn('text-sm text-ink-400', className)}>{emptyHint}</p>;
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      {types.length > searchThreshold && (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a component type…"
          aria-label="Filter component types"
          icon={Search}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {shown.map((type) => {
          const on = selected.has(type.slug);
          return (
            <button
              key={type.slug}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(type.slug)}
              className={cn(
                pressable,
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium',
                'disabled:cursor-not-allowed disabled:opacity-50',
                on
                  ? 'border-ok/30 bg-ok-50 text-ok'
                  : 'border-line bg-surface text-ink-500 hover:border-line-strong hover:text-ink-900',
              )}
            >
              {on && <Check className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />}
              {type.name}
              {/* How many products carry this type. A tag against a component
                  with two products in the catalogue is worth thinking twice
                  about, and the number is already in the payload. */}
              <span className="text-xs opacity-60">{type.count}</span>
            </button>
          );
        })}
      </div>

      {query && !shown.length && (
        <p className="text-sm text-ink-400">Nothing matches “{query}”.</p>
      )}
    </div>
  );
}

export default ComponentTypePicker;
