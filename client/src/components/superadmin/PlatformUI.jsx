import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';

/**
 * The console's own surfaces (SAAS_PLATFORM §0.1).
 *
 * **Separate from `components/ui` on purpose.** Those are Cellvix's — light
 * surfaces, brand red, the tenant panel's language. The console is a different
 * application wearing a different identity, and sharing a `Panel` between them
 * would mean every future change to the tenant's look silently reshaped the
 * platform's.
 *
 * Kept deliberately small: a surface, a row, a badge, a button. The console is
 * three screens, and a component library built ahead of the screens that need it
 * is a library nobody can change later.
 */

/** A raised surface. The console's equivalent of a card. */
export function PlatformPanel({ title, description, action, children, className }) {
  return (
    <section
      className={cn(
        'rounded-xl border border-plat-line bg-plat-surface',
        // A border OR a shadow, never both — the same rule the tenant panel
        // holds itself to, applied in the dark palette where a shadow does
        // almost nothing anyway.
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-plat-text">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[13px] leading-normal text-plat-muted">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className={cn(title || action ? 'px-5 pb-5' : 'p-5')}>{children}</div>
    </section>
  );
}

/**
 * A row inside a panel — a business, a thread, a grant.
 *
 * `onClick` makes the whole row pressable; without it the row is static and
 * renders as a plain element, so a non-interactive row never advertises itself
 * as clickable.
 */
export function PlatformRow({ icon: Icon, children, onClick, className }) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full flex-wrap items-center gap-3 rounded-lg border border-plat-line-soft',
        'bg-plat-raised px-4 py-3 text-left',
        onClick && cn(pressable, 'transition-colors duration-fast hover:border-plat-line'),
        className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-plat-dim" strokeWidth={2} aria-hidden="true" />}
      {children}
    </Tag>
  );
}

const TONES = {
  neutral: 'bg-white/[0.06] text-plat-muted',
  accent: 'bg-plat-accent/15 text-plat-accent-soft',
  ok: 'bg-plat-ok/15 text-plat-ok',
  warn: 'bg-plat-warn/15 text-plat-warn',
  danger: 'bg-plat-danger/15 text-plat-danger',
};

/** A status pill. Tinted background, coloured text — never a solid fill. */
export function PlatformBadge({ tone = 'neutral', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5',
        'text-[11px] font-medium leading-5',
        TONES[tone] ?? TONES.neutral,
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          {
            neutral: 'bg-plat-dim',
            accent: 'bg-plat-accent',
            ok: 'bg-plat-ok',
            warn: 'bg-plat-warn',
            danger: 'bg-plat-danger',
          }[tone] ?? 'bg-plat-dim',
        )}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

/**
 * `ghost` sits at `plat-muted`, not `plat-dim`.
 *
 * On a dark surface a dim grey label reads as *disabled* rather than as quiet —
 * the first pass used the dimmest step and every row action looked switched
 * off. Muted is the quietest step that still reads as available; `plat-dim` is
 * reserved for genuinely secondary text like a code or a timestamp.
 */
const VARIANTS = {
  primary: 'bg-plat-accent text-white hover:bg-plat-accent-soft',
  ghost: 'text-plat-muted hover:bg-white/[0.08] hover:text-plat-text',
  danger: 'text-plat-danger/90 hover:bg-plat-danger/10 hover:text-plat-danger',
};

export function PlatformButton({
  variant = 'ghost',
  size = 'md',
  icon: Icon,
  loading,
  children,
  className,
  // Defaulted explicitly rather than left to spread order: a button inside a
  // form defaults to `submit` in HTML, so a control that only meant to be
  // pressable would submit the form it happens to sit in.
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        pressable,
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium',
        'transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant] ?? VARIANTS.ghost,
        className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
      {loading ? '…' : children}
    </button>
  );
}

/** The screen's title block. One per page, always at the top. */
export function PlatformHeader({ title, description, action }) {
  return (
    <header className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        {/* Tracking tightens as the size grows — the optical correction that
            separates a set headline from a scaled-up paragraph. */}
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.022em] text-plat-text">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-plat-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

/** Nothing here yet, said in a way that explains what would put something here. */
export function PlatformEmpty({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-plat-raised text-plat-dim">
          <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-plat-text">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-[46ch] text-[13px] text-plat-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export default PlatformPanel;
