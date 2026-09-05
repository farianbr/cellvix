import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import cn from '@/lib/cn';
import { money, count as formatCount } from '@/lib/format';
import Skeleton from '@/components/ui/Skeleton';
import { useAdminInventory } from '@/hooks/useAdmin';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import useAnchoredPosition from '@/hooks/useAnchoredPosition';
import { pressable } from '@/lib/motion';

/** Height of one result row — a two-line row at `p-2`. */
const ROW_H = 52;

/**
 * The item field on a purchase-order line: search by name, SKU or barcode, or
 * scan straight into it.
 *
 * **Not `ProductPicker`.** That one is the buyer's quick-order pad and reads
 * the storefront catalogue: it carries no cost and no barcode, and it answers
 * with what a customer may buy. A purchase order needs the opposite of that —
 * the part's *cost*, its barcode, and above all the out-of-stock rows, because
 * restocking something that has run out is the single most common reason to
 * raise a PO. So this reads `/admin/inventory`, which already searches all
 * three fields and returns cost, barcode and stock.
 *
 * **A scanner is just a very fast keyboard.** It types the barcode and presses
 * Enter, so the field needs no scanner integration: the search matches barcodes,
 * and Enter commits the highlighted row. A single exact barcode match commits
 * itself, which is what makes scanning a line feel like scanning rather than
 * like searching.
 *
 * `onChange` receives the whole inventory row (or `null`), so the caller can
 * fill SKU, barcode and unit cost from one selection rather than looking any of
 * them up again.
 */
export function InventoryPicker({ value, onChange, autoFocus = false, className }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const debounced = useDebouncedValue(query, 220);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = `${useId()}-inventory`;

  const ready = debounced.trim().length >= 2;
  const { data, isFetching } = useAdminInventory({ q: debounced.trim() }, ready);

  const products = ready ? (data?.products ?? []).slice(0, 8) : [];
  const showPanel = open && ready;

  const [panelStyle] = useAnchoredPosition(containerRef, showPanel, {
    maxHeight: ROW_H * 6,
    padding: 8,
    matchWidth: true,
  });

  useOnClickOutside([containerRef], () => setOpen(false), open);

  useEffect(() => {
    setHighlight(0);
  }, [debounced]);

  /**
   * An exact barcode match commits itself.
   *
   * This is what separates scanning from searching: a scanner types the whole
   * code and the operator's hands are already on the next box, so making them
   * confirm a list of one defeats the point. Only an exact, unique match
   * auto-commits — a partial or ambiguous one still opens the list.
   */
  useEffect(() => {
    if (!ready || products.length !== 1) return;
    const only = products[0];
    if (only.barcode && only.barcode.toLowerCase() === debounced.trim().toLowerCase()) {
      commit(only);
    }
    // `commit` is stable enough for this: it only closes the panel and calls up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, products.length, ready]);

  function commit(product) {
    onChange?.(product);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(event) {
    if (!showPanel) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, products.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      // The row wins over the form: Enter in a search box that has results is
      // choosing one, not submitting a half-filled purchase order.
      event.preventDefault();
      if (products[highlight]) commit(products[highlight]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  // A chosen line shows what it is, with a clear button — the search box is for
  // finding, and leaving it in place after a choice invites re-searching a row
  // that is already filled in.
  if (value) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink-900">{value.name}</span>
          <span className="block truncate font-mono text-2xs text-ink-400">{value.sku}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange?.(null)}
          aria-label={`Clear ${value.name}`}
          className={cn(pressable, 'flex size-7 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-2 hover:text-ink-700')}
        >
          <X className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <span className="relative block">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={query}
          placeholder="Search or scan sku / barcode…"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            'h-9 w-full rounded-md border border-line bg-surface pl-8 pr-2.5',
            'text-sm text-ink-900 placeholder:text-ink-300',
            'transition-[border-color,box-shadow] duration-press',
            'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
          )}
        />
      </span>

      {showPanel &&
        createPortal(
          <div
            style={panelStyle}
            className="z-[70] overflow-hidden rounded-md bg-surface shadow-pop"
          >
            <ul ref={listRef} id={listId} role="listbox" className="scroll-slim max-h-[312px] overflow-y-auto py-1">
              {isFetching && products.length === 0 && (
                <li className="p-2">
                  <Skeleton className="h-9" rounded="md" />
                </li>
              )}

              {!isFetching && products.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-ink-400">
                  Nothing matches “{debounced.trim()}”.
                </li>
              )}

              {products.map((product, index) => (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={index === highlight}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => commit(product)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2',
                    index === highlight ? 'bg-surface-2' : 'bg-transparent',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-900">{product.name}</span>
                    <span className="block truncate font-mono text-2xs text-ink-400">
                      {product.sku}
                      {product.barcode && ` · ${product.barcode}`}
                    </span>
                  </span>

                  {/* Stock is shown but never disqualifies a row: a part at zero
                      is the most likely thing on a purchase order. */}
                  <span
                    className={cn(
                      'tnum shrink-0 text-2xs',
                      product.stock > 0 ? 'text-ink-400' : 'text-warn',
                    )}
                  >
                    {formatCount(product.stock)} in stock
                  </span>
                  <span className="tnum shrink-0 text-xs font-medium text-ink-700">
                    {money(product.cost > 0 ? product.cost : 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default InventoryPicker;
