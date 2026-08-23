import { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * Multi-line field. Mirrors `Input`'s API — label, hint, error — so a form can
 * swap one for the other without changing anything around it.
 */
export const Textarea = forwardRef(function Textarea(
  { label, hint, error, className, containerClassName, id: idProp, rows = 4, counter, value, ...props },
  ref,
) {
  const generatedId = useId();
  const id = idProp || generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('w-full', containerClassName)}>
      {(label || counter) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="block text-[13px] font-medium text-ink-700">
              {label}
            </label>
          )}
          {counter ? (
            <span className="tnum text-[11.5px] text-ink-300">
              {String(value ?? '').length} / {counter}
            </span>
          ) : null}
        </div>
      )}

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-[10px] border bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-900',
          'placeholder:text-ink-300',
          'transition-[border-color,box-shadow] duration-[120ms]',
          'hover:border-line-strong',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
          'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-400',
          error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line',
          className,
        )}
        {...props}
      />

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-danger">
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

export default Textarea;
