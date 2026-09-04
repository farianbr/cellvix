/**
 * Icon stroke weight, derived from icon size.
 *
 * Lucide draws on a 24-unit viewBox, so `strokeWidth` is a fraction of the
 * icon's own box rather than a thickness in pixels. Rendered weight is
 * therefore `strokeWidth × size / 24` — which means a FIXED strokeWidth gets
 * heavier as the icon grows:
 *
 *     strokeWidth 2, at size-3  (12px) → 1.00px of ink
 *     strokeWidth 2, at size-4  (16px) → 1.33px
 *     strokeWidth 2, at size-7  (28px) → 2.33px
 *
 * That is why the icon set read as inconsistent even though every individual
 * choice looked defensible. A 12px glyph and a 28px glyph in the same header
 * were drawn at less than half and more than double the same weight, so one
 * looked faint and the other looked bold. On top of that the same size was
 * being given several different strokes anyway: `size-4` appeared with 1.75, 2,
 * 2.25 AND 2.5 across 246 uses, and `size-3.5` with five values across 196.
 *
 * This inverts the relationship. Stroke falls as size rises, holding rendered
 * weight at roughly 1.3px from the smallest badge glyph up to a 20px control
 * icon — which is where all but a handful of the app's icons live:
 *
 *     size-2.5  2.5   → 1.04px      size-4.5  1.75  → 1.31px
 *     size-3    2.5   → 1.25px      size-5    1.5   → 1.25px
 *     size-3.5  2.25  → 1.31px      size-6    1.5   → 1.50px
 *     size-4    2     → 1.33px      size-7    1.5   → 1.75px
 *
 * Above size-5 the weight is allowed to drift up, because 1.5 is as light as a
 * Lucide stroke goes before the shape starts to fall apart, and icons that
 * large are decorative rather than functional — an empty-state glyph, not
 * something being scanned in a row.
 *
 * Call sites pass the size they are already writing in the className and get
 * the stroke for it. They do not choose.
 */

/** Rendered stroke weight, in px, that the scale aims for. */
const TARGET_PX = 1.35;

/** Lucide's viewBox. */
const VIEWBOX = 24;

/** The steps a stroke may take. Quarter values only — finer is invisible. */
const STEPS = [1.5, 1.75, 2, 2.25, 2.5];

/**
 * Tailwind size step → pixels. `size-4` is 1rem at the default 16px root.
 * Written out rather than computed so a lookup cannot silently succeed for a
 * size the design does not actually use.
 */
const PX = {
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  4.5: 18,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
};

/**
 * The stroke for an icon at a given Tailwind size step.
 *
 * @param {number|string} size e.g. `4`, `3.5`, or the class `'size-3.5'`.
 * @returns {number} a strokeWidth drawn from STEPS.
 */
export function strokeFor(size) {
  const step = typeof size === 'string' ? Number(String(size).replace(/^size-/, '')) : Number(size);
  const px = PX[step];
  // An unknown size gets Lucide's own default rather than a guess.
  if (!px) return 2;

  const ideal = (TARGET_PX * VIEWBOX) / px;
  return STEPS.reduce((best, candidate) =>
    Math.abs(candidate - ideal) < Math.abs(best - ideal) ? candidate : best,
  );
}

/**
 * The precomputed table. Reading a value is cheaper than recomputing it per
 * render, and having the numbers written out keeps the curve reviewable.
 */
export const STROKE = Object.fromEntries(
  Object.keys(PX).map((step) => [step, strokeFor(step)]),
);

export default strokeFor;
