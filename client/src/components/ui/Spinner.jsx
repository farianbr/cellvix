import cn from '@/lib/cn';

const SIZES = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
};

/**
 * The one spinner in the app.
 *
 * It replaces `<Loader2 className="animate-spin" />`, which is Tailwind's
 * default one-second linear rotation. Two things were wrong with that. A full
 * second per revolution is slow enough to read as the app struggling, and
 * spinner speed measurably changes how long a wait *feels* — the same load
 * behind a faster spinner is perceived as quicker. And a single solid arc
 * rotating at a constant rate has no life in it; it looks like a loading GIF
 * from 2009.
 *
 * This runs at 640ms with a two-arc track: a faint ring that shows the shape
 * the spinner occupies, and a bright arc travelling around it. The faint ring
 * matters because without it the arc appears to be orbiting nothing, and the
 * eye keeps looking for the missing circle.
 *
 * `currentColor` throughout, so it inherits from whatever it sits in — a
 * button, a table cell, a brand-gradient CTA — with no variant prop.
 *
 * CSS animation rather than a Motion component on purpose: this runs while the
 * app is busy fetching, and CSS animations run off the main thread. A
 * JS-driven spinner drops frames at exactly the moment it is on screen.
 */
export function Spinner({ size = 'sm', className, label }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
      className={cn('inline-flex shrink-0', className)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn('animate-[spinner_640ms_linear_infinite]', SIZES[size])}
      >
        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5" opacity="0.18" />
        {/* A quarter-turn arc. `pathLength` normalises the circumference to 100
            so the dash values are readable as percentages regardless of r. */}
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="26 74"
        />
      </svg>
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}

export default Spinner;
