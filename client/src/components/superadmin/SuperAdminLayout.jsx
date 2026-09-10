import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Layers, LogOut, ShieldAlert } from 'lucide-react';
import cn from '@/lib/cn';
import Skeleton from '@/components/ui/Skeleton';
import { pressable } from '@/lib/motion';
import { useSuperAdminSession, useSuperAdminMutations } from '@/hooks/useSuperAdmin';
import SuperAdminLoginPage from '@/pages/superadmin/SuperAdminLoginPage';

/**
 * The platform console's shell (SAAS_PLATFORM §4.5).
 *
 * **Visibly not the tenant panel.** It carries the same structural furniture —
 * a dark rail, a top bar, a content well — but names itself PLATFORM and shows
 * no business switcher, no notifications and no search. An operator who cannot
 * tell at a glance which application they are in is one keystroke from
 * reconfiguring the wrong tenant.
 *
 * Outside `RootLayout` and outside `AdminShell`, for the reason the supplier
 * portal is outside both: this is a third application with a third session, and
 * nesting it inside either would give it chrome belonging to a population it is
 * not part of.
 */

const NAV = [
  { key: 'tenants', label: 'Tenants', to: '/superadmin', end: true, icon: Layers },
  { key: 'plans', label: 'Plans', to: '/superadmin/plans', icon: ShieldAlert },
];

export function SuperAdminLayout() {
  const navigate = useNavigate();
  const { admin, isLoading } = useSuperAdminSession();
  const { signOut } = useSuperAdminMutations();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!admin) return <SuperAdminLoginPage />;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-2">
      <header className="flex h-14 shrink-0 items-center gap-4 bg-ink-deep px-4 sm:px-6">
        <span className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-gradient-compact font-display text-sm font-bold text-white">
            P
          </span>
          <span className="min-w-0">
            <span className="block font-display text-md font-bold leading-none text-white">
              Platform
            </span>
            {/* The platform has no name yet (§0.1). Saying "console" rather than
                inventing one keeps the placeholder honest. */}
            <span className="eyebrow mt-0.5 block text-ink-200">Operator console</span>
          </span>
        </span>

        <nav aria-label="Console sections" className="ml-4 flex items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  pressable,
                  'rounded-md px-2.5 py-1.5 text-sm font-medium',
                  isActive
                    ? 'bg-white/[0.12] text-white'
                    : 'text-ink-200 hover:bg-white/[0.08] hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <span className="ml-auto flex items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className="block text-sm font-medium leading-tight text-white">{admin.name}</span>
            <span className="block text-xs text-ink-200">{admin.email}</span>
          </span>
          <button
            type="button"
            onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate('/superadmin') })}
            aria-label="Sign out"
            className={cn(pressable, 'rounded-md p-2 text-ink-200 hover:bg-white/[0.08] hover:text-white')}
          >
            <LogOut className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </span>
      </header>

      <main className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-[1200px] px-3 py-5 sm:px-4 lg:px-6 lg:py-7">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default SuperAdminLayout;
