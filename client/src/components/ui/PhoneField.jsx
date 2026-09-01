import { forwardRef, useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * The country codes offered, in the order a Canadian wholesaler needs them.
 *
 * Deliberately short rather than every country in the world: Cellvix ships from
 * Ontario to Canadian repair shops, `+1` covers Canada and the US, and the rest
 * are here for the handful of suppliers who are not on this continent. A
 * 200-row list would make the common case slower to reach for no one's benefit.
 */
export const DIAL_CODES = [
  { code: '+1', label: 'Canada / US' },
  { code: '+44', label: 'United Kingdom' },
  { code: '+52', label: 'Mexico' },
  { code: '+86', label: 'China' },
  { code: '+91', label: 'India' },
  { code: '+852', label: 'Hong Kong' },
  { code: '+971', label: 'UAE' },
];

const DEFAULT_CODE = '+1';

/**
 * Formats the national part as it is typed.
 *
 * NANP (`+1`) is the only plan formatted, because it is the only one whose
 * grouping is fixed at 3-3-4 — every other code here groups differently by
 * region, and guessing wrong is worse than not guessing. So the rest are
 * digits-only with a length cap, which still stops letters and stray
 * punctuation reaching the server.
 */
export function formatNational(value, dial = DEFAULT_CODE) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (dial !== '+1') return digits.slice(0, 15);

  const local = digits.slice(0, 10);
  if (local.length <= 3) return local;
  if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** `+1` + `780 123 4567` -> `+1 780 123 4567`. Empty national part means empty. */
export function composePhone(dial, national) {
  const trimmed = String(national ?? '').trim();
  return trimmed ? `${dial} ${trimmed}` : '';
}

/**
 * Splits a stored phone back into a dial code and a national part.
 *
 * Needed because the two halves are a UI affordance over one stored string:
 * `User.phone` is a single field that invoices, orders and the admin screens
 * all read, and splitting it in the model would have rippled through every one
 * of them for no gain. So the form composes on the way out and this splits on
 * the way back in.
 */
export function splitPhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { dial: DEFAULT_CODE, national: '' };

  // Longest code first, so `+1` cannot claim a `+1...` prefix of a longer code.
  const match = [...DIAL_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((entry) => raw.startsWith(entry.code));

  if (!match) return { dial: DEFAULT_CODE, national: formatNational(raw, DEFAULT_CODE) };

  const rest = raw.slice(match.code.length);
  return { dial: match.code, national: formatNational(rest, match.code) };
}

/**
 * A phone field split into a country code and an auto-formatted number.
 *
 * One control, not two form fields: `value` in and out is the single composed
 * string the schema and the model already expect (`+1 780 123 4567`), so
 * nothing downstream has to know this is two inputs. The caller holds one
 * value, exactly as it would for a plain `Input`.
 *
 * The two halves share one bordered shell so they read as one field rather than
 * as a select that happens to sit beside a text box — the divider is an inner
 * border, and focus rings the whole shell.
 */
export const PhoneField = forwardRef(function PhoneField(
  {
    label,
    value = '',
    onChange,
    onBlur,
    error,
    hint,
    required,
    name,
    id: idProp,
    disabled,
    placeholder = '780 123 4567',
    containerClassName,
  },
  ref,
) {
  const generatedId = useId();
  const id = idProp || generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const { dial, national } = splitPhone(value);

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[13px] font-medium text-ink-700"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div
        className={cn(
          'flex w-full items-stretch overflow-hidden rounded-[10px] border bg-surface',
          'transition-[border-color,box-shadow] duration-[120ms]',
          'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25',
          error ? 'border-danger focus-within:border-danger focus-within:ring-danger/20' : 'border-line',
          disabled && 'cursor-not-allowed bg-surface-2',
          'h-11',
        )}
      >
        {/* A native <select>: the platform picker is keyboard-accessible and
            localised, and a custom menu here would be a dropdown inside a
            dialog inside a scroll container for no gain. The chevron is drawn
            over it because the native arrow cannot be styled to match. */}
        <div className="relative shrink-0">
          <select
            aria-label="Country calling code"
            value={dial}
            disabled={disabled}
            onChange={(event) => onChange?.(composePhone(event.target.value, national))}
            className={cn(
              'h-full cursor-pointer appearance-none bg-transparent py-0 pl-3 pr-7',
              'text-[16px] text-ink-900 sm:text-[14px]',
              'focus:outline-none disabled:cursor-not-allowed disabled:text-ink-400',
            )}
          >
            {DIAL_CODES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.code}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-400"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <span className="my-1.5 w-px shrink-0 bg-line" aria-hidden="true" />

        <input
          ref={ref}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onBlur={onBlur}
          onChange={(event) => onChange?.(composePhone(dial, formatNational(event.target.value, dial)))}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] text-ink-900 sm:text-[14px]',
            'placeholder:text-ink-300 focus:outline-none',
            'disabled:cursor-not-allowed disabled:text-ink-400',
          )}
        />
      </div>

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

export default PhoneField;
