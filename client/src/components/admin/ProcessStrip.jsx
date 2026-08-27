import { Check } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * The chevron step strip pinned to the bottom of every Purchase screen — the
 * "purchase automation cycle" (ERP rework §4, convention 12).
 *
 * **This is deliberately not `StepIndicator`.** The Instructions forbid forking
 * that component, and this does not: `StepIndicator` is a *wizard* the user
 * advances through (the tab wizard, checkout, order tracking). `ProcessStrip`
 * is a *status display* of where a record sits in an automated pipeline the
 * user is not driving. Same visual family, different job — do not merge them.
 */

export const PURCHASE_CYCLE = [
  { key: 'supplier', label: 'Supplier Info' },
  { key: 'po', label: 'Purchase Order' },
  { key: 'sent', label: 'Send to Supplier' },
  { key: 'payment', label: 'Payment' },
  { key: 'shipment', label: 'Shipment' },
  { key: 'received', label: 'Received' },
  { key: 'inventory', label: 'Inventory' },
];

export function ProcessStrip({
  steps = PURCHASE_CYCLE,
  current,
  caption = 'Fully automated — manual override possible at any step.',
  className,
}) {
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <section
      aria-label="Process status"
      className={cn('rounded-[12px] border border-line bg-surface p-3', className)}
    >
      <ol className="scroll-slim flex gap-1 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const done = currentIndex > -1 && index < currentIndex;
          const active = index === currentIndex;

          return (
            <li
              key={step.key}
              aria-current={active ? 'step' : undefined}
              className={cn(
                // The chevron notch is a clip-path rather than a border trick,
                // so the shape survives any label length.
                'relative flex min-w-0 shrink-0 items-center gap-1.5 py-2 pl-4 pr-3 text-[12px] font-medium',
                'first:pl-3 first:[clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%)]',
                'last:[clip-path:polygon(10px_0,100%_0,100%_100%,10px_100%,0_50%)]',
                '[clip-path:polygon(10px_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,10px_100%,0_50%)]',
                active
                  ? 'bg-brand-gradient text-white'
                  : done
                    ? 'bg-ok-50 text-ok'
                    : 'bg-surface-2 text-ink-400',
              )}
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  active ? 'bg-white/20 text-white' : done ? 'bg-ok/15' : 'bg-line text-ink-500',
                )}
              >
                {done ? <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" /> : index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {caption && <p className="mt-2 px-1 text-[11.5px] text-ink-400">{caption}</p>}
    </section>
  );
}

export default ProcessStrip;
