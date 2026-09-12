import { forwardRef, useId } from 'react';
import { X } from 'lucide-react';

import Overlay from '@/components/ui/Overlay';
import cn from '@/lib/cn';
import { dialog, pressable } from '@/lib/motion';

/**
 * Form surfaces for the platform console (SAAS_PLATFORM §0.1).
 *
 * **The last piece of the separation.** The console's screens already wear the
 * platform's own identity, but every form inside them was still a Cellvix
 * component — so opening "New tenant" dropped a white sheet with red accents
 * into a graphite application, and for the duration of that dialog the operator
 * was looking at the tenant's brand while configuring the platform. A modal is
 * where the most consequential actions happen, which makes it the worst place
 * for the identity to slip.
 *
 * **Built on the same `Overlay` as the tenant panel's `Modal`.** Focus
 * trapping, the scrim, escape-to-close and scroll locking are solved problems
 * with real accessibility work behind them; reimplementing them to change a
 * background colour would be trading correctness for paint.
 */

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

/** A dialog on the console's own surface. */
export function PlatformModal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  align = 'center',
  children,
}) {
  const titleId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      align={align}
      labelledBy={title ? titleId : undefined}
      label={title ? undefined : 'Dialog'}
      panelMotion={dialog}
      panelClassName={cn('w-full', SIZES[size])}
    >
      {/*
        A border AND a shadow here, unlike a panel on the page.

        The rule against both is about surfaces sitting *in* a layout; a dialog
        floats above one, and on a dark ground a shadow alone does almost
        nothing to separate it. The hairline is what gives the sheet an edge.
      */}
      <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-xl border border-plat-line bg-plat-surface shadow-flyout">
        {title && (
          <header className="flex shrink-0 items-start gap-4 border-b border-plat-line-soft px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="text-[17px] font-semibold leading-tight tracking-[-0.015em] text-plat-text"
              >
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-[13px] leading-normal text-plat-muted">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className={cn(
                pressable,
                '-mr-1.5 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-md',
                'text-plat-dim transition-colors duration-fast hover:bg-white/[0.06] hover:text-plat-text',
              )}
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </button>
          </header>
        )}

        <div className="scroll-slim flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </Overlay>
  );
}

/**
 * A labelled field.
 *
 * The label is a real `<label>` bound by id rather than a placeholder: a
 * placeholder disappears the moment somebody types, which is exactly when they
 * most need to know what they are filling in.
 */
export const PlatformInput = forwardRef(function PlatformInput(
  { label, hint, error, required, className, ...props },
  ref,
) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[13px] font-medium leading-tight text-plat-muted"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-plat-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <input
        ref={ref}
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
        className={cn(
          'w-full rounded-lg border bg-plat-raised px-3 py-2 text-sm text-plat-text',
          'placeholder:text-plat-dim',
          // The focus ring is the accent, which is the one place colour is
          // allowed to mean "this is where you are".
          'outline-none transition-colors duration-fast',
          'focus:border-plat-accent focus:ring-2 focus:ring-plat-accent/25',
          error ? 'border-plat-danger' : 'border-plat-line',
        )}
      />

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-plat-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-plat-dim">
            {hint}
          </p>
        )
      )}
    </div>
  );
});

/**
 * A native `<select>` rather than a custom menu.
 *
 * The console's option lists are short and static — four statuses, three business
 * types — and a native control brings keyboard handling, mobile pickers and
 * accessibility for free. A custom menu earns its place when the options need
 * icons, descriptions or search; none of these do.
 */
export const PlatformSelect = forwardRef(function PlatformSelect(
  { label, hint, error, required, options = [], className, ...props },
  ref,
) {
  const id = useId();

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[13px] font-medium leading-tight text-plat-muted"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-plat-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <select
        ref={ref}
        id={id}
        required={required}
        {...props}
        className={cn(
          'w-full rounded-lg border border-plat-line bg-plat-raised px-3 py-2 text-sm text-plat-text',
          'outline-none transition-colors duration-fast',
          'focus:border-plat-accent focus:ring-2 focus:ring-plat-accent/25',
        )}
      >
        {options.map((option) => (
          // Options render in the OS menu, which paints them itself — the
          // explicit colours stop a dark-mode system menu showing white on
          // white.
          <option key={option.value} value={option.value} className="bg-plat-surface text-plat-text">
            {option.label}
          </option>
        ))}
      </select>

      {hint && <p className="mt-1.5 text-xs text-plat-dim">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-plat-danger">{error}</p>}
    </div>
  );
});

/** An inline error, in the shape every console form uses. */
export function PlatformError({ children }) {
  if (!children) return null;

  return (
    <p className="mb-3 flex items-start gap-2 rounded-lg bg-plat-danger/10 px-3 py-2.5 text-sm text-plat-danger">
      {children}
    </p>
  );
}

/** A cautionary note — a consequence somebody should read before saving. */
export function PlatformNotice({ icon: Icon, children }) {
  return (
    <p className="mb-3 flex items-start gap-2 rounded-lg bg-plat-warn/10 px-3 py-2.5 text-[13px] leading-relaxed text-plat-text">
      {Icon && (
        <Icon className="mt-0.5 size-4 shrink-0 text-plat-warn" strokeWidth={2} aria-hidden="true" />
      )}
      <span>{children}</span>
    </p>
  );
}

/** The row of actions at the foot of a form. Cancel left, commit right. */
export function PlatformActions({ children }) {
  return <div className="mt-5 flex flex-wrap justify-end gap-2">{children}</div>;
}
