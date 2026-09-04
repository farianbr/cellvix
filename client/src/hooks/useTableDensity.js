import { useCallback, useEffect, useState } from 'react';

const KEY = 'cellvix:table-density';
const VALUES = ['comfortable', 'compact'];

/**
 * Row density for every admin table, remembered across sessions.
 *
 * The design wants comfortable — generous rows, no full-width rules, the row
 * itself as the hover target — because that is what separates a product surface
 * from a spreadsheet. Operators running an ERP all day want the opposite: as
 * many rows on screen as will fit, because their job is scanning fifty orders,
 * not admiring eight.
 *
 * Both are right, so this is a preference rather than a decision. Comfortable
 * is the default because it is the better first impression and the better
 * choice for the majority of screens, which show ten rows and not a hundred.
 *
 * Stored in localStorage rather than on the user record: it is a per-device
 * viewing preference, like a window size, and an operator on a laptop and a
 * wall-mounted warehouse screen wants a different answer on each. It also must
 * not need a round trip — a table that renders at one density and then reflows
 * to another once a request lands is worse than either density alone.
 */
export function useTableDensity() {
  const [density, setDensity] = useState(() => {
    // Guarded: private-mode Safari throws on access rather than returning null,
    // and a storage failure must never stop a table from rendering.
    try {
      const stored = localStorage.getItem(KEY);
      return VALUES.includes(stored) ? stored : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, density);
    } catch {
      /* preference is not important enough to surface a failure for */
    }
  }, [density]);

  // Every table on the page shares one preference, so a change in one has to
  // reach the others. A custom event is enough — this is same-tab, and the
  // `storage` event does not fire in the tab that wrote the value.
  useEffect(() => {
    function onChange(event) {
      setDensity(event.detail);
    }
    window.addEventListener('cellvix:density', onChange);
    return () => window.removeEventListener('cellvix:density', onChange);
  }, []);

  const toggle = useCallback(() => {
    setDensity((current) => {
      const next = current === 'comfortable' ? 'compact' : 'comfortable';
      window.dispatchEvent(new CustomEvent('cellvix:density', { detail: next }));
      return next;
    });
  }, []);

  return [density, toggle];
}

export default useTableDensity;
