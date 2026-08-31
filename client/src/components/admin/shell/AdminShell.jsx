import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { useAdminStats } from '@/hooks/useAdmin';
import RouteFallback from '@/components/layout/RouteFallback';
import AdminSidebar from './AdminSidebar';
import AdminTopBar from './AdminTopBar';
import CommandPalette from './CommandPalette';
import { RecordLabelProvider } from './recordLabel';

/**
 * The ERP shell (§4). `/admin` mounts this instead of the storefront
 * `RootLayout` — the panel is a different application and should not carry the
 * shop header, mega menu or footer.
 *
 * It is also the UI half of the route guard. `requireAdmin` enforces it
 * server-side; this exists so a non-admin gets an honest wall rather than a
 * screen full of failed requests.
 */
export function AdminShell() {
  const { user, isLoading, canUseAdmin, isStaff } = useAuth();
  const signOut = useSignOut();
  const { data: stats } = useAdminStats();
  const location = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // A drawer that survives a route change is a drawer covering the page the
  // user just asked for.
  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  // Ctrl+K / ⌘K anywhere in the panel. The palette itself owns Escape and the
  // arrow keys once it is open.
  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-dvh">
        <div className="hidden w-[220px] shrink-0 bg-ink-deep md:block" />
        <div className="flex-1 p-6">
          <Skeleton className="mb-6 h-10 w-56" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!canUseAdmin) {
    // A staff account with no role gets a different sentence from a customer
    // who wandered in: theirs is a door somebody has not opened yet, not a door
    // that will never open (§7.6).
    const unassigned = isStaff;
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger">
          <ShieldAlert className="size-7" strokeWidth={1.75} />
        </span>
        <h1 className="text-[24px]">{unassigned ? 'No access yet' : 'Admin access only'}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-500">
          {unassigned
            ? 'Your staff account does not have a role assigned yet. An administrator needs to grant you access before this panel opens.'
            : 'This area is restricted to Cellvix staff accounts.'}
        </p>
      </div>
    );
  }

  // Badge counters the sidebar reads by name. These are the unranged figures —
  // the dashboard asks the same endpoint for a date range, and a badge that
  // moved when you changed the dashboard's dates would be nonsense.
  //
  // `openRmas` has no source until phase 7; a missing key renders no badge
  // rather than a zero.
  const badges = {
    pendingUsers: stats?.users?.pending ?? 0,
    overdueInvoices: stats?.receivables?.overdueCount ?? 0,
    lowStock: (stats?.inventory?.lowStock ?? 0) + (stats?.inventory?.outOfStock ?? 0),
    openRmas: stats?.rma?.open ?? 0,
    openTickets: stats?.tickets?.open ?? 0,
  };

  const openSearch = () => setPaletteOpen(true);

  return (
    // The provider wraps both the trail and the outlet: a detail page publishes
    // its record name, and the breadcrumb — a sibling, not a child — reads it.
    <RecordLabelProvider>
      {/*
        The panel is a fixed-height app on screen and a flowing document on
        paper. `h-dvh` with `overflow-hidden` is right for the former and fatal
        for the latter — it would clip the Business Overview to a single page —
        so both are unwound under `print:` (ERP rework §6.11).
      */}
      <div className="flex h-dvh overflow-hidden bg-surface-2 print:block print:h-auto print:overflow-visible print:bg-white">
        <AdminSidebar
          user={user}
          badges={badges}
          onSignOut={signOut}
          onOpenSearch={openSearch}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col print:block">
          <AdminTopBar
            user={user}
            onOpenSearch={openSearch}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <Breadcrumbs />

          <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
            <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-4 lg:px-6 lg:py-7 print:max-w-none print:p-0">
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </RecordLabelProvider>
  );
}

export default AdminShell;
