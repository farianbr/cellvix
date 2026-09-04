import { Minus, Plus } from 'lucide-react';
import cn from '@/lib/cn';

const SIZES = {
  sm: { wrap: 'h-9', btn: 'size-9', input: 'w-9 text-sm', icon: 'size-3.5' },
  md: { wrap: 'h-11', btn: 'size-11', input: 'w-12 text-md', icon: 'size-4' },

  // For the product card only. Its cells narrow with the CARD, not the viewport:
  // in a two-up mobile grid the card is ~169px wide, and 28px cells are what let
  // the stepper and the Add button share one row instead of stacking into an
  // 80px-tall block. ONLY use this inside an `@container` — the `@min-[…]`
  // variants have nothing to measure otherwise.
  card: {
    wrap: 'h-9',
    btn: 'h-9 w-7 @min-[200px]:w-9',
    input: 'w-7 text-sm @min-[200px]:w-9 @min-[200px]:text-sm',
    icon: 'size-3 @min-[200px]:size-3.5',
  },
};

/**
 * − / qty / + control. Used on the product card, in the cart dropdown and on the
 * cart page, so stepping quantity behaves identically everywhere.
 */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  size = 'md',
  disabled = false,
  label = 'Quantity',
  className,
}) {
  const s = SIZES[size];
  const clamp = (n) => Math.min(max, Math.max(min, n));

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-md border border-line bg-surface',
        disabled && 'opacity-50',
        s.wrap,
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className={cn(
          'flex shrink-0 items-center justify-center text-ink-500 transition-colors',
          'hover:bg-surface-2 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent',
          s.btn,
        )}
      >
        <Minus className={s.icon} strokeWidth={2.25} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.target.value.replace(/\D/g, ''));
          if (Number.isFinite(next)) onChange(clamp(next || min));
        }}
        className={cn(
          'tnum h-full border-x border-line bg-surface text-center font-medium text-ink-900',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand/25',
          s.input,
        )}
      />

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className={cn(
          'flex shrink-0 items-center justify-center text-ink-500 transition-colors',
          'hover:bg-surface-2 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent',
          s.btn,
        )}
      >
        <Plus className={s.icon} strokeWidth={2.25} />
      </button>
    </div>
  );
}

export default QtyStepper;
