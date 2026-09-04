import { Link } from 'react-router';
import { AlertTriangle, Trash2 } from 'lucide-react';
import cn from '@/lib/cn';
import { money, productTitle } from '@/lib/format';
import QtyStepper from '@/components/product/QtyStepper';
import { PartVisual } from '@/components/product/PartFrame';
import Badge from '@/components/ui/Badge';
import { pressable } from '@/lib/motion';

/**
 * One cart row. Shared by the mini-cart dropdown and the cart page so quantity behaviour,
 * price gating and the stock warning cannot drift between them.
 *
 * `compact` is the dropdown variant: narrower, no grade badge column.
 */
export function CartLine({ item, onQtyChange, onRemove, compact = false }) {
  const lineTotal = item.lineTotal ?? (item.unitPrice ?? 0) * item.qty;

  return (
    <li className={cn('flex gap-3', compact ? 'p-3.5' : 'p-4 sm:gap-4 sm:p-5')}>
      <Link
        to={`/product/${item.slug}`}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border border-line bg-surface-2',
          compact ? 'size-16 p-2' : 'size-20 p-2.5 sm:size-24 sm:p-3',
        )}
      >
        <PartVisual product={item} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {!compact && item.partTypeLabel && (
              <p className="eyebrow mb-1 text-ink-300">{item.partTypeLabel}</p>
            )}

            <Link
              to={`/product/${item.slug}`}
              className={cn(
                pressable,
                'line-clamp-2 font-medium text-ink-900 hover:text-brand',
                compact ? 'text-md' : 'text-md',
              )}
            >
              {/* Compact mode drops the eyebrow, so there the part type has to
                  stay in the name — it is the only place it would appear. */}
              {compact ? item.name : productTitle(item.name, item.partTypeLabel)}
            </Link>

            <p className="mt-0.5 font-mono text-2xs text-ink-300">{item.sku}</p>

            {!compact && item.grade && (
              <Badge tone="neutral" size="sm" className="mt-2">
                {item.grade.replace('-', ' ')}
              </Badge>
            )}
          </div>

          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.productId)}
              aria-label={`Remove ${item.name}`}
              className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger"
            >
              <Trash2 className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>

        {item.exceedsStock && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
            <AlertTriangle className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            Not enough stock for this quantity — the stepper is capped at what
            is available.
          </p>
        )}

        {item.priceChanged && !item.exceedsStock && (
          <p className="mt-2 text-xs text-ink-400">
            Price changed from {money(item.priceAtAdd)} since you added this.
          </p>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <QtyStepper
            value={item.qty}
            onChange={(qty) => onQtyChange(item.productId, qty)}
            size="sm"
            max={Math.max(1, item.stock || 9999)}
          />

          <div className="text-right">
            <span
              className={cn(
                'tnum block font-display font-bold',
                compact ? 'text-md' : 'text-lg',
                item.priceVisible ? 'text-ink-900' : 'text-ink-300',
              )}
            >
              {item.priceVisible ? money(lineTotal) : '—'}
            </span>
            {!compact && item.priceVisible && item.qty > 1 && (
              <span className="tnum block text-xs text-ink-400">
                {money(item.unitPrice)} each
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default CartLine;
