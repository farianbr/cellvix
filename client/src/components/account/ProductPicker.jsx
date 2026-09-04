import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import cn from '@/lib/cn';
import { money } from '@/lib/format';
import Skeleton from '@/components/ui/Skeleton';
import { PartVisual } from '@/components/product/PartFrame';
import { useSearchSuggestions } from '@/hooks/useCatalog';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import useAnchoredPosition from '@/hooks/useAnchoredPosition';

/** Height of one result row — see the row markup below (p-1.5 + a size-8 tile). */
const ROW_H = 51;

/**
 * A single-product combobox for the quick order pad.
 *
 * Typing a SKU from memory is how a line got entered before, which meant every
 * typo came back as "SKU not found" after the whole pad had been filled in. The
 * catalogue search matches SKU as well as name, so the same keystrokes now find
 * the part — and what lands in the row is a product that certainly exists, with
 * its stock state visible before the line is submitted.
 *
 * `value` is the chosen product (or null); `onChange` receives one or null.
 */
export function ProductPicker({ value, onChange, label, autoFocus = false, className }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const debounced = useDebouncedValue(query, 220);
  const { data, isFetching } = useSearchSuggestions(debounced);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = `${useId()}-options`;

  const products = data?.products ?? [];
  const showPanel = open && debounced.trim().length >= 2;

  // The pad lives inside a Panel, which clips its overflow to keep its rounded
  // corners — an absolutely-positioned list was cut off at the panel's edge.
  // Portalled and anchored to the field, so it opens over everything and sizes
  // itself to the room actually left below (or above) the row.
  const [panelStyle] = useAnchoredPosition(containerRef, showPanel, {
    align: 'left',
    // Six results at ROW_H plus the list's own 6px of padding, so a full set
    // fits without scrolling and a constrained one ends on a whole row rather
    // than half of one.
    maxHeight: ROW_H * 6 + 12,
    rowHeight: ROW_H,
    padding: 12,
    matchWidth: true,
  });

  // The list is portalled, so it is not inside containerRef — both refs count as
  // "inside" or the first click on a result closes the menu before it lands.
  useOnClickOutside([containerRef, listRef], () => setOpen(false), open);

  useEffect(() => {
    setHighlight(0);
  }, [debounced]);

  function choose(product) {
    onChange(product);
    setQuery('');
    setOpen(false);
  }

  // ---- chosen state ------------------------------------------------------
  if (value) {
    return (
      <div
        className={cn(
          'flex min-h-11 items-center gap-2.5 rounded-md border border-line bg-surface-2 px-2.5 py-1.5',
          className,
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface p-1">
          <PartVisual product={value} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-sm font-medium text-ink-900">{value.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
            <span className="font-mono">{value.sku}</span>
            {value.priceVisible && <span className="tnum">{money(value.price)}</span>}
            <span className={value.inStock ? 'text-ok' : 'text-danger'}>
              {value.inStock ? 'In stock' : 'Out of stock'}
            </span>
          </span>
        </span>

        <button
          type="button"
          onClick={() => {
            onChange(null);
            // Put the cursor back where the buyer is about to type.
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-label={`Clear ${value.name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-surface-3 hover:text-ink-900"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

  // ---- search state ------------------------------------------------------
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-label={label}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!showPanel || products.length === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlight((index) => (index + 1) % products.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlight((index) => (index - 1 + products.length) % products.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              choose(products[highlight]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="Search part or SKU…"
          className={cn(
            // 16px on a phone: mobile Safari zooms into anything smaller and
            // never zooms back out. Same rule as every other field.
            'h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-lg text-ink-900 sm:text-md',
            'placeholder:text-ink-300',
            'transition-[border-color,box-shadow] duration-press',
            'hover:border-line-strong',
            'focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900/15',
          )}
        />
      </div>

      {showPanel &&
        panelStyle &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={panelStyle}
            className="scroll-slim z-60 overflow-y-auto rounded-lg bg-surface p-1.5 shadow-flyout"
          >
            {isFetching && !data ? (
              <li className="space-y-1.5 p-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </li>
            ) : products.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-400">
                No parts match “{debounced}”.
              </li>
            ) : (
              products.map((product, index) => (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(product)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                      index === highlight ? 'bg-surface-2' : 'hover:bg-surface-2',
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 p-1">
                      <PartVisual product={product} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-ink-900">
                        {product.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-2xs text-ink-400">
                        {product.sku}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      {product.priceVisible && (
                        <span className="tnum block font-display text-sm font-bold text-ink-900">
                          {money(product.price)}
                        </span>
                      )}
                      <span
                        className={cn(
                          'block text-2xs',
                          product.inStock ? 'text-ok' : 'text-ink-300',
                        )}
                      >
                        {product.inStock ? 'In stock' : 'Out of stock'}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}

export default ProductPicker;
