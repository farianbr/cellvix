import { useState } from 'react';
import { AlertCircle, Check, Tag, X, Zap } from 'lucide-react';
import cn from '@/lib/cn';
import { money } from '@/lib/format';
import { useCart } from '@/hooks/useCart';
import { pressable } from '@/lib/motion';

/**
 * The one promo code a cart may carry.
 *
 * Singular on purpose: offers do not stack, so applying a code replaces
 * whatever was there rather than adding to it — and the field says so instead of
 * letting a buyer discover it by trying.
 *
 * Three states share this space:
 *   - **applied** — the code is doing something, with the amount it took off;
 *   - **attached but idle** — a real code that does not bite on this cart yet
 *     (a minimum not met, nothing qualifying). It stays on, and starts working
 *     the moment the cart qualifies, so the notice explains rather than removes;
 *   - **automatic** — an offer that needed no code at all, shown so the buyer
 *     knows why the total moved and why their code would replace it.
 */
export function PromoCodeField({ className }) {
  const { promo, promoNotice, promoCode, applyPromo, clearPromo, isApplyingPromo } = useCart();
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const code = value.trim();
    if (!code) return;

    setError(null);
    try {
      await applyPromo(code);
      setValue('');
    } catch (rejection) {
      // Every rejection the server sends is buyer-facing copy with a named code
      // behind it (§5.1) — show the message, never invent one.
      setError(rejection.message);
    }
  }

  // An automatic offer is applied without a code and cannot be removed by hand,
  // so it gets a quieter treatment and the field stays open beneath it.
  const automatic = promo?.automatic;

  return (
    <div className={cn('min-w-0', className)}>
      {promo ? (
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-md border px-3 py-2.5',
            automatic ? 'border-ok/25 bg-ok-50' : 'border-brand-100 bg-brand-50',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-white',
              automatic ? 'bg-ok' : 'bg-brand',
            )}
            aria-hidden="true"
          >
            {automatic ? (
              <Zap className="size-2.5" strokeWidth={3} />
            ) : (
              <Check className="size-2.5" strokeWidth={4} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-semibold', automatic ? 'text-ok' : 'text-brand-700')}>
              {promo.code ? (
                <span className="font-mono">{promo.code}</span>
              ) : (
                'Offer applied automatically'
              )}
              <span className="ml-1.5 font-sans font-medium">· {promo.label}</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {promo.title}
              {promo.amount > 0 && ` — ${money(promo.amount)} off`}
              {promo.freeShipping && ' — shipping is on us'}
            </p>
          </div>

          {!automatic && (
            <button
              type="button"
              onClick={clearPromo}
              aria-label={`Remove promo code ${promo.code}`}
              className={cn(pressable, '-mr-1 -mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-surface hover:text-ink-900')}
            >
              <X className="size-3.5" strokeWidth={2.25} />
            </button>
          )}
        </div>
      ) : null}

      {/* The notice is for a code that is real and attached but not yet doing
          anything. Removing it silently would be the wrong answer — the buyer
          typed it for a reason. */}
      {promoNotice && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-warn-50 px-3 py-2.5 text-sm text-warn">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <span className="min-w-0 flex-1">{promoNotice.message}</span>
          {promoCode && (
            <button
              type="button"
              onClick={clearPromo}
              className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {(!promo || automatic) && (
        <form onSubmit={submit} className={cn('flex gap-2', promo || promoNotice ? 'mt-2.5' : '')}>
          <div className="relative min-w-0 flex-1">
            <Tag
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              value={value}
              onChange={(event) => setValue(event.target.value.toUpperCase())}
              placeholder="Promo code"
              aria-label="Promo code"
              aria-invalid={error ? true : undefined}
              className={cn(
                'h-10 w-full rounded-md border bg-surface pl-9 pr-3 font-mono text-sm uppercase text-ink-900',
                'placeholder:font-sans placeholder:normal-case placeholder:text-ink-300',
                'focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900/15',
                error ? 'border-danger' : 'border-line',
              )}
            />
          </div>

          <button
            type="submit"
            disabled={!value.trim() || isApplyingPromo}
            className={cn(pressable, 'h-10 shrink-0 rounded-md border border-line-strong bg-surface px-4 font-display text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45')}
          >
            {isApplyingPromo ? 'Checking…' : 'Apply'}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-danger" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          {error}
        </p>
      )}

      {automatic && !error && (
        <p className="mt-1.5 text-xs text-ink-400">
          Offers do not stack — a code you enter replaces the automatic one if it is worth more to
          you.
        </p>
      )}
    </div>
  );
}

export default PromoCodeField;
