import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CalendarRange, ChevronDown } from 'lucide-react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import Button from '@/components/ui/Button';
import { pressable } from '@/lib/motion';
import { isoDate, dateRange } from '@/lib/format';

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
 * The applied range, remembered for the session.
 *
 * **The URL still wins.** It stays the single source of truth, so a link is a
 * link and the back button works. `sessionStorage` only answers the question
 * the URL cannot: what range was this operator looking at *before* they
 * followed a link that carried no range at all.
 *
 * Without it, moving Dashboard to Invoices and back silently reset a custom
 * range to "this month" — the operator sets a range once and then loses it on
 * every navigation, which teaches them not to bother setting one.
 *
 * Session rather than local: a range is a working context, not a preference. It
 * should survive a trip to another screen and not still be there tomorrow.
 * Writes are wrapped because a browser with site data blocked throws on access
 * rather than returning null, and a dashboard must not fail to render over a
 * remembered filter.
 */
const RANGE_KEY = 'cellvix:admin:range';

function readStoredRange() {
  try {
    const raw = sessionStorage.getItem(RANGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only a shape this module wrote. A hand-edited or stale value must not
    // reach the query string.
    if (!parsed?.from && !parsed?.to) return null;
    return { from: parsed.from ?? undefined, to: parsed.to ?? undefined };
  } catch {
    return null;
  }
}

function storeRange(range) {
  try {
    if (!range?.from && !range?.to) sessionStorage.removeItem(RANGE_KEY);
    else sessionStorage.setItem(RANGE_KEY, JSON.stringify(range));
  } catch {
    // Storage blocked. The URL still carries the range for this screen.
  }
}

/**
 * Read the applied range. The URL is authoritative; the stored range fills in
 * only when the URL carries none, and the preset default fills in after that.
 */
export function useDateRange(defaultPreset = 'this-month') {
  const [searchParams, setSearchParams] = useSearchParams();
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // Restore into the URL rather than returning a range the address bar
  // disagrees with — otherwise the page and its own link say different things,
  // and `activePreset` below would highlight a pill the URL does not describe.
  useEffect(() => {
    if (from || to) return;
    const stored = readStoredRange();
    if (!stored) return;

    const next = new URLSearchParams(searchParams);
    if (stored.from) next.set('from', stored.from);
    if (stored.to) next.set('to', stored.to);
    setSearchParams(next, { replace: true });
    // Restoring once on mount is the whole behaviour: after this the URL has a
    // range and the guard above returns early.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (from || to) return { from: from ?? undefined, to: to ?? undefined };

  const preset = RANGE_PRESETS.find((item) => item.key === defaultPreset);
  return preset ? preset.resolve() : {};
}

/**
 * What period a figure covers, in words, for a panel or tile heading.
 *
 * **A number without its period is not an answer.** "Collected $1,691.99" is
 * only true of some stretch of time, and once the operator can change that
 * stretch, every figure on the screen has to say which one it is showing —
 * otherwise a filtered dashboard looks exactly like an unfiltered one and the
 * number is read as all-time.
 *
 * Returns the preset's own name where the range is one ("This Month"), because
 * that is what the operator picked and what they will recognise. A composed
 * range gets its dates, and a single day gets stated once rather than as
 * "05-Sep-26 – 05-Sep-26".
 *
 * @returns {string} e.g. "This Month" · "05-Sep-26" · "01-Jan-26 – 04-Sep-26"
 */
export function rangeLabel(range, presets = RANGE_PRESETS) {
  if (!range?.from && !range?.to) return 'All time';

  const preset = presets.find((item) => {
    const resolved = item.resolve();
    return resolved.from === range.from && resolved.to === range.to;
  });
  if (preset) return preset.label;

  return dateRange(range.from, range.to);
}

/** The same, lower-cased for use mid-sentence ("in this period"). */
export function rangeSentence(range, presets = RANGE_PRESETS) {
  const label = rangeLabel(range, presets);
  // A preset name reads as prose in lower case; a date must not be touched.
  return /^[A-Z][a-z]+ [A-Z]/.test(label) ? label.toLowerCase() : label;
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
    // Remembered for the session, so the next screen opens on the same period.
    // Reset commits `{}`, which clears the stored range rather than preserving
    // one the operator just cleared.
    storeRange(range);
  }

  const activePreset = presets.find((preset) => {
    const range = preset.resolve();
    return range.from === applied.from && range.to === applied.to;
  });

  // Apply is enabled whenever the draft describes a usable range.
  //
  // It used to require the draft to DIFFER from what is applied, which quietly
  // stranded the most ordinary case: "This Month" already resolves to
  // 1st → today, so an operator opening the panel and picking today as the end
  // date produced a draft identical to the preset — and the button they were
  // reaching for was disabled with nothing on screen saying why.
  //
  // A no-op Apply is harmless: it commits the same range and closes the panel,
  // which is exactly what the operator asked for. What must be blocked is an
  // impossible range, not an unchanged one.
  const validRange = Boolean(draft.from || draft.to) && (!draft.from || !draft.to || draft.from <= draft.to);

  // Today in local time, as the ISO string a date input takes. Caps both
  // fields: a range cannot end in the future, and `from` cannot start after
  // it. Computed per render rather than at module load so a tab left open
  // overnight does not keep yesterday's ceiling.
  const today = iso(new Date());

  // A range that matches no preset is a custom one, and the button says so
  // rather than leaving the operator to read two dates to find out.
  const isCustom = !activePreset && (applied.from || applied.to);
  const customLabel = isCustom ? dateRange(applied.from, applied.to) : 'Custom range';

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-x-2 gap-y-2', className)}>
      {/* A segmented control on its own track, not a row of bare words.
          Unlabelled text sitting directly on the page background reads as a
          caption rather than as something pressable — an operator has to guess
          the row is interactive. The inset track states "these are controls and
          they are one set", and the active segment is a raised surface inside
          it, which is the same figure/ground relationship a physical selector
          has.

          **Custom range lives INSIDE the track**, as the last segment. It is
          one of the same choices — a period — and pushing it to the far end of
          the row made it read as a separate tool that did something else. In
          the track it also shows its selected state the same way every other
          segment does, so "which period am I on" has one answer in one place.

          `overflow-x-auto` rather than wrapping: on a 375px screen the presets
          cannot fit, and a track that wraps to two lines pushes the whole
          dashboard down for a control used once. Scrolling keeps the strip one
          row and reachable. `min-w-0` lets it actually shrink inside the flex
          row — without it the last segment is clipped off the viewport edge. */}
      <div
        ref={popoverRef}
        className="flex min-w-0 max-w-full items-center rounded-lg border border-line bg-surface-2 p-0.5"
      >
        <div
          role="group"
          aria-label="Date range presets"
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {presets.map((preset) => {
            const isActive = activePreset?.key === preset.key;

            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => commit(preset.resolve())}
                aria-pressed={isActive}
                className={cn(
                  pressable,
                  'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-md font-medium',
                  isActive
                    ? // Raised out of the track: a real surface with a hairline,
                      // so the chosen segment is legible without colouring it.
                      // Bordered, not shadowed — §2 allows one or the other.
                      'border border-line bg-surface font-semibold text-ink-900'
                    : // The inactive segment owns a transparent border so
                      // activating one does not shift the row by a pixel.
                      'border border-transparent text-ink-500 hover:text-ink-900',
                )}
              >
                {preset.label}
              </button>
            );
          })}

        </div>

        {/* A hairline between the fixed periods and the one you compose
            yourself. They are the same kind of choice but not the same kind
            of act, and the rule says so without a second container. */}
        <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />

        {/* OUTSIDE the scrolling strip, deliberately.
        
            The strip is `overflow-x-auto` so the presets can scroll on a narrow
            screen — and an overflow container CLIPS its children in both axes,
            so a popover rendered inside it is invisible no matter where it is
            positioned. The trigger is therefore a sibling of the strip rather
            than its last item: it keeps the same track and the same divider,
            but the panel it opens has nothing to be clipped by.
        
            `relative` here makes this wrapper the positioning context, so the
            panel still hangs off the button and not off the strip. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-pressed={Boolean(isCustom)}
            className={cn(
              pressable,
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-md font-medium',
              isCustom
                ? 'border border-line bg-surface font-semibold text-ink-900'
                : 'border border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            <CalendarRange className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="tnum">{customLabel}</span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 transition-transform duration-fast ease-entrance',
                open && 'rotate-180',
              )}
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </button>

        {open && (
          <div
            role="dialog"
            aria-label="Custom date range"
            // Anchored to the BUTTON's right edge, not the track's left. The
            // positioning context used to be the whole strip, so the panel
            // opened under "Today" — metres from the control that summoned it,
            // which reads as a different element entirely. A popover has to
            // come out of its own trigger. It grows inward (right-anchored)
            // because the button sits at the strip's end.
            //
            // `max-w-` keeps it on a phone screen; the width is set by the two
            // inputs, which need real room — a native date input renders
            // `05-Sep-2026` plus a calendar glyph, and under ~150px the year
            // truncates.
            className="absolute right-0 top-full z-40 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-3.5 shadow-card"
          >
            {/* The two dates read as one sentence — "from A to B" — rather than
                two independent fields that happen to sit together. The word
                carries the relationship, so neither input needs a label above
                it repeating what the row already says. */}
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="eyebrow text-ink-400">From</span>
                <input
                  type="date"
                  value={draft.from ?? ''}
                  max={draft.to || today}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, from: event.target.value }))
                  }
                  className="tnum h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink-900 focus:border-brand focus:outline-none"
                />
              </label>

              <span className="mt-5 shrink-0 text-sm text-ink-400" aria-hidden="true">
                to
              </span>

              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="eyebrow text-ink-400">To</span>
                <input
                  type="date"
                  value={draft.to ?? ''}
                  min={draft.from || undefined}
                  // Capped at today, and today itself is selectable: a range
                  // ending yesterday silently drops the day the operator is
                  // standing in, which is usually the one they care about.
                  max={today}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, to: event.target.value }))
                  }
                  className="tnum h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink-900 focus:border-brand focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              {/* One tap for the common end date, so reaching today does not
                  mean opening a calendar and finding it. Sits on the action
                  row because it is one — it changes the draft, like Reset. */}
              <button
                type="button"
                onClick={() => setDraft((current) => ({ ...current, to: today }))}
                className={cn(
                  pressable,
                  '-ml-1 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand-50',
                )}
              >
                End today
              </button>

              <div className="flex gap-2">
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
                  disabled={!validRange}
                  onClick={() => {
                    commit(draft);
                    setOpen(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default DateRangeBar;
