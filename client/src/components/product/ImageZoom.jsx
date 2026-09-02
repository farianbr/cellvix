import { useCallback, useRef, useState } from 'react';
import cn from '@/lib/cn';
import { productPhoto } from '@/lib/partPhoto';

/** How much bigger the part gets inside the lens. */
const ZOOM = 3;

/**
 * How far above the cursor the glass floats, measured between the cursor and
 * the lens's bottom edge.
 *
 * The lens used to be centred on the pointer, which put the arrow in the middle
 * of the very detail it was magnifying. Lifting it clear means the cursor marks
 * WHAT is being read while the glass shows it, unobstructed — the way a real
 * magnifier is held over a page rather than on the eye.
 */
const CURSOR_GAP = 22;

/**
 * The lens diameter, in px, for a given frame height.
 *
 * Fixed at 180 it was too big for a small frame: a 350px detail image cannot
 * hold a 180px glass above the cursor with any clearance, so the clamp pulled
 * it back down over the pointer — the exact thing the offset exists to prevent.
 * Sized against the frame, the room above is there at every width.
 *
 * The cap stops it becoming a second picture on a large screen; the floor keeps
 * it readable on a small one.
 */
function lensSize(frameHeight) {
  return Math.max(96, Math.min(180, Math.round((frameHeight - CURSOR_GAP * 2) / 2.6)));
}

/**
 * A magnifier lens over the product detail image.
 *
 * A round glass floats just ABOVE the cursor and shows the area under it,
 * enlarged. The rest of the photograph stays put and stays visible, so the
 * reader keeps the whole part in view while inspecting one corner of it — which
 * is the point of a magnifier and the reason this replaced the earlier version.
 *
 * The offset matters as much as the magnification: centred on the pointer, the
 * arrow sat in the middle of the detail it was meant to reveal. Held above it,
 * the cursor marks what is being read and the glass shows it clear.
 *
 * That first attempt scaled the WHOLE image under the pointer and panned it.
 * It meant the part jumped the moment the cursor crossed the frame, the thing
 * being looked at slid away from the cursor rather than staying under it, and
 * there was no longer any context around the detail — three separate ways of
 * losing the reader's place in a photo they were trying to read carefully.
 *
 * Behaviour:
 *  - pointer only (`pointerType === 'mouse'`). A touch device has no hover, and
 *    a lens that latches on after a tap is something the reader then has to
 *    work out how to dismiss. Phones and tablets get the plain image.
 *  - the lens's POSITION is clamped to the frame so it never hangs off an edge.
 *    What it shows is never clamped, so the view stays true into the corners.
 *  - `background-position` on a div rather than a transformed <img>: the
 *    browser composites a background shift without re-rasterising, so tracking
 *    stays smooth.
 *  - the watermark behind the part is NOT magnified. It is a backdrop, not part
 *    of the product, and blowing it up would put giant letters over the detail
 *    the lens was opened to read.
 *  - no transition on the lens position. Easing it would make the glass lag the
 *    cursor, which reads as broken rather than smooth.
 */
