import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { count as formatCount } from '@/lib/format';

/**
 * A row of view tabs — one record's sections, or one list's saved filters.
 *
 * **One definition, because there were three**, and they had already drifted:
 * the approvals queue, the reports screen and the customer profile each drew
 * their own, in two different visual languages.
 *
 * ## Why the default is an underline and not a pill
 *
 * The pill version collided with `FilterStrip`. Both drew a
 * `.bg-brand-gradient-compact` box with a rounded count beside it, so a control
 * that *switches which section of a record you are reading* looked exactly like
 * one that *narrows a list*. On the supplier profile the tabs read as filters
 * for the panel underneath — the operator's own report — because in that visual
 * language, that is precisely what they were saying.
 *
 * The two controls now look like the two different things they are:
 *
 *   `underline` (default)  Sections of one record, or one screen's views. The
 *                          selected tab is marked by a rule beneath it and by
 *                          brand-coloured text. Nothing is filled, so it cannot
 *                          be mistaken for a filter pill.
 *   `pills`                A genuine filter — the approvals queue's
 *                          pending/approved/all. Matches `FilterStrip`, which
 *                          is the point: same job, same look.
 *
 * Not `StepIndicator` and not `ProcessStrip`: both of those describe a position
 * in a sequence a record moves through. These tabs are views of the *same*
 * record, in no order, and picking one changes what is displayed rather than
 * what is true.
 *
 * `count` is rendered when a tab defines one, including zero — an "Items
 * supplied 0" tab tells the operator the answer without making them open it,
 * which is the whole reason the number sits on the tab.
 */
export function TabRow({
  tabs,
  value,
  onChange,
  label = 'View',
  /** `underline` for record sections (default), `pills` for a list filter. */
  variant = 'underline',
  /**
   * Draw the row on its own bordered surface, as a `Panel` would.
   *
   * A record's section tabs sit **above** the panel they switch, so bare on the
   * page background they read as loose chips floating between the KPI tiles and
   * the content — nothing says they belong to the page rather than to the block
   * above them. On the same surface as everything else, the row becomes part of
   * the furniture and the tab that is on reads as a state of the page.
   *
   * Off by default: a tab row that filters a list inside a panel is already on
   * a surface, and giving it a second one would be a border inside a border.
   */
  panel = false,
  className,
}) {
  const underline = variant !== 'pills';

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'scroll-slim flex overflow-x-auto',
        underline ? 'gap-1' : 'gap-1.5',
        panel
          ? cn('rounded-lg border border-line bg-surface', underline ? 'px-2' : 'p-2 sm:px-3')
          : 'pb-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.key === value;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              pressable,
              'inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap',
              underline
                ? cn(
                    // No fill and no border: the mark is the rule below, so the
                    // control cannot be read as a pressable pill.
                    'relative px-3 py-3 text-sm font-medium',
                    active ? 'text-brand' : 'text-ink-400 hover:text-ink-700',
                  )
                : cn(
                    'h-9 rounded-md px-3 font-display text-sm font-semibold',
                    active
                      ? 'bg-brand-gradient-compact text-white'
                      : 'border border-line bg-surface text-ink-600 hover:border-line-strong hover:text-ink-900',
                  ),
            )}
          >
            {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />}
            {tab.label}

            {tab.count != null && (
              <span
                className={cn(
                  'tnum rounded-full px-1.5 text-2xs font-semibold',
                  underline
                    ? cn('leading-4', active ? 'bg-brand text-white' : 'bg-surface-2 text-ink-500')
                    : active
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-3 text-ink-500',
                )}
              >
                {formatCount(tab.count)}
              </span>
            )}

            {/* Inset from the tab's edges so the rule reads as belonging to the
                label rather than as a full-width divider under the row. The
                compact ramp, because §2.2 is explicit that the standard one's
                near-black opening reads as a stripe at this size. */}
            {underline && active && (
              <span
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-brand-gradient-compact"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TabRow;
