import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronsUpDown, Minus, MoreHorizontal } from 'lucide-react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';

/**
 * The admin list table. Fourteen planned screens are this table with different
 * columns, so it is built once (ERP rework §4).
 *
 * Columns are declared, not written as JSX:
 *
 *   { key, header, render?, sortValue?, align?, width?, priority?, className? }
 *
 * `priority` drives the responsive contract (§4, Responsive):
 *   1  always visible, including the stacked mobile card
 *   2  visible from 768 up
 *   3  visible from 1024 up
 * Anything hidden at the current width folds into the expandable row rather
 * than disappearing — a column you cannot reach is a column you have lost.
 *
 * Sorting is client-side over the rows given. A screen that paginates
 * server-side passes `sortable: false` on its columns and sorts upstream,
 * because sorting one page of twenty-five is a lie about the whole set.
 */

/**
 * A bare checkbox. `ui/Checkbox` is a labelled filter row and is the wrong shape
 * in a cell, but the **mark** is copied from it deliberately.
 *
 * `appearance-none` removes the platform tick along with the platform box, so a
 * checked row used to render as a filled brand square with nothing in it — the
 * colour was the only signal, which reads as a highlight rather than a
 * selection, and disappears entirely for anyone who cannot separate the two
 * tones. The glyph is drawn on top: a check when selected, a dash when the
 * header is partially selected, matching `ui/Checkbox`.
 */
