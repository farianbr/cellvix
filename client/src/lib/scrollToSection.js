/**
 * In-page section jumps for the FAQ rail and the article table of contents.
 *
 * Why this exists instead of `href="#id"` and `scroll-behavior: smooth`:
 * Motion measures a keyframe by parking the window at the top of the document
 * and putting it straight back (`measureAllKeyframes`). That restore is a
 * programmatic scroll, and a programmatic scroll **cancels an in-flight
 * browser smooth scroll**. Both of these pages animate rows in on scroll, so a
 * native anchor jump reliably stalled a couple of hundred pixels in - the first
 * revealed row killed it every time.
 *
 * So the animation is ours, and it re-asserts the position on every frame with
 * `behavior: 'instant'`. Anything that yanks the window mid-flight is corrected
 * on the next frame rather than ending the journey. Recomputing the target each
 * frame also absorbs the layout shifting under it - the announcement bar
 * collapsing, an image finishing, a disclosure closing above the target.
 */

/** Extra breathing room between the sticky header and the heading it reveals. */
const GAP = 20;

const DURATION = 420;

/**
 * How far down the viewport a jumped-to heading should land.
 *
 * Measured from the elements rather than read from `--chrome-h`, because the
 * header's own height changes as you scroll (the announcement bar collapses)
 * and this is called mid-animation.
 *
 * The sliding nav row has to be counted too. It overlays the body rather than
 * sitting in the header (see PrimaryNav.jsx), so the header's bottom edge is
 * NOT the bottom of the chrome - and a jump that only cleared the header landed
 * its heading under the row. Measured live and only while the row is actually
 * down: it is retracted at the top of the page, and reserving its height there
 * would leave the heading floating 45px lower than asked for.
 */
export function sectionOffset() {
  const header = document.querySelector('header');
  const bottom = header ? header.getBoundingClientRect().bottom : 0;

  const strip = document.querySelector('header nav[aria-label="Site"]');
  const stripBottom = strip ? strip.getBoundingClientRect().bottom : 0;

  return Math.max(0, bottom, stripBottom) + GAP;
}

function targetFor(element) {
  const top = element.getBoundingClientRect().top + window.scrollY - sectionOffset();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.max(0, Math.min(top, max));
}

/**
 * Scrolls `#id` under the header and puts the id in the address bar.
 *
 * The hash goes in with `replaceState`, not by assigning `location.hash`:
 * assigning it makes the browser do its own jump, which would fight this one.
 */
export function scrollToSection(id, { updateHash = true } = {}) {
  const element = document.getElementById(id);
  if (!element) return;

  if (updateHash) window.history.replaceState(null, '', `#${id}`);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    window.scrollTo({ top: targetFor(element), behavior: 'instant' });
    return;
  }

  const startY = window.scrollY;
  const startedAt = performance.now();
  let cancelled = false;

  // A real gesture outranks the animation: if the reader grabs the page we get
  // out of the way rather than dragging them to the heading anyway.
  const abort = () => {
    cancelled = true;
  };
  const events = ['wheel', 'touchstart', 'keydown'];
  for (const event of events) window.addEventListener(event, abort, { passive: true, once: true });

  function cleanup() {
    for (const event of events) window.removeEventListener(event, abort);
  }

  function step(now) {
    if (cancelled) {
      cleanup();
      return;
    }

    const t = Math.min(1, (now - startedAt) / DURATION);
    const eased = 1 - (1 - t) ** 3;
    const target = targetFor(element);

    window.scrollTo({ top: startY + (target - startY) * eased, behavior: 'instant' });

    if (t < 1) requestAnimationFrame(step);
    else cleanup();
  }

  requestAnimationFrame(step);
}

export default scrollToSection;
