import { useEffect } from 'react';

/**
 * Calls `handler` when a pointer press lands outside every supplied ref.
 * Uses `pointerdown` so a dropdown closes on press, not on release — that is
 * what makes the header widgets feel immediate.
 */
export function useOnClickOutside(refs, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;

    const list = Array.isArray(refs) ? refs : [refs];

    function onPointerDown(event) {
      const inside = list.some((ref) => ref.current?.contains(event.target));
      if (!inside) handler(event);
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [refs, handler, active]);
}

export default useOnClickOutside;
