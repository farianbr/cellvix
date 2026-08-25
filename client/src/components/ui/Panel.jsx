import cn from '@/lib/cn';

/**
 * The account dashboard's building block: a bordered surface with an optional
 * header row. ERP density without ERP starkness (brief §10.7).
 */
export function Panel({ title, description, action, children, className, bodyClassName, flush }) {
  return (
    <section className={cn('overflow-hidden rounded-[14px] border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[14.5px] font-bold">{title}</h2>}
            {description && <p className="mt-0.5 text-[12.5px] text-ink-500">{description}</p>}
          </div>
          {action}
        </header>
      )}

      <div className={cn(!flush && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
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
    <div className={cn('rounded-[14px] border border-line bg-surface p-4', className)}>
      <div className="mb-2 flex items-center gap-2">
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-ink-400">
            <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        <p className="eyebrow text-ink-400">{label}</p>
      </div>

      <p className={cn('tnum font-display text-[22px] font-bold leading-none', tones[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>}
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
        <p className="font-display text-[14px] font-bold text-ink-900">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-ink-500">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export default Panel;
