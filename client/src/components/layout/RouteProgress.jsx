import { useEffect, useRef, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';

/**
 * The thin bar across the top that says the app is working.
 *
 * **The problem it solves is the jump.** A route used to answer a click by
 * replacing the whole page with a skeleton and then replacing that with the
 * real thing — two full repaints for one navigation, which reads as the layout
 * collapsing and rebuilding rather than as a page arriving. Keeping the old
 * content on screen and marking the wait in one 2px strip is both calmer and
 * more honest: nothing has changed yet, and something is coming.
 *
 * **It watches queries, not routes.** Almost every screen here paints its shell
 * immediately and then waits on data, so route state alone would miss the part
 * the operator actually waits for. `useIsFetching` counts every in-flight
 * request, which covers a first load, a filter change and a background refetch
 * with one signal.
 *
 * ## Why it is not simply `isFetching ? <bar/> : null`
 *
 * Two rules, and both exist because the naive version is worse than no bar:
 *
 * 1. **A delay before it appears.** A cached query resolves in 20ms, and a bar
 *    that flashes for one frame on every keystroke is visual noise that trains
 *    the eye to ignore it. Nothing shows until a request has been outstanding
 *    long enough to be worth reporting.
 *
 * 2. **A minimum visible time once it does.** A bar that appears and vanishes
 *    within 40ms is a flicker, not feedback. Once shown it stays for long
 *    enough to be read as a deliberate state.
 *
 * The width is eased rather than animated to completion: it climbs towards 90%
 * while work is outstanding and only reaches 100% when the work is actually
 * done. A bar that fills at a fixed rate is lying about progress it cannot
 * know, and it always finishes either far too early or visibly late.
 */

/** Long enough that a cached response never shows a bar at all. */
const APPEAR_AFTER_MS = 180;
/** Once it is up, it stays up long enough to read as a state. */
const MIN_VISIBLE_MS = 320;

export function RouteProgress() {
  const fetching = useIsFetching();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  // `shownAt` is what enforces the minimum: the hide path measures against it
  // rather than against the moment the request finished.
  const shownAt = useRef(0);

  useEffect(() => {
    if (fetching > 0) {
      if (visible) return undefined;

      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
        // Starts at a visible fraction rather than zero: a bar that begins at
        // 0% is indistinguishable from no bar for its first moments, which is
        // exactly when the reader is looking for the answer to "did that
        // register?".
        setProgress(0.12);
      }, APPEAR_AFTER_MS);

      return () => clearTimeout(timer);
    }

    if (!visible) return undefined;

    // Work is done. Fill it, hold briefly so the completed bar is seen, then
    // fade. Completing before disappearing is the whole reason the bar reads
    // as "finished" rather than "gave up".
    const elapsed = Date.now() - shownAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    setProgress(1);
    const timer = setTimeout(() => setVisible(false), wait + 220);
    return () => clearTimeout(timer);
  }, [fetching, visible]);

  // Creep towards 90% while work is outstanding. Never further: the last tenth
  // belongs to the response actually arriving, and a bar sitting full while
  // the page has not changed is the one thing worse than no bar.
  useEffect(() => {
    if (!visible || fetching === 0) return undefined;

    const timer = setInterval(() => {
      setProgress((current) => {
        if (current >= 0.9) return current;
        // Decelerating: fast while there is headroom, slower as it approaches
        // the ceiling, so a long wait never looks stalled.
        return current + (0.9 - current) * 0.12;
      });
    }, 220);

    return () => clearInterval(timer);
  }, [visible, fetching]);

  if (!visible) return null;

  return (
    <div
      // `fixed` and above the shell: the bar belongs to the window, not to the
      // scroll container, so it stays put on a page scrolled halfway down.
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div
        // The brand ramp, which is what it is for — a thin horizontal fill is
        // exactly the surface §2.2 keeps the gradient for. Compact, because at
        // 2px the full ramp's dark opening would read as a stripe.
        className="bg-brand-gradient-compact h-full origin-left transition-[transform,opacity] duration-300 ease-entrance motion-reduce:transition-none"
        style={{
          transform: `scaleX(${progress})`,
          // Fades as it completes, so the finish is one gesture rather than a
          // full bar blinking out.
          opacity: progress >= 1 ? 0 : 1,
        }}
      />
    </div>
  );
}

export default RouteProgress;
