import { X } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * A removable token representing one active filter. Rendered above the grid so
 * the user can always see — and undo — what the three filter systems have set.
 */
export function Chip({ label, value, onRemove, tone = 'brand', className }) {
  const tones = {
    brand: 'border-brand-100 bg-brand-50 text-brand-700',
    neutral: 'border-line bg-surface text-ink-700',
  };

  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border pl-2.5 text-sm',
        onRemove ? 'pr-1' : 'pr-2.5',
        tones[tone],
        className,
      )}
    >
      {/* opacity-60 put this at 3.26:1 on the brand tint — a WCAG AA failure that
          only appears once a facet chip is on screen, which is why the audit
          never reached it. 80% clears 4.5:1 and still reads as secondary. */}
      {label && <span className="eyebrow opacity-80">{label}</span>}
      <span className="max-w-[180px] truncate font-medium">{value}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label ? `${label} ` : ''}${value} filter`}
          className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-brand/15"
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}

export default Chip;
