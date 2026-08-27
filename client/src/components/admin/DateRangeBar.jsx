import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import cn from '@/lib/cn';
import Button from '@/components/ui/Button';

/**
 * The date control every Reports tab and the dashboard share (ERP rework §4,
 * convention 13): From / To inputs, Apply and Reset, then a row of preset pills.
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

export function DateRangeBar({ presets = RANGE_PRESETS, defaultPreset = 'this-month', className }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const applied = useDateRange(defaultPreset);

  const [draft, setDraft] = useState(applied);

  // The URL can change without this component (a preset pill elsewhere, the
  // back button), so the draft follows what is actually applied.
  useEffect(() => {
    setDraft(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.from, applied.to]);

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

  return (
    <div className={cn('mb-4 rounded-[12px] border border-line bg-surface p-3', className)}>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="eyebrow text-ink-400">From</span>
          <input
            type="date"
            value={draft.from ?? ''}
            max={draft.to || undefined}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            className="h-9 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="eyebrow text-ink-400">To</span>
          <input
            type="date"
            value={draft.to ?? ''}
            min={draft.from || undefined}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            className="h-9 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink-900"
          />
        </label>

        <Button size="sm" onClick={() => commit(draft)} disabled={!dirty}>
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={() => commit({})}>
          Reset
        </Button>
      </div>

      <div className="scroll-slim -mb-1 mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {presets.map((preset) => {
          const isActive = activePreset?.key === preset.key;

          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => commit(preset.resolve())}
              aria-pressed={isActive}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                isActive
                  ? 'border-transparent bg-brand-gradient text-white'
                  : 'border-line bg-surface text-ink-500 hover:border-line-strong hover:text-ink-900',
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DateRangeBar;
