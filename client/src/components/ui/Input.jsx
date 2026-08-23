import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * Large-touch-target text field. The checkout brief asks for friction-free fields,
 * so the same control is used in checkout, sign-up and the account forms.
 */
export const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    icon: Icon,
    className,
    containerClassName,
    type = 'text',
    id: idProp,
    suffix,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = idProp || generatedId;
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === 'password';
  const resolvedType = isPassword && revealed ? 'text' : type;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[13px] font-medium text-ink-700"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-300"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}

        <input
          ref={ref}
          id={id}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full rounded-[10px] border bg-surface px-3.5 text-[14px] text-ink-900',
            'placeholder:text-ink-300',
            'transition-[border-color,box-shadow] duration-[120ms]',
            'hover:border-line-strong',
            'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-400',
            Icon && 'pl-10',
            (isPassword || suffix) && 'pr-11',
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line',
            className,
          )}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-3 hover:text-ink-700"
          >
            {revealed ? (
              <EyeOff className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <Eye className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>
        )}

        {!isPassword && suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-400">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-danger"
        >
          <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-ink-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
