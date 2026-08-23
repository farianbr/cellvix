import { Fragment } from 'react';
import { CircleSlash } from 'lucide-react';
import cn from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { ORDER_STATUSES } from '@/lib/constants';
import { StepIndicator, StepConnector } from '@/components/ui/StepIndicator';

/**
 * Order tracking (brief §8.3).
 *
 * The brief asks for BOTH formats, and means it: a visual stepper for the glance,
 * and a full text breakdown underneath for the buyer who needs to tell a customer
 * exactly when something shipped. Neither replaces the other.
 *
 * Uses the same StepIndicator as the tab wizard and checkout — that consistency
 * is the point of brief §10.5.
 */
export function OrderStepper({ order, className }) {
  if (order.status === 'cancelled') {
    return (
      <div className={cn('flex items-center gap-3 rounded-[12px] bg-surface-2 p-4', className)}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-400">
          <CircleSlash className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-[14px] font-bold text-ink-900">Order cancelled</p>
          <p className="text-[12.5px] text-ink-500">
            {order.timeline?.at(-1)?.note ?? 'This order was cancelled.'}
          </p>
        </div>
      </div>
    );
  }

  const reachedIndex = ORDER_STATUSES.findIndex((step) => step.value === order.status);
  const byStatus = new Map((order.timeline ?? []).map((entry) => [entry.status, entry]));

  return (
    <div className={className}>
      {/* ---- visual stepper ---------------------------------------------
          Connectors live BETWEEN list items, never inside them — drawing one on
          each side of every indicator double-renders the segment and leaves a
          visible seam in the middle of each run. */}
      <ol className="flex items-start" aria-label="Order progress">
        {ORDER_STATUSES.map((step, index) => {
          const isDone = index < reachedIndex;
          const isCurrent = index === reachedIndex;
          const state = isDone ? 'completed' : isCurrent ? 'active' : 'upcoming';
          const entry = byStatus.get(step.value);

          return (
            <Fragment key={step.value}>
              {index > 0 && (
                <StepConnector complete={index <= reachedIndex} className="mt-4 min-w-4 flex-1" />
              )}

              <li className="flex w-[74px] shrink-0 flex-col items-center sm:w-[104px]">
                <StepIndicator state={state} index={index + 1} size="md" />

                <p
                  className={cn(
                    'mt-2 text-center font-display text-[11px] font-bold leading-tight sm:text-[12.5px]',
                    isCurrent ? 'text-ink-900' : isDone ? 'text-ok' : 'text-ink-300',
                  )}
                >
                  {step.label}
                </p>

                {entry && (
                  <p className="tnum mt-0.5 hidden text-center text-[11px] text-ink-400 sm:block">
                    {dateTime(entry.at)}
                  </p>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>

      {/* ---- full text breakdown ---------------------------------------- */}
      <div className="mt-6 rounded-[12px] border border-line">
        <h3 className="eyebrow border-b border-line px-4 py-2.5 text-ink-400">Status history</h3>

        <ol className="divide-y divide-line">
          {[...(order.timeline ?? [])].reverse().map((entry, index) => {
            const step = ORDER_STATUSES.find((s) => s.value === entry.status);
            return (
              <li key={`${entry.status}-${entry.at}`} className="flex gap-3 px-4 py-3">
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    index === 0 ? 'bg-brand' : 'bg-ok',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink-900">
                    {step?.label ?? entry.status}
                  </p>
                  {entry.note && <p className="mt-0.5 text-[12.5px] text-ink-500">{entry.note}</p>}
                </div>
                <p className="tnum shrink-0 text-right text-[12px] text-ink-400">
                  {dateTime(entry.at)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default OrderStepper;
