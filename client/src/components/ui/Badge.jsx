import cn from '@/lib/cn';

const TONES = {
  neutral: 'bg-surface-3 text-ink-500 border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  ok: 'bg-ok-50 text-ok border-ok/20',
  warn: 'bg-warn-50 text-warn border-warn/25',
  danger: 'bg-danger-50 text-danger border-danger/20',
  info: 'bg-info-50 text-info border-info/20',
  dark: 'bg-ink-900 text-white border-ink-900',
};

const SIZES = {
  sm: 'h-5 px-1.5 text-2xs gap-1',
  md: 'h-6 px-2 text-2xs gap-1',
};

/** Small status pill. Uses the eyebrow type treatment so badges read as system chrome. */
export function Badge({ tone = 'neutral', size = 'md', icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        // A pill is a fixed-height shape: let the label wrap and the second
        // line renders outside the border. It stays on one line and the layout
        // around it is responsible for giving it room.
        'eyebrow inline-flex items-center whitespace-nowrap rounded-full border',
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;
