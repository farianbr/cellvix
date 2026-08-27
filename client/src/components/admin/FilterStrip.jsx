import { useRef, useState } from 'react';
import { ChevronDown, Download, Search, SlidersHorizontal, X } from 'lucide-react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';

/**
 * The filter strip above every admin list (ERP rework §4, convention 8):
 * search · segmented pills with counts · `Filters ▾` · `Export ▾`.
 *
 * Pills are the primary filter and carry their counts, because "Pending (3)" is
 * the number an operator is actually looking for. `Filters ▾` holds the long
 * tail — province, terms, date — in a popover, so the strip stays one line.
 *
 * **Export honours the current filters.** The component passes them to the
 * handler rather than exporting the unfiltered set; an export that ignores the
 * active filters is a bug, not a shortcut (§7.4).
 */

function Popover({ label, icon: Icon, children, align = 'left', badge }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-[8px] border px-2.5 text-[13px] font-medium transition-colors',
          badge
            ? 'border-brand-100 bg-brand-50 text-brand-700'
            : 'border-line bg-surface text-ink-600 hover:border-line-strong hover:text-ink-900',
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
        {label}
        {badge > 0 && (
          <span className="tnum rounded-full bg-brand px-1.5 text-[10.5px] font-semibold leading-[16px] text-white">
            {badge}
          </span>
        )}
        <ChevronDown className="size-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full z-20 mt-1 min-w-[220px] rounded-[10px] border border-line bg-surface p-3 shadow-card',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          onClick={(event) => {
            // A menu of one-shot actions closes on pick; a panel of filters
            // stays open so several can be set in one go.
            if (event.target.closest('[data-close-on-select]')) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function FilterStrip({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  pills = [],
  activePill,
  onPillChange,
  filters,
  activeFilterCount = 0,
  onClearFilters,
  exportFormats = ['CSV', 'XLSX'],
  onExport,
  actions,
  className,
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4', className)}>
      {onSearchChange && (
        <div className="relative min-w-[180px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-300"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search ?? ''}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-[8px] border border-line bg-surface pl-8 pr-8 text-[13px] text-ink-900 placeholder:text-ink-300"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-ink-300 hover:text-ink-700"
            >
              <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {pills.length > 0 && (
        <div className="scroll-slim flex max-w-full gap-1.5 overflow-x-auto">
          {pills.map((pill) => {
            const isActive = activePill === pill.value;

            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => onPillChange?.(pill.value)}
                aria-pressed={isActive}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-2.5 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'border-transparent bg-brand-gradient text-white'
                    : 'border-line bg-surface text-ink-600 hover:border-line-strong hover:text-ink-900',
                )}
              >
                {pill.label}
                {pill.count != null && (
                  <span
                    className={cn(
                      'tnum text-[11.5px]',
                      isActive ? 'text-white/75' : 'text-ink-300',
                    )}
                  >
                    {pill.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {actions}

        {filters && (
          <Popover label="Filters" icon={SlidersHorizontal} badge={activeFilterCount}>
            <div className="space-y-3">
              {filters}
              {activeFilterCount > 0 && onClearFilters && (
                <button
                  type="button"
                  data-close-on-select
                  onClick={onClearFilters}
                  className="w-full rounded-[7px] border border-line px-2 py-1.5 text-[12.5px] text-ink-500 transition-colors hover:border-line-strong hover:text-ink-900"
                >
                  Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </Popover>
        )}

        {onExport && (
          <Popover label="Export" icon={Download} align="right">
            <div className="-m-1 flex flex-col">
              {exportFormats.map((format) => (
                <button
                  key={format}
                  type="button"
                  data-close-on-select
                  onClick={() => onExport(format)}
                  className="rounded-[7px] px-2.5 py-2 text-left text-[13px] text-ink-700 transition-colors hover:bg-surface-2 hover:text-ink-900"
                >
                  Export {format}
                </button>
              ))}
              <p className="mt-1 border-t border-line px-2.5 pt-2 text-[11.5px] leading-snug text-ink-400">
                Exports the current filters and date range, not the whole table.
              </p>
            </div>
          </Popover>
        )}
      </div>
    </div>
  );
}

export default FilterStrip;
