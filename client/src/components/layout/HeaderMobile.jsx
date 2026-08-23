import { Link } from 'react-router';
import { Menu, ShoppingCart, User } from 'lucide-react';
import { BUSINESS_INFO } from '@/lib/constants';
import LiveSearch from '@/components/search/LiveSearch';
import useUiStore from '@/store/uiStore';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useAccountMenuTrigger } from '@/components/account/AccountMenu';

/**
 * Tablet / mobile header (brief §4.2, Unimart pattern):
 * hamburger — centred logo — cart, with the search bar on its own row beneath.
 */
export function HeaderMobile() {
  const openMobileNav = useUiStore((s) => s.openMobileNav);
  const toggleCart = useUiStore((s) => s.toggleCart);
  const cartOpen = useUiStore((s) => s.cartFlyoutOpen);
  const openAccount = useUiStore((s) => s.openAccount);
  const accountTrigger = useAccountMenuTrigger();
  const searchFocusToken = useUiStore((s) => s.searchFocusToken);
  const { count: cartCount } = useCart();
  const { isAuthenticated, isPending } = useAuth();

  return (
    <div className="lg:hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => openMobileNav()}
          aria-label="Open menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] text-ink-700 transition-colors hover:bg-surface-2"
        >
          <Menu className="size-[22px]" strokeWidth={2} />
        </button>

        <Link to="/" className="mx-auto min-w-0" aria-label={`${BUSINESS_INFO.name} home`}>
          <img
            src="/brand/logo.png"
            srcSet="/brand/logo.png 1x, /brand/logo@2x.png 2x"
            alt={`${BUSINESS_INFO.name} — ${BUSINESS_INFO.tagline}`}
            width="1000"
            height="254"
            className="h-8 w-auto"
          />
        </Link>

        {/* Signed in, this opens the account menu — the same dropdown the
            desktop header uses — rather than reopening the sign-in popup. */}
        {isAuthenticated ? (
          <button
            type="button"
            {...accountTrigger}
            aria-label="Account"
            className="relative flex size-10 shrink-0 items-center justify-center rounded-[10px] text-ink-700 transition-colors hover:bg-surface-2"
          >
            <User className="size-[21px]" strokeWidth={1.75} />
            {isPending && (
              <span
                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warn ring-2 ring-surface"
                aria-hidden="true"
              />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAccount('signin')}
            aria-label="Account"
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] text-ink-700 transition-colors hover:bg-surface-2 sm:flex"
          >
            <User className="size-[21px]" strokeWidth={1.75} />
          </button>
        )}

        <button
          type="button"
          onClick={toggleCart}
          aria-expanded={cartOpen}
          aria-haspopup="dialog"
          aria-label={`Cart, ${cartCount} items`}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-[10px] text-ink-700 transition-colors hover:bg-surface-2"
        >
          <ShoppingCart className="size-[21px]" strokeWidth={1.75} />
          {cartCount > 0 && (
            <span className="tnum absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-display text-[10px] font-bold text-white ring-2 ring-surface">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* The bottom bar's search button focuses THIS field — see uiStore. */}
      <div className="px-3 pb-3">
        <LiveSearch focusToken={searchFocusToken} />
      </div>
    </div>
  );
}

export default HeaderMobile;
