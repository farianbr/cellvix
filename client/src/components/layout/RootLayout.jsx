import { Navigate, Outlet } from 'react-router';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import BackToTop from './BackToTop';
import ScrollToTop from './ScrollToTop';
import AccountPopup from '@/components/account/AccountPopup';
import SignOutConfirm from '@/components/account/SignOutConfirm';
import RouteFallback from './RouteFallback';
import { useAuth } from '@/hooks/useAuth';

/** Chrome shared by every route: header, footer, and the global overlays. */
export function RootLayout() {
  const { isLoading, isAdmin, isStaff } = useAuth();

  // Cellvix people have no buyer side. The catalogue, cart and checkout all
  // assume a business account behind them, so any staff account is sent to the
  // console
  // from any storefront URL — typed, bookmarked or followed from an email.
  //
  // The wait on `isLoading` is what keeps a hard refresh at `/` from painting
  // the shop for a beat before `/auth/me` answers.
  if (isLoading) return <RouteFallback />;
  if (isAdmin || isStaff) return <Navigate to="/admin" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <Header />

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <Footer />

      {/* The bottom bar floats over content, so the last of the footer needs
          clearance or it can never be reached. */}
      <div className="h-[calc(64px+env(safe-area-inset-bottom))] shrink-0 lg:hidden" aria-hidden="true" />

      <AccountPopup />
      <SignOutConfirm />
      <MobileBottomNav />
      <BackToTop />
    </div>
  );
}

export default RootLayout;
