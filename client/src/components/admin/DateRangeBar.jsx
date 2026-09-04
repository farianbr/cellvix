import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CalendarRange, ChevronDown } from 'lucide-react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import Button from '@/components/ui/Button';

/**
 * The date control every Reports tab and the dashboard share (ERP rework §4,
 * convention 13): a row of preset options, then a **Custom range** button that
 * opens the From / To pair in a popover.
 *
 * **The presets lead and the calendar is folded away** because picking "This
 * Month" is the common act and typing two dates is the rare one. Two date
 * inputs sitting open above the presets read as the primary control and push
 * the presets — the thing actually used — below the fold of the eye. The
 * button states the applied range, so nothing is hidden that was not already
 * legible; opening it is only needed to *change* an unusual range.
 *
 * **The range lives in the URL** (`?from=&to=`), so any view is a link — an
 * operator sends "here is the quarter I mean" rather than "set the dates to".
 * The inputs are local draft state until Apply, because a half-typed date must
 * not refetch the page on every keystroke.
 *
 * Presets are computed in the browser's timezone, which is the operator's, and
 * both bounds are inclusive whole days: `from` is 00:00 and `to` is the date
 * itself — the server is responsible for treating `to` as end-of-day.
 */

/** `YYYY-MM-DD` in local time. `toISOString()` would shift the day in every timezone west of UTC. */
function iso(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const result = new Date(date);
  // Monday-first: Canadian business weeks do not start on Sunday.
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result;
}

export const RANGE_PRESETS = [
  {
    key: 'today',
    label: 'Today',
    resolve: () => {
      const now = new Date();
      return { from: iso(now), to: iso(now) };
    },
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    resolve: () => {
      const day = new Date();
      day.setDate(day.getDate() - 1);
      return { from: iso(day), to: iso(day) };
    },
  },
  {
    key: 'this-week',
    label: 'This Week',
    resolve: () => ({ from: iso(startOfWeek(new Date())), to: iso(new Date()) }),
  },
  {
    key: 'last-week',
    label: 'Last Week',
    resolve: () => {
      const start = startOfWeek(new Date());
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: iso(start), to: iso(end) };
    },
  },
  {
    key: 'this-month',
    label: 'This Month',
    resolve: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    },
  },
  {
    key: 'last-month',
    label: 'Last Month',
    resolve: () => {
      const now = new Date();
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
  {
    key: 'this-year',
    label: 'This Year',
    resolve: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    },
  },
  {
    key: 'last-year',
    label: 'Last Year',
    resolve: () => {
      const year = new Date().getFullYear() - 1;
      return { from: iso(new Date(year, 0, 1)), to: iso(new Date(year, 11, 31)) };
    },
  },
];

/** The dashboard wants a shorter list than Reports; both come from the same table. */
export const DASHBOARD_PRESETS = RANGE_PRESETS.filter((preset) =>
  ['today', 'this-week', 'this-month', 'last-month', 'this-year'].includes(preset.key),
);

/**
 * Read the applied range straight from the URL. Screens use this rather than
 * lifting state, so the URL stays the single source of truth.
 */
export function useDateRange(defaultPreset = 'this-month') {
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (from || to) return { from: from ?? undefined, to: to ?? undefined };

  const preset = RANGE_PRESETS.find((item) => item.key === defaultPreset);
  return preset ? preset.resolve() : {};
}

/** `2026-08-31` as `31 Aug 2026`, parsed as a local date rather than UTC midnight. */
function label(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DateRangeBar({ presets = RANGE_PRESETS, defaultPreset = 'this-month', className }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const applied = useDateRange(defaultPreset);

  const [draft, setDraft] = useState(applied);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  useOnClickOutside(popoverRef, () => setOpen(false));

  // The URL can change without this component (a preset pill elsewhere, the
  // back button), so the draft follows what is actually applied.
  useEffect(() => {
    setDraft(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.from, applied.to]);

  // Escape closes the popover, which is what a keyboard user reaches for
  // before they find the button again to toggle it shut.
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function commit(range) {
    const next = new URLSearchParams(searchParams);
    if (range.from) next.set('from', range.from);
    else next.delete('from');
    if (range.to) next.set('to', range.to);
    else next.delete('to');
    setSearchParams(next, { replace: true });
  }

  const activePreset = presets.find((preset) => {
    const range = preset.resolve();
    return range.from === applied.from && range.to === applied.to;
  });

  const dirty = draft.from !== applied.from || draft.to !== applied.to;

  // A range that matches no preset is a custom one, and the button says so
  // rather than leaving the operator to read two dates to find out.
  const isCustom = !activePreset && (applied.from || applied.to);
  const customLabel = isCustom
    ? [label(applied.from), label(applied.to)].filter(Boolean).join(' – ')
    : 'Custom range';

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-x-1 gap-y-2', className)}>
      {/* Presets carry no chrome until they are active or hovered: a row of
          eight outlined pills competes with the page's own panels for
          attention, and only one of them is ever the answer. */}
      {presets.map((preset) => {
        const isActive = activePreset?.key === preset.key;

        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => commit(preset.resolve())}
            aria-pressed={isActive}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-md font-medium transition-colors',
              isActive
                ? 'font-semibold text-brand'
                : 'text-ink-500 hover:bg-surface-2 hover:text-ink-900',
            )}
          >
            {preset.label}
          </button>
        );
      })}

      {/* `ml-auto` pushes the button to the far end on a wide row; on a narrow
          one the flex container has already wrapped and it simply starts the
          next line. `min-w-0` + `truncate` keep a long applied range from
          widening the row past the viewport at 320px. */}
      <div ref={popoverRef} className="relative ml-auto min-w-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'flex h-9 max-w-full items-center gap-1.5 rounded-md border px-3 text-md font-medium transition-colors',
            isCustom
              ? 'border-brand/30 bg-brand-50 text-brand-700'
              : 'border-line bg-surface text-ink-700 hover:border-line-strong hover:text-ink-900',
          )}
        >
          <CalendarRange className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className="tnum truncate">{customLabel}</span>
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')}
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Custom date range"
            // `max-w-[calc(100vw-2rem)]` so the popover never hangs off a phone
            // screen; it is right-anchored, so it grows inward.
            className="absolute right-0 top-full z-40 mt-1.5 w-[268px] max-w-[calc(100vw-2rem)] rounded-md bg-surface p-3 shadow-card"
          >
            <div className="flex gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="eyebrow text-ink-400">From</span>
                <input
                  type="date"
                  value={draft.from ?? ''}
                  max={draft.to || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, from: event.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink-900"
                />
              </label>

              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="eyebrow text-ink-400">To</span>
                <input
                  type="date"
                  value={draft.to ?? ''}
                  min={draft.from || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, to: event.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink-900"
                />
              </label>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  commit({});
                  setOpen(false);
                }}
              >
                Reset
              </Button>
              <Button
                size="sm"
                disabled={!dirty}
                onClick={() => {
                  commit(draft);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DateRangeBar;
