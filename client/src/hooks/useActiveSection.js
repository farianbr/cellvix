import { useEffect, useState } from 'react';
import { sectionOffset } from '@/lib/scrollToSection';

/**
 * Which of a set of in-page sections the reader is currently on.
 *
 * Drives the FAQ's category sidebar and the article table of contents — both
 * are jump lists that need to say where you are, not only where you can go.
 *
 * Measured on scroll rather than with an IntersectionObserver band, because the
 * two failure cases a band has are exactly the two this has to survive: a
 * section shorter than the band never fires, and the last section on a page can
 * be too short to ever reach the top of the viewport. Reading `top` directly and
 * taking the last heading that has passed the line handles both, and the
 * bottom-of-document clamp makes the final entry reachable.
 *
 * The line is derived from the sticky header's real bottom edge (the same
 * measurement `scrollToSection` lands a heading against) plus `slack`, so
 * jumping to a section and *being* on that section are the same test. A fixed
 * pixel offset is what got this wrong before: the anchor landed the heading
 * just below the header, the line sat above it, and the rail kept the previous
 * section lit.
 *
 * @param {string[]} ids element ids, in document order
 * @param {{slack?: number}} options how far past the header a heading counts
 * @returns {string|null} the active id
 */
export function useActiveSection(ids, { slack = 40 } = {}) {
  const [active, setActive] = useState(null);

  // The array is rebuilt on every render by every caller, so the effect keys off
  // its contents rather than its identity.
  const key = ids.join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) {
      setActive(null);
      return undefined;
    }

    let frame = 0;

    function read() {
      frame = 0;
      const nodes = list
        .map((id) => [id, document.getElementById(id)])
        .filter(([, node]) => node);
      if (nodes.length === 0) return;

      const line = sectionOffset() + slack;

      // Within 2px of the bottom nothing below can scroll into view, so the
      // last section is the answer whatever the line says.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      let current = nodes[0][0];
      if (atBottom) {
        current = nodes.at(-1)[0];
      } else {
        for (const [id, node] of nodes) {
          if (node.getBoundingClientRect().top - line <= 0) current = id;
          else break;
        }
      }

      setActive((previous) => (previous === current ? previous : current));
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
  }, [key, slack]);

  return active;
}

export default useActiveSection;
