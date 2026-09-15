/**
 * The 404 illustration: a cable pulled apart in the middle of the page.
 *
 * A disconnection is the one metaphor that says "this link does not reach
 * anything" without needing a caption, which is why the plug and socket sit at
 * the centre and the leads run all the way off both edges - the break reads as
 * something that happened to a line that was whole a moment ago, rather than as
 * an icon of a plug.
 *
 * ## How it is drawn, and why that matters
 *
 * OUTLINED, not stroked. The first version drew each lead as one thick
 * `ink-300` stroke with a thin lighter stroke down the middle, which is the
 * cheap way to fake a tube and looks like exactly that: a grey bar with a
 * scratch in it. A real cable in this drawing style is a CLOSED SHAPE - two
 * parallel edges in `ink-900` with the page colour inside - so it has a
 * consistent outline weight with the plug bodies it runs into, and reads as one
 * object rather than as a line that happens to end near a box.
 *
 * That is what `cableOutline` builds: one filled path whose boundary runs out
 * along the top edge of the cable and back along the bottom, offset by the
 * cable's own half-width. The centre line is written once, so the two edges
 * cannot drift out of parallel the way two hand-tuned bezier paths do.
 *
 * Everything else follows the same rule - every part is a shape with a 1.4-unit
 * outline, nothing is a bare stroke except the spark marks, which are meant to
 * read as marks.
 *
 * Drawn inline rather than shipped as an asset because it has to take the ink
 * and brand tokens (so it themes), redraw crisply from 360 to 2560 from one
 * file, and keep the spark aligned to the gap exactly.
 *
 * Decorative: the page's heading carries the meaning, so this is `aria-hidden`
 * and never described twice.
 */

/** Stroke weight for every outline in the drawing. One value, so nothing drifts. */
const LINE = 3.2;

/**
 * A cable as a closed outline.
 *
 * Takes the centre line as a list of points and returns a path that runs along
 * one side and back the other, `half` units either side of it. The offset is
 * taken perpendicular to the local direction of travel, so the cable keeps an
 * even width through the curves rather than pinching where it bends hardest -
 * which is the giveaway of an outline drawn by eye.
 *
 * A Catmull-Rom pass smooths the centre line into beziers first, so a handful
 * of readable control points produce a cable that sags like a slack lead
 * instead of a polyline with rounded corners.
 */
function cableOutline(points, half) {
  // Perpendicular offset at each point, averaged from the segments either side
  // so the joins are smooth rather than mitred.
  const normals = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  });

  const side = (sign) =>
    points.map((point, index) => [
      point[0] + normals[index][0] * half * sign,
      point[1] + normals[index][1] * half * sign,
    ]);

  /** Catmull-Rom through the points, emitted as cubic beziers. */
  const curve = (list) => {
    let d = `M${list[0][0].toFixed(2)} ${list[0][1].toFixed(2)}`;
    for (let i = 0; i < list.length - 1; i += 1) {
      const p0 = list[Math.max(0, i - 1)];
      const p1 = list[i];
      const p2 = list[i + 1];
      const p3 = list[Math.min(list.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  };

  const top = side(1);
  const bottom = side(-1).reverse();

  // Out along one edge, straight across the end, back along the other. The
  // ends are left square because both sit off-canvas or inside a collar.
  return `${curve(top)} L${bottom[0][0].toFixed(2)} ${bottom[0][1].toFixed(2)} ${curve(bottom).slice(1)} Z`;
}

/** The left lead's centre line, from off-canvas to the plug's collar. */
const LEFT_CABLE = [
  [-60, 150],
  [40, 128],
  [140, 120],
  [240, 134],
  [326, 153],
  [382, 167],
];

/** The right lead, mirrored about x=500. */
const RIGHT_CABLE = LEFT_CABLE.map(([x, y]) => [1000 - x, y]);

function UnpluggedScene({ className }) {
  return (
    <svg
      viewBox="0 30 1000 280"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="var(--color-ink-900)"
        strokeWidth={LINE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ---- the two leads ---------------------------------------------
            Filled with the page ground, so the cable is opaque where it passes
            behind a collar rather than showing the collar's edge through it. */}
        <path d={cableOutline(LEFT_CABLE, 9)} fill="var(--color-surface)" />
        <path d={cableOutline(RIGHT_CABLE, 9)} fill="var(--color-surface)" />

        {/* ---- left: the plug --------------------------------------------
            Rotated a little so it follows the lead's fall. Shallow on purpose:
            past about 25 degrees the two bodies start to overlap and the pins,
            which are the thing that says "unplugged", disappear behind the
            socket. */}
        <g transform="rotate(12 372 168)">
          {/* Strain relief: the tapered sleeve where the cable enters. Without
              it a cable meeting a box edge-on reads as a cable drawn INTO a
              box; this is the detail that makes it one moulded object. */}
          <path
            d="M344 152h24a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-24a5 5 0 0 1-5-5v-22a5 5 0 0 1 5-5z"
            fill="var(--color-surface-2)"
          />

          {/* The body, taller than it is wide, with the cap band down the
              leading edge that gives it a front and a back. */}
          <rect x="372" y="120" width="72" height="96" rx="14" fill="var(--color-surface)" />
          <path d="M444 130a10 10 0 0 1 10 10v56a10 10 0 0 1-10 10z" fill="var(--color-surface-2)" />

          {/* Grip ribs, the moulded-plastic detail that stops the body reading
              as a plain rounded rectangle. */}
          <g strokeWidth={LINE * 0.75}>
            <path d="M390 146h36" />
            <path d="M390 160h36" />
            <path d="M390 174h36" />
            <path d="M390 188h36" />
          </g>
        </g>

        {/* ---- right: the socket ------------------------------------------
            The half carrying the PRONGS, reaching back toward the plug it came
            out of. In the reference the pins belong to the right-hand body and
            point left across the gap; they were on the wrong side and pointing
            the wrong way, which made the pair read as two plugs rather than as
            a connection that came apart. */}
        <g transform="rotate(-12 640 168)">
          <path
            d="M668 152h-24a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h24a5 5 0 0 0 5-5v-22a5 5 0 0 0-5-5z"
            fill="var(--color-surface-2)"
          />

          {/* Drawn BEFORE the body so the body's fill covers where they meet -
              a prong with a visible seam across the case is the giveaway that
              the parts were drawn separately. */}
          <g fill="var(--color-surface)">
            <rect x="506" y="139" width="72" height="12" rx="6" />
            <rect x="506" y="185" width="72" height="12" rx="6" />
          </g>

          <rect x="568" y="120" width="72" height="96" rx="14" fill="var(--color-surface)" />
          <path d="M568 130a10 10 0 0 0-10 10v56a10 10 0 0 0 10 10z" fill="var(--color-surface-2)" />
        </g>

        {/* ---- the break ---------------------------------------------------
            Eight marks radiating from the centre of the gap, in the brand red.
            The only colour in the drawing, and it is on the one thing the
            picture is about, so the eye lands here first. Lengths alternate so
            it reads as a spark rather than as an asterisk. */}
        <g
          stroke="var(--color-brand)"
          strokeWidth={LINE * 1.15}
          strokeLinecap="round"
          fill="none"
          transform="translate(500 172)"
        >
          <path d="M0 -52v-30" />
          <path d="M0 52v30" />
          <path d="M-37 -37l-20-20" />
          <path d="M37 -37l20-20" />
          <path d="M-37 37l-20 20" />
          <path d="M37 37l20 20" />
        </g>
      </g>
    </svg>
  );
}

export default UnpluggedScene;
