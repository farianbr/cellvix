import { Link } from 'react-router';
import { AlertTriangle, Package, Trash2 } from 'lucide-react';
import cn from '@/lib/cn';
import { money } from '@/lib/format';
import QtyStepper from '@/components/product/QtyStepper';
import { PartVisual } from '@/components/product/PartFrame';

/**
 * A combo in the cart, as ONE line.
 *
 * The member parts are listed but not individually editable, because the bundle
 * is priced as a unit — letting a buyer drop one part would leave a "bundle"
 * that no longer matches what is being charged for it. The stepper moves whole
 * bundles; the trash removes the whole thing.
 *
 * A bundle that can no longer be honoured (its offer ended, a part went out of
 * stock) stays visible and says why. Silently removing something a buyer put in
 * their cart is worse than showing it and refusing to check out.
 */
export function CartBundleLine({ bundle, onQtyChange, onRemove, compact = false }) {
  return (
    <li
      className={cn(
        'relative',
        compact ? 'px-3 py-3' : 'px-4 py-4 sm:px-5',
        !bundle.available && 'bg-warn-50/40',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-brand-gradient text-white">
          <Package className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="eyebrow mb-1 block text-brand">Combo bundle</span>
              <p className="text-[14px] font-semibold leading-snug text-ink-900">{bundle.title}</p>
              {bundle.subtitle && (
                <p className="mt-0.5 text-[12px] text-ink-400">{bundle.subtitle}</p>
              )}
            </div>

            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(bundle.offerId)}
                aria-label={`Remove ${bundle.title}`}
                className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger"
              >
                <Trash2 className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* What is inside. Read-only: the bundle is the unit being bought. */}
          <ul className={cn('mt-2.5 flex flex-wrap gap-x-4 gap-y-2', compact && 'gap-x-3')}>
            {bundle.products.map((line) => (
              <li key={line.sku} className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 p-1">
                  <PartVisual product={line} />
                </span>
                <span className="min-w-0">
                  <Link
                    to={`/product/${line.slug}`}
                    className="block max-w-[190px] truncate text-[12px] text-ink-700 transition-colors hover:text-brand"
                  >
                    {line.name}
                  </Link>
                  <span className="tnum block font-mono text-[10.5px] text-ink-300">
                    {line.sku} · ×{line.qty}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {!bundle.available && bundle.reason && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-warn">
              <AlertTriangle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              {bundle.reason}
            </p>
          )}

          <div className="mt-3 flex items-end justify-between gap-3">
            {onQtyChange ? (
              <QtyStepper
                value={bundle.qty}
                onChange={(qty) => onQtyChange(bundle.offerId, qty)}
                size="sm"
                max={99}
              />
            ) : (
              <span className="tnum text-[12.5px] text-ink-400">×{bundle.qty}</span>
            )}

            <div className="text-right">
              <span className="tnum block font-display text-[16px] font-bold text-ink-900">
                {money(bundle.lineTotal)}
              </span>
              {bundle.savings > 0 && (
                <span className="tnum block text-[11.5px] text-ok">
                  <span className="text-ink-300 line-through">{money(bundle.listTotal)}</span> · save{' '}
                  {money(bundle.savings)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export default CartBundleLine;