function CellCheckbox({ checked, indeterminate, onChange, label }) {
  const ref = useRef(null);
  const isPartial = Boolean(indeterminate) && !checked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isPartial;
  }, [isPartial]);

  return (
    <span className="relative flex size-[16px] shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="peer absolute size-full cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-surface transition-colors checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand focus-visible:outline-none"
      />

      {isPartial ? (
        <Minus
          className="pointer-events-none relative size-2.5 text-white"
          strokeWidth={3.5}
          aria-hidden="true"
        />
      ) : (
        <Check
          className="pointer-events-none relative size-2.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3.5}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

/** The `···` menu in the last column. One open at a time, closes on outside click. */
function RowMenu({ items, row }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false));

  const usable = items.filter((item) => !item.hidden?.(row));
  if (!usable.length) return null;

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Row actions"
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-[8px] text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900"
      >
        <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card">
          {usable.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key ?? item.label}
                type="button"
                disabled={item.disabled?.(row)}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.(row);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  item.tone === 'danger'
                    ? 'text-danger hover:bg-danger-50'
                    : 'text-ink-700 hover:bg-surface-2 hover:text-ink-900',
                )}
              >
                {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
                {typeof item.label === 'function' ? item.label(row) : item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PRIORITY_CLASS = {
  1: '',
  2: 'hidden md:table-cell',
  3: 'hidden lg:table-cell',
};

const ALIGN_CLASS = { right: 'text-right', center: 'text-center', left: 'text-left' };

function defaultSortValue(row, column) {
  const raw = column.sortValue ? column.sortValue(row) : row[column.key];
  return raw ?? '';
}

export function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id ?? row._id,
  selectable = false,
  selected = [],
  onSelectionChange,
  rowMenu,
  onRowClick,
  sortable = true,
  defaultSort,
  empty,
  loading,
  footer,
  className,
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [expanded, setExpanded] = useState(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;

    // Numbers compare numerically, everything else by locale — a string sort
    // over money puts $1,000 before $9.
    return [...rows].sort((a, b) => {
      const left = defaultSortValue(a, column);
      const right = defaultSortValue(b, column);
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), undefined, { numeric: true });
      return sort.direction === 'desc' ? -result : result;
    });
  }, [rows, sort, columns]);

  const allKeys = sorted.map(rowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((key) => selected.includes(key));
  const someSelected = allKeys.some((key) => selected.includes(key));

  function toggleSort(column) {
    if (!sortable || column.sortable === false) return;
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, direction: 'asc' };
      if (current.direction === 'asc') return { key: column.key, direction: 'desc' };
      return null;
    });
  }

  function toggleRow(key, checked) {
    if (!onSelectionChange) return;
    onSelectionChange(
      checked ? [...new Set([...selected, key])] : selected.filter((value) => value !== key),
    );
  }

  if (loading) {
    return (
      <div className={cn('space-y-2 p-4 sm:p-5', className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-[10px] bg-surface-2" />
        ))}
      </div>
    );
  }

  if (!sorted.length) return empty ?? null;

  // Columns folded away at the current width still have to be reachable, so the
  // expandable row renders every one that is not priority 1.
  const foldable = columns.filter((column) => (column.priority ?? 1) > 1);

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line">
              {selectable && (
                <th scope="col" className="w-10 px-4 py-2.5">
                  {/* Select-all adds and removes **this page's** keys rather
                      than replacing the whole selection. On a paginated list
                      the old `checked ? allKeys : []` silently discarded rows
                      picked on another page the moment the header box was
                      touched — the operator sees a count drop with no row
                      changing in front of them. */}
                  <CellCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={(checked) =>
                      onSelectionChange?.(
                        checked
                          ? [...new Set([...selected, ...allKeys])]
                          : selected.filter((key) => !allKeys.includes(key)),
                      )
                    }
                    label={allSelected ? 'Clear selection' : 'Select all rows'}
                  />
                </th>
              )}

              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const canSort = sortable && column.sortable !== false;
                const Arrow = !isSorted
                  ? ChevronsUpDown
                  : sort.direction === 'asc'
                    ? ArrowUp
                    : ArrowDown;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'eyebrow whitespace-nowrap px-4 py-2.5 text-ink-400',
                      PRIORITY_CLASS[column.priority ?? 1],
                      ALIGN_CLASS[column.align ?? 'left'],
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        // The arrow always trails the label. `flex-row-reverse`
                        // was tried here to right-align the pair and is wrong:
                        // it reverses the children, so the arrow landed on the
                        // *left* of a right-aligned column while every other
                        // column kept it on the right. The `th` already carries
                        // `text-right`, and an `inline-flex` button is an inline
                        // box — so it is pushed to the right edge by that
                        // text-align on its own, with nothing to do here.
                        className={cn(
                          'eyebrow inline-flex items-center gap-1 transition-colors hover:text-ink-700',
                          isSorted && 'text-ink-900',
                        )}
                      >
                        {column.header}
                        <Arrow
                          className={cn('size-3', isSorted ? 'text-brand' : 'text-ink-200')}
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}

              {/* Labelled, not blank. An unnamed trailing column reads as a
                  rendering gap — the `···` looks like it belongs to the last
                  data column rather than being an actions cell of its own. */}
              {rowMenu && (
                <th scope="col" className="eyebrow w-20 px-4 py-2.5 text-right text-ink-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {sorted.map((row) => {
              const key = rowKey(row);
              const isSelected = selected.includes(key);
              const isExpanded = expanded === key;

              return (
                <Fragment key={key}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-line last:border-0 transition-colors',
                      isSelected ? 'bg-brand-50/60' : 'hover:bg-surface-2',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <CellCheckbox
                          checked={isSelected}
                          onChange={(checked) => toggleRow(key, checked)}
                          label={`Select row ${key}`}
                        />
                      </td>
                    )}

                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-3 align-middle text-[13px] text-ink-700',
                          PRIORITY_CLASS[column.priority ?? 1],
                          ALIGN_CLASS[column.align ?? 'left'],
                          column.className,
                        )}
                      >
                        {/* Only the first cell needs the flex row, and only
                            when there is a disclosure to sit in it.

                            Every cell used to be wrapped in
                            `flex items-center`, which silently defeated
                            `align: 'right'` on every column that asked for it:
                            a flex container's children are laid out by
                            `justify-content`, so the inherited `text-align`
                            did nothing and money columns sat left under
                            right-aligned headers. Wrapping only where a
                            disclosure exists lets the `td`'s own text-align
                            apply everywhere else. */}
                        {index === 0 && foldable.length > 0 ? (
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpanded(isExpanded ? null : key);
                              }}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Hide details' : 'Show details'}
                              className="flex size-5 shrink-0 items-center justify-center rounded text-ink-300 hover:bg-surface-3 hover:text-ink-700 lg:hidden"
                            >
                              <ChevronsUpDown className="size-3" strokeWidth={2.25} aria-hidden="true" />
                            </button>
                            <span className="min-w-0">
                              {column.render ? column.render(row) : row[column.key]}
                            </span>
                          </span>
                        ) : (
                          column.render ? column.render(row) : row[column.key]
                        )}
                      </td>
                    ))}

                    {rowMenu && (
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <RowMenu items={rowMenu} row={row} />
                      </td>
                    )}
                  </tr>

                  {isExpanded && foldable.length > 0 && (
                    <tr className="border-b border-line bg-surface-2 lg:hidden">
                      <td
                        colSpan={columns.length + (selectable ? 1 : 0) + (rowMenu ? 1 : 0)}
                        className="px-4 py-3"
                      >
                        <dl className="grid gap-2 sm:grid-cols-2">
                          {foldable.map((column) => (
                            <div key={column.key} className="flex items-baseline gap-2">
                              <dt className="eyebrow shrink-0 text-ink-400">{column.header}</dt>
                              <dd className="min-w-0 text-[13px] text-ink-700">
                                {column.render ? column.render(row) : row[column.key]}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {footer}
    </div>
  );
}

/**
 * The count line every list carries above its table (§4, convention 9):
 * `35 clients` · `Showing 1–25 of 27 tickets`.
 */
export function CountLine({ total, shown, noun, className }) {
  const label =
    shown != null && total != null && shown < total
      ? `Showing 1–${shown} of ${total} ${noun}`
      : `${total ?? shown ?? 0} ${noun}`;

  return <p className={cn('tnum text-[12.5px] text-ink-400', className)}>{label}</p>;
}

export default DataTable;
