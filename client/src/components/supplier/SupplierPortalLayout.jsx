import { Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Menu } from 'lucide-react';
import cn from '@/lib/cn';
import Skeleton from '@/components/ui/Skeleton';
import { pressable } from '@/lib/motion';
import {
  useSupplierSession,
  useSupplierPortalMutations,
  useSupplierOrders,
} from '@/hooks/useSupplierPortal';
import SupplierLoginPage from '@/pages/supplier/SupplierLoginPage';
import SupplierSidebar from './SupplierSidebar';

/**
 * The supplier portal's shell (§6.8a).
 *
 * **The admin panel's shape.** This was ninety lines and one nav item, on the
 * reasoning that a supplier opens the portal to answer one question and leave.
 * That held while there was one screen; it stopped holding once a supplier had
 * orders to price, proformas to issue and deliveries to report — five screens
 * with no way to move between them is a worse answer than chrome.
 *
 * **Still outside `RootLayout`, like the admin panel.** A supplier is not a
 * customer: the shop header, the mega menu, the cart and the price gate all
 * belong to a buyer's session, and putting a supplier inside them would offer
 * them a catalogue they cannot order from and a cart they can never check out.
 *
 * **Signed out renders the sign-in page in place**, rather than redirecting.
 * A supplier arriving on `/supplier/orders/<id>` from an emailed link and being
 * bounced to `/supplier` would lose the order they were sent, and coming back
 * to it means finding the email again. Signing in here leaves them exactly
 * where they were headed.
 */
export function SupplierPortalLayout() {
  const navigate = useNavigate();
  const { supplier, isLoading } = useSupplierSession();
  const { signOut } = useSupplierPortalMutations();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Drives the sidebar's counts. Loaded here rather than in each screen so the
  // badge is right on arrival, whichever screen that is.
  const { data } = useSupplierOrders();
  const orders = data?.orders ?? [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!supplier) return <SupplierLoginPage />;

  const badges = {
    // What actually needs them: an order they have not priced, or one we have
    // queried. Anything else is history and should not carry a number.
    orders: orders.filter(
      (order) =>
        order.state === 'open' &&
        ['invited', 'viewed', 'negotiating'].includes(order.myBid.status),
    ).length,
    deliveries: orders.filter(
      (order) => order.state === 'won' && order.myBid.delivery?.status !== 'delivered',
    ).length,
  };

  function handleSignOut() {
    signOut.mutate(undefined, { onSuccess: () => navigate('/supplier') });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-2">
      <SupplierSidebar
        supplier={supplier}
        badges={badges}
        onSignOut={handleSignOut}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className={cn(pressable, 'rounded-md p-2 text-ink-500 hover:text-ink-900 md:hidden')}
          >
            <Menu className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-md font-semibold text-ink-900">
              {supplier.name}
            </span>
            {supplier.email && (
              <span className="block truncate text-xs text-ink-400">{supplier.email}</span>
            )}
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-3 py-5 sm:px-4 lg:px-6 lg:py-7">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="shrink-0 border-t border-line bg-surface px-4 py-2.5 text-xs text-ink-400 sm:px-6">
          Questions about an order? Reply to the email it came from and it reaches our purchasing
          team.
        </footer>
      </div>
    </div>
  );
}

export default SupplierPortalLayout;