export function ImageZoom({ product, className, children }) {
  const frame = useRef(null);
  const [lens, setLens] = useState(null);

  const photo = productPhoto(product);

  const track = useCallback((event) => {
    const node = frame.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Measured per move rather than once: the frame is responsive, and a lens
    // sized at mount would be wrong after a resize or an orientation change.
    //
    // It also SHRINKS near the top, to whatever fits in the room above the
    // cursor. The alternative is clamping a fixed lens, and a clamped lens slides
    // down onto the pointer — which is the one thing this must never do. A
    // smaller glass in the top strip is a much cheaper compromise than a glass
    // that covers what it is magnifying, and the shrink is gradual enough to
    // read as the lens approaching the edge rather than as a glitch.
    const size = Math.min(lensSize(rect.height), Math.max(0, y - CURSOR_GAP));
    const half = size / 2;

    // Too close to the top for any usable glass. Better nothing than a sliver.
    if (size < 48) {
      setLens(null);
      return;
    }

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setLens(null);
      return;
    }

    // The lens has to magnify what is ACTUALLY on screen, and the <img> does not
    // fill the frame: PartFrame insets it by a percentage of the frame's width,
    // and `object-contain` then letterboxes it inside what is left. Measuring
    // the frame and ignoring both would put the lens over the right pixels but
    // draw the wrong ones — off by the padding, and off again by the letterbox.
    //
    // So measure the <img> itself and map into that box. Outside it there is
    // only ground and watermark, neither of which is worth magnifying.
    const img = node.querySelector('img');
    if (!img) {
      setLens(null);
      return;
    }

    const box = img.getBoundingClientRect();

    // `object-contain` fits the photo inside the element and centres it, so the
    // drawn picture is usually smaller than the box it sits in. These are the
    // drawn bounds, in frame coordinates.
    const natural = img.naturalWidth / img.naturalHeight;
    const boxRatio = box.width / box.height;
    const drawnWidth = natural > boxRatio ? box.width : box.height * natural;
    const drawnHeight = natural > boxRatio ? box.width / natural : box.height;
    const drawnLeft = box.left - rect.left + (box.width - drawnWidth) / 2;
    const drawnTop = box.top - rect.top + (box.height - drawnHeight) / 2;

    // Where the cursor sits within the drawn picture. Off the picture, there is
    // nothing to magnify.
    const px = x - drawnLeft;
    const py = y - drawnTop;
    if (px < 0 || py < 0 || px > drawnWidth || py > drawnHeight) {
      setLens(null);
      return;
    }

    // WHERE THE GLASS SITS and WHAT IT SHOWS are two different things, and this
    // is the one place that matters. The glass floats above the cursor so the
    // arrow does not cover the detail; the background inside it is still the
    // area UNDER the cursor. Tying the two together is what put the pointer in
    // the middle of the thing being read.
    //
    // Horizontally centred on the cursor, vertically lifted by half the lens
    // plus the gap. Both clamped to the frame so the glass never hangs off an
    // edge — and because only its POSITION is clamped, the view inside stays
    // correct right into the corners.
    // ALWAYS above the cursor, at every point on the photo. It used to flip
    // below near the top edge, which meant the glass jumped across the pointer
    // as the reader moved up — the thing they were reading through changed
    // sides for a reason nothing on screen explained.
    //
    // No vertical clamp is needed: `size` above has already been reduced to
    // whatever fits in the room available, so this can never push the glass
    // through the top of the frame or back down onto the cursor.
    const top = y - half - CURSOR_GAP;

    setLens({
      size,
      left: Math.min(rect.width - half, Math.max(half, x)),
      top,
      bgX: -(px * ZOOM - half),
      bgY: -(py * ZOOM - half),
      width: drawnWidth,
      height: drawnHeight,
    });
  }, []);

  const start = useCallback(
    (event) => {
      if (event.pointerType !== 'mouse') return;
      track(event);
    },
    [track],
  );

  const stop = useCallback(() => setLens(null), []);

  // No photograph means the line drawing, which is vector and has no detail to
  // magnify — so it renders as an ordinary frame.
  if (!photo) return children;

  return (
    <div
      ref={frame}
      onPointerEnter={start}
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse') return;
        track(event);
      }}
      onPointerLeave={stop}
      className={cn('relative size-full', className)}
    >
      {children}

      {lens && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-2 overflow-hidden rounded-full border-2 border-surface bg-surface-2 bg-no-repeat shadow-flyout ring-1 ring-line"
          style={{
            width: lens.size,
            height: lens.size,
            left: lens.left - lens.size / 2,
            top: lens.top - lens.size / 2,
            backgroundImage: `url("${photo}")`,
            // The photo is drawn at the size it occupies ON SCREEN × ZOOM, so
            // what the lens shows lines up exactly with what sits under the
            // cursor — the same picture, three times bigger, not a re-fitted one.
            backgroundSize: `${lens.width * ZOOM}px ${lens.height * ZOOM}px`,
            backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
          }}
        />
      )}
    </div>
  );
}

export default ImageZoom;
