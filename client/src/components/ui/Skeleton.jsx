import cn from '@/lib/cn';

/**
 * Loading placeholder. The definition of done requires skeletons, not
 * spinners-on-blank, for anything that occupies layout.
 */
export function Skeleton({ className, rounded = 'md' }) {
  const radius = {
    sm: 'rounded-[6px]',
    md: 'rounded-[10px]',
    lg: 'rounded-[14px]',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse bg-surface-3', radius, className)}
    />
  );
}

export default Skeleton;
