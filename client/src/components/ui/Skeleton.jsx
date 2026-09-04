import cn from '@/lib/cn';

const RADIUS = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

/**
 * Loading placeholder. The definition of done requires skeletons, not
 * spinners-on-blank, for anything that occupies layout.
 *
 * This used to be `animate-pulse`, Tailwind's default: opacity oscillating
 * between 1 and 0.5 on an ease-in-out curve. Two problems. It throbs in place,
 * which reads as an element blinking at you rather than content arriving; and
 * because it is symmetric, it spends as long fading out as fading in, so a
 * screen full of them beats like a heartbeat and pulls the eye away from
 * whatever *has* loaded.
 *
 * A shimmer sweeps instead. It has a direction, which implies progress, and
 * because the highlight is only ever over part of the element the overall
 * brightness stays steady — the page does not breathe. The sweep is a
 * background-position animation on a gradient, so it stays on the compositor
 * and costs nothing while the app is busy parsing the response it is waiting
 * for.
 *
 * Reduced motion is handled in the stylesheet: the keyframe is suppressed and
 * the skeleton settles to a flat tint, which still communicates "not here yet"
 * without any movement at all.
 */
export function Skeleton({ className, rounded = 'md' }) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton bg-surface-3', RADIUS[rounded], className)}
    />
  );
}

/**
 * A run of text lines. The last line is short, because real paragraphs end
 * mid-measure — a stack of equal-width bars is the most obvious tell that a
 * skeleton was not thought about.
 */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          rounded="sm"
          className={cn('h-3', i === lines - 1 ? 'w-[55%]' : 'w-full')}
        />
      ))}
    </div>
  );
}

export default Skeleton;
