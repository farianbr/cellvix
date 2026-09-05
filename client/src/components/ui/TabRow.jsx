import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { count as formatCount } from '@/lib/format';

/**
 * A row of view tabs — one record's sections, or one list's saved filters.
 *
 * **One definition, because there were three.** The approvals queue, the
 * reports screen and now two Purchase screens all draw the same control, and
 * the copies had already drifted: approvals used `.bg-brand-gradient-compact`
 * and reports used the full `.bg-brand-gradient` on a 36px pill, where the
 * standard ramp's near-black opening reads as a solid stripe down one side
 * rather than as depth (Instructions §2.2). The compact ramp is correct for
 * anything this short, so that is what lives here.
 *
 * Not `StepIndicator` and not `ProcessStrip`: both of those describe a position
 * in a sequence a record moves through. These tabs are views of the *same*
 * record, in no order, and picking one changes what is displayed rather than
 * what is true.
 *
 * `count` is rendered when a tab defines one, including zero — an "Items
 * Supplied 0" tab tells the operator the answer without making them open it,
 * which is the whole reason the number sits on the tab.
 */
export function TabRow({
  tabs,
  value,
  onChange,
  label = 'View',
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
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'scroll-slim flex gap-1.5 overflow-x-auto',
        panel
          ? 'rounded-lg border border-line bg-surface p-2 sm:px-3'
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
              'inline-flex h-9 shrink-0 select-none items-center gap-1.5 rounded-md px-3',
              'font-display text-sm font-semibold',
              active
                ? 'bg-brand-gradient-compact text-white'
                : 'border border-line bg-surface text-ink-600 hover:border-line-strong hover:text-ink-900',
            )}
          >
            {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />}
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  'tnum rounded-full px-1.5 text-2xs font-semibold',
                  active ? 'bg-white/20 text-white' : 'bg-surface-3 text-ink-500',
                )}
              >
                {formatCount(tab.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TabRow;
