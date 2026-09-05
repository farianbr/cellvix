import { Link, Outlet, useNavigate } from 'react-router';
import { LogOut, Send } from 'lucide-react';
import cn from '@/lib/cn';
import { BUSINESS_INFO } from '@shared/business';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import { useSupplierSession, useSupplierPortalMutations } from '@/hooks/useSupplierPortal';
import SupplierLoginPage from '@/pages/supplier/SupplierLoginPage';
import { pressable } from '@/lib/motion';

/**
 * The supplier portal's shell (§6.8a).
 *
 * **Outside `RootLayout`, like the admin panel.** A supplier is not a customer:
 * the shop header, the mega menu, the cart and the price gate all belong to a
 * buyer's session, and putting a supplier inside them would offer them a
 * catalogue they cannot order from and a cart they can never check out.
 *
 * **Signed out renders the sign-in page in place**, rather than redirecting.
 * A supplier arriving on `/supplier/rfq/<id>` from an emailed link and being
 * bounced to `/supplier` would lose the request they were sent, and coming back
 * to it means finding the email again. Signing in here leaves them exactly
 * where they were headed.
 *
 * Deliberately thin: four screens, one nav item, no sidebar. A supplier opens
 * this to answer one question and leave, and a chrome heavier than the task is
 * chrome nobody wanted.
 */
export function SupplierPortalLayout() {
  const navigate = useNavigate();
  const { supplier, isLoading } = useSupplierSession();
  const { signOut } = useSupplierPortalMutations();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!supplier) return <SupplierLoginPage />;

  return (
    <div className="min-h-dvh bg-surface-2">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/supplier"
            className={cn(pressable, 'flex min-w-0 items-center gap-2.5')}
          >
            {/* The brand ramp on a small glyph takes the compact variant — the
                full ramp's near-black opening reads as a stripe at this size. */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-gradient-compact text-white">
              <Send className="size-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-md font-bold leading-tight text-ink-900">
                {BUSINESS_INFO.name} suppliers
              </span>
              <span className="block truncate text-xs text-ink-400">{supplier.name}</span>
            </span>
          </Link>

          <Button
            variant="ghost"
            icon={LogOut}
            className="ml-auto"
            loading={signOut.isPending}
            onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate('/supplier') })}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-ink-400 sm:px-6">
        Questions about a request? Reply to the email it came from and it reaches our purchasing
        team.
      </footer>
    </div>
  );
}

export default SupplierPortalLayout;
