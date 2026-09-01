import { Link } from 'react-router';
import { ChevronDown, Grid3x3, Headphones, ShoppingCart, User } from 'lucide-react';
import cn from '@/lib/cn';
import { money } from '@/lib/format';
import { BUSINESS_INFO } from '@/lib/constants';
import LiveSearch from '@/components/search/LiveSearch';
import MegaMenu from './MegaMenu';
import useUiStore from '@/store/uiStore';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useAccountMenuTrigger } from '@/components/account/AccountMenu';

/**
 * Account control. Guests get the sign-in popup; a signed-in user gets the
 * account menu, which routes staff to the admin console and buyers (approved or
 * pending) into the /account sections.
 */
function AccountControl() {
  const openAccount = useUiStore((s) => s.openAccount);
  const accountTrigger = useAccountMenuTrigger();
  const accountMenuOpen = useUiStore((s) => s.accountMenuOpen);
  const { user, isAuthenticated, isApproved, isPending, isAdmin } = useAuth();

  // Open, the trigger takes the accent rather than the hover grey: three panels
  // hang off this cluster and the lit button is what says which one you opened.
  const open = isAuthenticated && accountMenuOpen;
  const className = cn(
    'flex items-center gap-2.5 rounded-[10px] px-3 py-2 transition-colors',
    open ? 'bg-brand-50' : 'hover:bg-surface-2',
  );

  const content = (
    <>
      <span className="relative shrink-0">
        <User
          className={cn('size-5', open ? 'text-brand' : 'text-ink-400')}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        {isPending && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warn ring-2 ring-surface"
            aria-hidden="true"
          />
        )}
      </span>
      <span className="max-w-[140px] text-left leading-tight">
        <span className="eyebrow block text-ink-300">
          {!user ? 'Sign in' : isAdmin ? 'Staff' : isApproved ? 'Account' : 'Pending'}
        </span>
        <span className="block truncate font-display text-[13px] font-semibold text-ink-900">
          {user ? user.displayName : 'My account'}
        </span>
      </span>
    </>
  );

  // Signed in, this opens the account menu rather than jumping to the dashboard:
  // the eight destinations behind /account are the point, and sign-out lives in
  // there too rather than as a bare icon next to the name.
  if (isAuthenticated) {
    return (
      <button
        type="button"
        {...accountTrigger}
        className={className}
      >
        {content}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform duration-200',
            open ? 'rotate-180 text-brand' : 'text-ink-300',
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <button type="button" onClick={() => openAccount('signin')} className={className}>
      {content}
    </button>
  );
}

/**
 * Desktop header (brief §4.1, Woodmart order):
 * logo -> Categories mega-menu button -> search -> utility cluster.
 */
export function HeaderDesktop() {
  const megaMenuOpen = useUiStore((s) => s.megaMenuOpen);
  const toggleMegaMenu = useUiStore((s) => s.toggleMegaMenu);
  const toggleCart = useUiStore((s) => s.toggleCart);
  const cartOpen = useUiStore((s) => s.cartFlyoutOpen);

  const { count: cartCount, subtotal } = useCart();

  return (
    <div className="relative hidden lg:block">
      <div className="mx-auto flex max-w-[1400px] items-center gap-5 px-6 py-3.5">
        <Link to="/" className="shrink-0" aria-label={`${BUSINESS_INFO.name} home`}>
          <img
            src="/brand/logo.png"
            srcSet="/brand/logo.png 1x, /brand/logo@2x.png 2x"
            alt={`${BUSINESS_INFO.name} — ${BUSINESS_INFO.tagline}`}
            width="1000"
            height="254"
            className="h-9 w-auto"
          />
        </Link>

        <button
          type="button"
          onClick={toggleMegaMenu}
          aria-expanded={megaMenuOpen}
          aria-haspopup="true"
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] px-4 font-display text-[13.5px] font-semibold transition-[background,filter] duration-[120ms]',
            'bg-brand-gradient text-white hover:brightness-110',
          )}
        >
          <Grid3x3 className="size-4" strokeWidth={2} aria-hidden="true" />
          Categories
          <ChevronDown
            className={cn('size-4 transition-transform duration-200', megaMenuOpen && 'rotate-180')}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>

        <LiveSearch className="min-w-0 flex-1" />

        {/* ---- utility cluster ------------------------------------------- */}
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={`tel:${BUSINESS_INFO.phone.replace(/[^\d+]/g, '')}`}
            className="hidden items-center gap-2.5 rounded-[10px] px-3 py-2 transition-colors hover:bg-surface-2 xl:flex"
          >
            <Headphones className="size-5 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
            <span className="leading-tight">
              <span className="eyebrow block text-ink-300">Sales desk</span>
              <span className="block font-display text-[13px] font-semibold text-ink-900">
                {BUSINESS_INFO.phone}
              </span>
            </span>
          </a>

          <AccountControl />

          <button
            type="button"
            onClick={toggleCart}
            aria-expanded={cartOpen}
            aria-haspopup="dialog"
            className={cn(
              'flex items-center gap-2.5 rounded-[10px] px-3 py-2 transition-colors',
              cartOpen ? 'bg-brand-50' : 'hover:bg-surface-2',
            )}
            aria-label={`Cart, ${cartCount} items`}
          >
            <span className="relative shrink-0">
              <ShoppingCart
                className={cn('size-5', cartOpen ? 'text-brand' : 'text-ink-400')}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {cartCount > 0 && (
                <span className="tnum absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-display text-[10px] font-bold text-white ring-2 ring-surface">
                  {cartCount}
                </span>
              )}
            </span>
            <span className="text-left leading-tight">
              <span className="eyebrow block text-ink-300">Cart</span>
              <span className="tnum block font-display text-[13px] font-semibold text-ink-900">
                {subtotal === null ? '—' : money(subtotal)}
              </span>
            </span>
          </button>
        </div>
      </div>

      <MegaMenu />
    </div>
  );
}

export default HeaderDesktop;
