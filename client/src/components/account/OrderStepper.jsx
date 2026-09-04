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
      <div className={cn('flex items-center gap-3 rounded-lg bg-surface-2 p-4', className)}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-400">
          <CircleSlash className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-md font-bold text-ink-900">Order cancelled</p>
          <p className="text-sm text-ink-500">
            {order.timeline?.at(-1)?.note ?? 'This order was cancelled.'}
          </p>
        </div>
      </div>
    );
  }

  const reachedIndex = ORDER_STATUSES.findIndex((step) => step.value === order.status);
  const byStatus = new Map((order.timeline ?? []).map((entry) => [entry.status, entry]));

  const stateFor = (index) =>
    index < reachedIndex ? 'completed' : index === reachedIndex ? 'active' : 'upcoming';
  const labelTone = (index) =>
    index === reachedIndex ? 'text-ink-900' : index < reachedIndex ? 'text-ok' : 'text-ink-300';

  return (
    <div className={className}>
      {/* ---- vertical stepper below sm ----------------------------------
          Five fixed-width steps and four connectors need ~420px. A 320px phone
          got a clipped track with the last status off the edge, so the small
          screen runs the same steps down the page instead — where there is
          room for the timestamp beside each one. */}
      <ol className="sm:hidden" aria-label="Order progress">
        {ORDER_STATUSES.map((step, index) => {
          const entry = byStatus.get(step.value);
          const last = index === ORDER_STATUSES.length - 1;

          return (
            <li key={step.value} className="flex gap-3">
              <div className="flex flex-col items-center self-stretch">
                <StepIndicator state={stateFor(index)} index={index + 1} size="sm" />
                {!last && (
                  <StepConnector vertical complete={index < reachedIndex} className="my-1 min-h-5" />
                )}
              </div>

              <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-4')}>
                <p className={cn('font-display text-sm font-bold leading-none', labelTone(index))}>
                  {step.label}
                </p>
                {entry && (
                  <p className="tnum mt-1 text-xs text-ink-400">{dateTime(entry.at)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* ---- horizontal stepper from sm ---------------------------------
          Connectors live BETWEEN list items, never inside them — drawing one on
          each side of every indicator double-renders the segment and leaves a
          visible seam in the middle of each run. */}
      <ol className="hidden items-start sm:flex" aria-label="Order progress">
        {ORDER_STATUSES.map((step, index) => {
          const entry = byStatus.get(step.value);

          return (
            <Fragment key={step.value}>
              {index > 0 && (
                <StepConnector complete={index <= reachedIndex} className="mt-4 min-w-4 flex-1" />
              )}

              <li className="flex w-26 shrink-0 flex-col items-center">
                <StepIndicator state={stateFor(index)} index={index + 1} size="md" />

                <p
                  className={cn(
                    'mt-2 text-center font-display text-sm font-bold leading-tight',
                    labelTone(index),
                  )}
                >
                  {step.label}
                </p>

                {entry && (
                  <p className="tnum mt-0.5 text-center text-2xs text-ink-400">
                    {dateTime(entry.at)}
                  </p>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>

      {/* ---- full text breakdown ---------------------------------------- */}
      <div className="mt-6 rounded-lg border border-line">
        <h3 className="eyebrow border-b border-line px-4 py-2.5 text-ink-400">Status history</h3>

        <ol className="divide-y divide-line">
          {[...(order.timeline ?? [])].reverse().map((entry, index) => {
            const step = ORDER_STATUSES.find((s) => s.value === entry.status);
            return (
              <li
                key={`${entry.status}-${entry.at}`}
                className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-3 sm:flex-nowrap"
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    index === 0 ? 'bg-brand' : 'bg-ok',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-md font-semibold text-ink-900">
                    {step?.label ?? entry.status}
                  </p>
                  {entry.note && <p className="mt-0.5 text-sm text-ink-500">{entry.note}</p>}
                </div>
                <p className="tnum w-full shrink-0 pl-5 text-xs text-ink-400 sm:w-auto sm:pl-0 sm:text-right">
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
