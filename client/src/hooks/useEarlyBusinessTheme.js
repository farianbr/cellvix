import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { paletteVars } from '@shared/businessPalette.js';

import { getBusinessColor, subscribeBusiness } from '@/store/businessStore';

/**
 * The business ramp, painted from app start rather than from shell mount.
 *
 * ## The gap this closes
 *
 * `useBusinessTheme` is called by `AdminShell`, and its portal rule is
 * `body:has([data-business-theme])` - which only matches once the shell is
 * actually on the page. That is the right scope for a dialog, because a dialog
 * cannot open before the shell that raises it.
 *
 * **`RouteProgress` can.** It is mounted in `App`, OUTSIDE `<Routes>`, so on a
 * reload it starts drawing for the very first requests while `AdminShell` is
 * still suspending on its lazy chunk. At that moment no element carries
 * `data-business-theme`, the rule does not match, and
 * `.bg-brand-gradient-compact` falls back to the Cellvix hex literals baked
 * into it - so a CellShoppe admin reloading their panel got a red bar, then a
 * teal one on every navigation afterwards.
 *
 * ## Why this is a second hook rather than a change to the first
 *
 * The two answer different questions. `useBusinessTheme` asks "what colour is
 * the business this shell is showing", and it has the record to answer it.
 * This asks "what colour was the panel last time", which is knowable before any
 * request resolves and is the only answer available during the gap. Merging
 * them would put a `sessionStorage` read into the path that already has the
 * truth in hand.
 *
 * ## Why it is scoped to the panel's own paths
 *
 * **The storefront is always Cellvix** and must never be repainted by a
 * business somebody once selected in the panel. A path test is what separates
 * them before any shell exists to carry an attribute - which is exactly the
 * condition that makes this hook necessary in the first place.
 *
 * `/superadmin` is deliberately NOT included. The platform console sits above
 * every tenant and is not any one business's surface.
 *
 * The rule is written at a lower specificity than the shell's own, and the
 * shell's inline `style` outranks both, so once `AdminShell` mounts its record
 * wins on every variable this sets.
 */
export function useEarlyBusinessTheme() {
  const { pathname } = useLocation();
  const token = useSyncExternalStore(subscribeBusiness, getBusinessColor, getBusinessColor);

  const scoped = pathname === '/admin' || pathname.startsWith('/admin/');

  useEffect(() => {
    if (!scoped || !token || typeof document === 'undefined') return undefined;

    const vars = paletteVars(token);
    const css = Object.entries(vars)
      .map(([key, value]) => `${key}:${value}`)
      .join(';');

    const style = document.createElement('style');
    style.dataset.businessTheme = 'early';
    style.textContent = `body{${css}}`;
    document.head.append(style);

    return () => style.remove();
  }, [scoped, token]);
}

export default useEarlyBusinessTheme;
