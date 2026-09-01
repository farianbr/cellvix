import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * A titled group of fields, optionally collapsible.
 *
 * Built for the optional halves of the account-creation forms — address and
 * business details on both the admin and the storefront one. Those fields are
 * genuinely optional, and a long run of mostly-skippable inputs reads as a long
 * form rather than a short one with extras, which is what stops people
 * finishing it. Collapsed, the required fields are the whole form.
 *
 * **The section is a shaded slab, not a hairline box.** The forms were a flat
 * column of identical inputs with nothing telling the eye where one group ended
 * and the next began; a tinted header strip over a white body does that work
 * without adding a single word. The body stays white so the inputs keep the
 * contrast they need against their own container.
 *
 * **Fields stay mounted when collapsed.** They are hidden with `hidden` rather
 * than unmounted, so anything already typed survives a collapse and still
 * submits — a disclosure that silently drops input the moment it closes is
 * worse than no disclosure. It also keeps React Hook Form's registration and
 * validation intact regardless of what is open.
 *
 * `Accordion` in this same directory is for content: it animates its height and
 * unmounts its children. This is for form controls and must do neither.
 */
export function FormSection({
  title,
  hint,
  icon: Icon,
  children,
  defaultOpen = false,
  collapsible = true,
  /**
   * Set when the fields inside have failed validation.
   *
   * A collapsed section hides its own errors: the form refuses to submit, the
   * message is real, and it is behind a closed header the buyer has no reason
   * to open. Passing this forces the section open so the error is visible where
   * it happened. It only forces open — a section the user has opened by hand
   * stays open when the error clears.
   */
  hasError = false,
  className,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const expanded = collapsible ? open || hasError : true;

  const heading = (
    <>
      {Icon && (
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-surface text-ink-400 ring-1 ring-line"
          aria-hidden="true"
        >
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
      )}
      <span className="eyebrow text-ink-600">{title}</span>
      {hint && (
        <span className="text-[11.5px] font-normal normal-case tracking-normal text-ink-400">
          {hint}
        </span>
      )}
    </>
  );

  return (
    <div className={cn('overflow-hidden rounded-[12px] ring-1 ring-line', className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className={cn(
            'flex w-full items-center gap-2.5 bg-surface-2 px-3.5 py-2.5 text-left',
            'transition-colors hover:bg-surface-3',
          )}
        >
          {heading}
          <ChevronDown
            className={cn(
              'ml-auto size-4 shrink-0 text-ink-400 transition-transform duration-200',
              expanded && 'rotate-180',
            )}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className="flex items-center gap-2.5 bg-surface-2 px-3.5 py-2.5">{heading}</div>
      )}

      <div id={bodyId} hidden={!expanded} className="border-t border-line bg-surface p-3.5">
        {children}
      </div>
    </div>
  );
}

export default FormSection;
