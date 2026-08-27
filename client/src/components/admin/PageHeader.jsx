import cn from '@/lib/cn';

/**
 * Every admin screen opens the same way (§4, convention 6): icon + H1 +
 * one-line description on the left, primary action top-right.
 *
 * The icon tile is `surface-2`, not the gradient — the gradient is reserved for
 * active states and CTAs (§2b), and a page header is neither.
 */
export function PageHeader({ icon: Icon, title, description, action, badge, className }) {
  return (
    <header className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-line bg-surface-2 text-ink-500">
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] leading-tight sm:text-[24px]">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-ink-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export default PageHeader;
