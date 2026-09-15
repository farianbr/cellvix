import { useEffect, useMemo } from 'react';
import { paletteVars } from '@shared/businessPalette.js';

/**
 * The accent the panel paints itself in, for whichever business is selected.
 *
 * ## How one object repaints 175 class names
 *
 * Tailwind v4's `@theme` block emits real CSS custom properties, so every
 * `bg-brand`, `text-brand-700` and `border-brand` in the panel has already
 * compiled to `var(--color-brand*)`. Redefining those variables on one ancestor
 * re-points all of them at once - which is why switching business recolours the
 * whole panel without a single component knowing this exists.
 *
 * The two things that did NOT follow from that are handled in
 * `shared/businessPalette.js` and `styles/index.css`: the gradient utilities
 * used to hardcode hex literals, and `--color-ink-deep` (the sidebar ground) is
 * a near-black deliberately warmed toward the accent. Both read variables now,
 * each with the Cellvix value as its fallback, so anything that does not set
 * them - the entire storefront - renders exactly as it did before.
 *
 * ## Why a style object rather than a class
 *
 * Six palettes times twenty variables is either 120 lines of dead CSS shipped
 * to every visitor, or one inline object built from the palette the business
 * actually has. It is also the only form that keeps `shared/` the single source
 * of truth: a class list in CSS would have to be kept in step with the JS
 * object by hand.
 *
 * ## Why portals need a second mount point, and why it is a stylesheet
 *
 * **Every modal, drawer, select menu and `ConfirmDialog` is a portal into
 * `document.body`** (`ui/Overlay.jsx`), which is a SIBLING of the shell, not a
 * descendant - so none of them inherit a variable set on the shell's own div.
 * Without covering them, switching to a service business recoloured the panel
 * and left every dialog's primary button in Cellvix red, which is worse than
 * not theming at all: the one moment a screen asks you to confirm something is
 * the wrong moment to show another business's colour.
 *
 * The first attempt wrote the variables onto `document.body.style` directly and
 * removed them on unmount. **That leaks.** Inline styles on a shared, long-lived
 * element are global state with one owner, and the owner is a component that
 * unmounts on a route change: any path that skips the cleanup - a navigation
 * React does not tear down the way you expected, a second shell mounting before
 * the first unmounts, a thrown error between the two - leaves the storefront
 * painted in a business's colour, and the storefront is the one surface that
 * must always be Cellvix.
 *
 * A scoped stylesheet has no such failure mode. The rule only matches while an
 * element carrying `data-business-theme` is on the page, so the styling is tied
 * to the shell's existence rather than to a cleanup function running at the
 * right moment. If the node goes away, the rule stops matching on its own.
 *
 * `:has()` is what lets a descendant's attribute style `body`, and its support
 * matches the browsers this panel already targets. The shell also carries the
 * variables inline, so the panel itself is correct even in a browser without
 * `:has()` - only the portals would fall back to the Cellvix ramp there.
 *
 * @param colorToken the active business's identity token.
 * @param options.portals whether to emit the body-level rule for portalled
 *   surfaces. On for a panel shell; off for anything that only needs to paint
 *   its own subtree.
 */
export function useBusinessTheme(colorToken, { portals = true } = {}) {
  const vars = useMemo(() => paletteVars(colorToken), [colorToken]);

  const css = useMemo(
    () =>
      Object.entries(vars)
        .map(([key, value]) => `${key}:${value}`)
        .join(';'),
    [vars],
  );

  useEffect(() => {
    if (!portals || typeof document === 'undefined') return undefined;

    const style = document.createElement('style');
    style.dataset.businessTheme = 'portals';
    /**
     * Scoped to the shell's presence, not to this effect's lifetime.
     *
     * `body:has([data-business-theme])` matches only while the panel is
     * mounted, so a portal opened from the panel gets the business ramp and
     * the storefront never does - even if this element somehow outlives the
     * component that made it.
     */
    style.textContent = `body:has([data-business-theme]){${css}}`;
    document.head.append(style);

    return () => style.remove();
  }, [css, portals]);

  /**
   * The browser's own chrome, which is not part of the page and does not read
   * a CSS variable.
   *
   * `index.html` ships `<meta name="theme-color" content="#CF3429">` - Cellvix
   * red, hardcoded, and never updated afterwards. On a mobile browser and on an
   * installed PWA that is the strip the OS paints above the viewport, so a
   * CellShoppe staff member saw a red band across the top of a teal panel on every
   * screen. Nothing inside the document could fix it: the tag is the only thing
   * that colour reads.
   *
   * Restored on unmount rather than left set. The storefront is always Cellvix
   * (§ the brand gradient IS the brand), and leaving a business's colour on the
   * tag would repaint the browser chrome for a shopper who never opened the
   * panel.
   */
  useEffect(() => {
    if (!portals || typeof document === 'undefined') return undefined;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return undefined;

    const previous = meta.getAttribute('content');
    meta.setAttribute('content', vars['--color-brand']);

    return () => meta.setAttribute('content', previous ?? '');
  }, [vars, portals]);

  return vars;
}

export default useBusinessTheme;
