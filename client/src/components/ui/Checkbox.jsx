import { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * Filter/consent checkbox. The whole row is the hit target — sidebar facets are
 * tapped on mobile, so a 16px box alone is not enough.
 */
export const Checkbox = forwardRef(function Checkbox(
  { label, count, disabled, className, id: idProp, ...props },
  ref,
) {
  const generatedId = useId();
  const id = idProp || generatedId;

  return (
    <label
      htmlFor={id}
      className={cn(
        'group flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-md',
        'transition-colors duration-[120ms]',
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-surface-2',
        className,
      )}
    >
      <span className="relative flex size-[18px] shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          disabled={disabled}
          className="peer absolute size-full cursor-pointer appearance-none rounded-sm border border-line-strong bg-surface transition-colors checked:border-brand checked:bg-brand disabled:cursor-not-allowed focus-visible:outline-none"
          {...props}
        />
        <Check
          className="pointer-events-none relative size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3.5}
          aria-hidden="true"
        />
      </span>

      <span className="min-w-0 flex-1 truncate text-ink-700 group-hover:text-ink-900">{label}</span>

      {count !== undefined && count !== null && (
        <span className="tnum shrink-0 text-xs text-ink-300">{count}</span>
      )}
    </label>
  );
});

export default Checkbox;
