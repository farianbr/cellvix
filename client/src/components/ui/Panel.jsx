import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import cn from '@/lib/cn';
import { ease } from '@/lib/motion';

/**
 * The account dashboard's building block: a bordered surface with an optional
 * header row. ERP density without ERP starkness (brief §10.7).
 */
export function Panel({ title, description, action, children, className, bodyClassName, flush }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-display text-md font-bold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          {action}
        </header>
      )}

      <div className={cn(!flush && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A `Panel` whose body opens and closes.
 *
 * **Why this and not `Accordion`.** `Accordion` is the FAQ's disclosure list:
 * numbered pills, marketing type scale, answers rendered through `RichText`,
 * and one-open-at-a-time. A dashboard section is none of those — it holds live
 * components, sits at ERP density, and several of them are usefully open at
 * once. Forcing the two together would have meant an `Accordion` with half its
 * behaviour switched off at every dashboard call site.
 *
 * What it keeps from `Panel` is the shell, so a collapsible section and a plain
 * one are visibly the same object — the only additions are a chevron, a hit
 * area over the whole header, and the summary slot.
 *
 * `summary` is the point of the pattern: a closed section still has to answer
 * the question it exists to answer. "Line of credit" closed over nothing is a
 * row a buyer has to open to learn anything from; closed over
 * "$4,200 of $10,000 drawn" is an answer, and opening it is a choice rather
 * than a requirement.
 *
 * Accessibility: the header is a real `<button>` carrying `aria-expanded` and
 * `aria-controls`, and a closed body is removed from the tree rather than
 * hidden with CSS, so a screen reader and Ctrl-F agree about what is on the
 * page. `action` renders outside that button — a control inside the toggle
 * would be a button nested in a button.
 */
export function CollapsiblePanel({
  title,
  description,
  /** Rendered in the header, right of the title, at every state. */
  summary,
  /** A control (usually a Button). Sits outside the toggle, so it never nests. */
  action,
  defaultOpen = false,
  children,
  className,
  bodyClassName,
  flush,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const id = useId();
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;

  return (
    <section
      className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5',
          // The border only exists while the body does. A closed section is one
          // object; a hairline under a closed header reads as an empty box.
          open ? 'border-b border-line py-3' : 'py-3',
        )}
      >
        <h2 className="min-w-0 flex-1 font-display text-md font-bold">
          <button
            type="button"
            id={buttonId}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className={cn(
              'group -my-1 flex w-full items-center gap-2.5 rounded-md py-1 text-left',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/15',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-ink-400',
                'transition-[transform,color] duration-panel ease-entrance group-hover:text-ink-900',
                open && 'rotate-180 text-ink-900',
              )}
              aria-hidden="true"
            >
              <ChevronDown className="size-4" strokeWidth={2.25} />
            </span>

            <span className="min-w-0">
              <span className="block truncate transition-colors group-hover:text-brand">
                {title}
              </span>
              {description && (
                <span className="mt-0.5 block text-sm font-normal text-ink-500">
                  {description}
                </span>
              )}
            </span>
          </button>
        </h2>

        {/* The closed section's answer. Hidden once the body is open, where the
            real figures are — two copies of the same number, one of them
            abbreviated, is where they start to disagree. */}
        {summary && !open && (
          <div className="shrink-0 text-sm text-ink-500">{summary}</div>
        )}

        {action}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            /* Height runs the standard 220ms; the fade is shorter so the
               content is not still ghosting in while the panel is nearly open.
               Same split as `Accordion`, at the dashboard's shorter duration. */
            transition={
              reduce
                ? { duration: 0.12 }
                : {
                    height: { duration: 0.22, ease: ease.entrance },
                    opacity: { duration: 0.16, ease: 'linear' },
                  }
            }
            className="overflow-hidden"
          >
            <div className={cn(!flush && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** A single figure with a label — the dashboard's top row. */
export function StatTile({ label, value, hint, tone = 'neutral', icon: Icon, className }) {
  const tones = {
    neutral: 'text-ink-900',
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
    brand: 'text-brand',
  };

  return (
    <div className={cn('rounded-lg border border-line bg-surface p-4', className)}>
      <div className="mb-2 flex items-center gap-2">
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-ink-400">
            <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        <p className="eyebrow text-ink-400">{label}</p>
      </div>

      <p className={cn('tnum font-display text-2xl font-bold leading-none', tones[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/** Empty state used inside panels — quieter than the page-level one. */
export function PanelEmpty({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-300">
          <Icon className="size-5" strokeWidth={1.5} />
        </span>
      )}
      <div>
        <p className="font-display text-md font-bold text-ink-900">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export default Panel;
