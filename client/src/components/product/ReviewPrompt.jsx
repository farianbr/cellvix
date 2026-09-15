import { useState } from 'react';
import { Star } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import Button from '@/components/ui/Button';
import { PartVisual } from '@/components/product/PartFrame';
import ReviewForm from '@/components/product/ReviewForm';
import { usePendingReviews } from '@/hooks/useReviews';

/**
 * "These parts are waiting on your verdict."
 *
 * Used in two places with the same shape: the Thank You page after checkout,
 * and the account orders page. Both are moments where a buyer has just been
 * thinking about an order, which is the only moment anybody is ever going to
 * write a review.
 *
 * ## Why the Thank You page lists OTHER orders
 *
 * A review needs the part in hand, so the gate is delivery, and the order just
 * placed is by definition not delivered. Showing "review this order" there
 * would be a button that cannot work. What CAN be true at that moment is that
 * an earlier order has arrived and is still unreviewed, and a buyer who has
 * just finished a checkout is the most likely person in the world to spend
 * thirty seconds on it. So the prompt shows what is actually reviewable, and
 * `note` is where the caller explains the order in front of them.
 *
 * Renders nothing when there is nothing outstanding. A section that says "you
 * have no reviews to write" is a section asking to be skipped forever.
 */
export function ReviewPrompt({ orderId = null, title, note, className, limit = 4 }) {
  const [reviewing, setReviewing] = useState(null);
  const [done, setDone] = useState(() => new Set());

  const { data: pending = [], isLoading } = usePendingReviews(orderId);

  // Written in this session. The query is invalidated on submit, but the row
  // should go the instant the modal closes rather than a network round trip
  // later, or the part appears to still need reviewing after it was reviewed.
  const rows = pending.filter((item) => !done.has(`${item.orderId}|${item.productId}`));

  if (isLoading || rows.length === 0) return null;

  const shown = rows.slice(0, limit);

  return (
    <section className={cn('', className)} aria-labelledby="review-prompt">
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warn-50 text-warn">
            <Star className="size-4.5 fill-current" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="review-prompt" className="font-display text-md font-bold text-ink-900">
              {title ?? 'Tell other customers what you thought'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              {note ??
                `${rows.length === 1 ? 'One part you have had delivered has' : `${rows.length} parts you have had delivered have`} not been reviewed yet. It takes a minute and it is the thing other buyers read first.`}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {shown.map((item) => (
            <li
              key={`${item.orderId}|${item.productId}`}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2.5"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface p-1.5">
                <PartVisual product={item} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">
                  {item.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-400">
                  {item.partTypeLabel}
                  {item.grade ? <span aria-hidden="true"> · {item.grade}</span> : null}
                  <span aria-hidden="true"> · </span>
                  {item.orderNumber}
                </span>
              </span>

              <Button size="sm" variant="secondary" onClick={() => setReviewing(item)}>
                Write a review
              </Button>
            </li>
          ))}
        </ul>

        {rows.length > shown.length && (
          <p className="mt-3 text-xs text-ink-400">
            And {rows.length - shown.length} more in your order history.
          </p>
        )}
      </div>

      <ReviewForm
        open={Boolean(reviewing)}
        item={reviewing}
        onClose={() => setReviewing(null)}
        onDone={(item) =>
          setDone((current) => new Set(current).add(`${item.orderId}|${item.productId}`))
        }
      />
    </section>
  );
}

export default ReviewPrompt;
