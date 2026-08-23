import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import cn from '@/lib/cn';

const VARIANTS = {
  // The gradient's primary home. Keep it on CTAs, not on surfaces.
  primary:
    'bg-brand-gradient text-white shadow-card hover:brightness-110 active:brightness-95 disabled:brightness-100',
  solid: 'bg-ink-900 text-white hover:bg-ink-700 active:bg-ink-900',
  outline:
    'border border-line-strong bg-surface text-ink-700 hover:border-ink-300 hover:bg-surface-2 active:bg-surface-3',
  subtle: 'bg-surface-3 text-ink-700 hover:bg-line active:bg-line-strong',
  ghost: 'text-ink-500 hover:bg-surface-3 hover:text-ink-900 active:bg-line',
  brandSoft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-100',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-[12px] gap-1 rounded-[6px]',
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-[8px]',
  md: 'h-11 px-5 text-[14px] gap-2 rounded-[10px]',
  lg: 'h-13 px-7 text-[15px] gap-2 rounded-[12px]',
};

/**
 * The one button in the system. Anything that looks like a button uses this —
 * do not hand-roll a styled <button> elsewhere.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    className,
    children,
    loading = false,
    disabled,
    icon: Icon,
    iconRight: IconRight,
    fullWidth = false,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-display font-semibold',
        'transition-[background,color,border-color,filter,box-shadow] duration-[120ms]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  );
});

export default Button;
