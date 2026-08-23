import { NavLink, Outlet } from 'react-router';
import {
  Boxes,
  Building2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Package,
  ShieldAlert,
  Tag,
  UserCheck,
} from 'lucide-react';
import cn from '@/lib/cn';
import { ADMIN_NAV } from '@shared/schemas/admin';
import Skeleton from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { useAdminStats } from '@/hooks/useAdmin';

const ICONS = { LayoutDashboard, UserCheck, Package, Boxes, Building2, Tag, Newspaper, HelpCircle };

/**
 * Admin shell and route guard.
 *
 * `requireAdmin` already enforces this server-side; this is the UI half, so a
 * non-admin gets an honest wall instead of a screen full of failed requests.
 */
export function AdminLayout() {
  const { isLoading, isAdmin } = useAuth();
  const signOut = useSignOut();
  const { data: stats } = useAdminStats();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-8 lg:px-6">
        <Skeleton className="mb-6 h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger">
          <ShieldAlert className="size-7" strokeWidth={1.75} />
        </span>
        <h1 className="text-[24px]">Admin access only</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-500">
          This area is restricted to Cellvix staff accounts.
        </p>
      </div>
    );
  }

  const pendingCount = stats?.users?.pending ?? 0;

  return (
    <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-4 lg:px-6 lg:py-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          {/* The one place the gradient marks a whole surface: this is a
              different application, and it should feel like one. */}
          <span className="eyebrow mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-2.5 py-1 text-white">
            <ShieldAlert className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Staff
          </span>
          <h1 className="text-[22px] sm:text-[26px]">Cellvix admin</h1>
        </div>

        {pendingCount > 0 && (
          <p className="text-[13px] text-ink-500">
            <span className="font-semibold text-ink-900">{pendingCount}</span>{' '}
            {pendingCount === 1 ? 'account is' : 'accounts are'} waiting for approval
          </p>
        )}
      </header>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <nav
          aria-label="Admin sections"
          className="mb-4 lg:sticky lg:top-[132px] lg:mb-0 lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:p-2"
        >
          <ul className="scroll-slim flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
            {ADMIN_NAV.map((item) => {
              const Icon = ICONS[item.icon];
              const badge = item.key === 'approvals' && pendingCount > 0 ? pendingCount : null;

              return (
                <li key={item.key} className="shrink-0 lg:shrink">
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                        'border lg:border-0',
                        isActive
                          ? 'border-brand-100 bg-brand-50 text-brand-700'
                          : 'border-line bg-surface text-ink-600 hover:bg-surface-2 hover:text-ink-900 lg:bg-transparent',
                      )
                    }
                  >
                    {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
                    <span className="flex-1">{item.label}</span>
                    {badge && (
                      <Badge tone="brand" size="sm">
                        {badge}
                      </Badge>
                    )}
                  </NavLink>
                </li>
              );
            })}

            <li className="shrink-0 lg:mt-2 lg:shrink lg:border-t lg:border-line lg:pt-2">
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[13.5px] font-medium text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger lg:border-0 lg:bg-transparent"
              >
                <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                Sign out
              </button>
            </li>
          </ul>
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
