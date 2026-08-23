import { useLayoutEffect, useRef } from 'react';
import AnnouncementBar from './AnnouncementBar';
import HeaderDesktop from './HeaderDesktop';
import HeaderMobile from './HeaderMobile';
import MobileDrawer from './MobileDrawer';
import CartDropdown from '@/components/cart/CartDropdown';
import AccountMenu from '@/components/account/AccountMenu';

/**
 * Header shell.
 *
 * Desktop and mobile headers are two different layouts (Woodmart vs Unimart per
 * the brief) swapped by CSS visibility, never by a JS width check — that keeps
 * the correct one painted on the first frame.
 */
export function Header() {
  const ref = useRef(null);

  // The mega menu and cart dropdown hang off the header and dim everything
  // below it, so their scrims need the header's real height. It changes with
  // the breakpoint and when the announcement bar is dismissed, so measure it
  // rather than hard-coding — a stale value leaves an undimmed strip.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    function update() {
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header ref={ref} className="sticky top-0 z-40 border-b border-line bg-surface">
        <AnnouncementBar />
        <HeaderDesktop />
        <HeaderMobile />

        {/* Anchored to the header shell, not to either header, so one dropdown
            serves both layouts and stays put while the header is sticky. */}
        <CartDropdown />
        <AccountMenu />
      </header>
      <MobileDrawer />
    </>
  );
}

export default Header;
