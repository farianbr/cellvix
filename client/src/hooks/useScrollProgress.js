import { useEffect, useState } from 'react';

/**
 * Scroll position, direction and 0–1 document progress, sampled on rAF.
 *
 * Read by the mobile bottom bar (which reveals itself once the user has scrolled
 * past the header) and by the back-to-top ring (which draws `progress` as an arc).
 * Both mount on every page, so this stays one passive listener that only sets
 * state when a value actually changed.
 */
export function useScrollProgress() {
  const [state, setState] = useState({ y: 0, progress: 0, direction: 'up' });

  useEffect(() => {
    let last = window.scrollY;
    let direction = 'up';
    let frame = 0;

    function read() {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

      // 4px of slack: a rubber-band bounce should not flip the bar.
      if (y > last + 4) direction = 'down';
      else if (y < last - 4) direction = 'up';
      last = y;

      setState((prev) =>
        prev.y === y && prev.progress === progress && prev.direction === direction
          ? prev
          : { y, progress, direction },
      );
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(read);
    }

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return state;
}

export default useScrollProgress;
