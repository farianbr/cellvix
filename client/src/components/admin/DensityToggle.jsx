import { Rows2, Rows3 } from 'lucide-react';
import cn from '@/lib/cn';
import useTableDensity from '@/hooks/useTableDensity';
import { pressable } from '@/lib/motion';

/**
 * Switches every table on the page between comfortable and compact rows.
 *
 * Two icon buttons rather than one toggle, because a single button that
 * silently flips between two states cannot tell you which state you are in
 * without you pressing it — the label would have to read either the current
 * density or the one you would get, and both readings are defensible, so the
 * control is ambiguous by construction. A segmented pair shows both options and
 * marks the live one.
 *
 * It sits next to the count line, beside the data it changes, rather than in a
 * settings screen: a control belongs near what it affects, and this one is
 * adjusted while looking at the rows.
 */
export function DensityToggle({ className }) {
  const [density, setDensity] = useTableDensity();

  const options = [
    { value: 'comfortable', label: 'Comfortable rows', icon: Rows2 },
    { value: 'compact', label: 'Compact rows', icon: Rows3 },
  ];

  return (
    <div
      role="group"
      aria-label="Row density"
      className={cn('inline-flex items-center gap-0.5 rounded-md bg-surface-3 p-0.5', className)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = density === value;
        return (
          <button
            key={value}
            type="button"
            // Sets its own value rather than flipping the current one. A
            // segmented control's buttons are two destinations, not one switch
            // pressed twice, and "flip from whatever is current" is what let a
            // click land back on the density already showing.
            onClick={() => setDensity(value)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              pressable,
              'flex size-7 items-center justify-center rounded-sm',
              active
                ? 'bg-surface text-ink-900 shadow-card'
                : 'text-ink-400 hover:text-ink-700',
            )}
          >
            <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default DensityToggle;
