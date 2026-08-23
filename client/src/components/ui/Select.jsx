import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * Native select with Cellvix chrome. Native is deliberate — it gets the correct
 * platform picker on mobile, which matters for the sub-2-minute checkout goal.
 */
export const Select = forwardRef(function Select(
  { label, hint, error, options = [], className, containerClassName, id: idProp, size = 'md', ...props },
  ref,
) {
  const generatedId = useId();
  const id = idProp || generatedId;

  const sizes = {
    sm: 'h-9 pl-3 pr-8 text-[13px]',
    md: 'h-11 pl-3.5 pr-10 text-[14px]',
  };

  // sm is used in tight rows (the shop toolbar splits a phone row with the
  // Filters button), so its chevron tucks in to buy the label three more pixels.
  const chevron = size === 'sm' ? 'right-2.5' : 'right-3';

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-700">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full cursor-pointer appearance-none truncate rounded-[10px] border bg-surface text-ink-900',
            'transition-[border-color,box-shadow] duration-[120ms]',
            'hover:border-line-strong',
            'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-400',
            sizes[size],
            error ? 'border-danger' : 'border-line',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className={cn(
            'pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-400',
            chevron,
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>

      {error ? (
        <p className="mt-1.5 text-[12.5px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
});

export default Select;
