import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Clock, LogOut } from 'lucide-react';
import cn from '@/lib/cn';
import { ACCOUNT_NAV } from '@shared/schemas/account';
import { accountIcon } from './accountIcons';
import Button from '@/components/ui/Button';
import SelectMenu from '@/components/ui/SelectMenu';
import Skeleton from '@/components/ui/Skeleton';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import useUiStore from '@/store/uiStore';

/**
 * Account shell (brief §8.3): ERP-grade information density in Cellvix's clean
 * visual language — sidebar navigation, not a raw admin panel.
 *
 * Also the auth gate for everything under /account. Guests get a sign-in prompt,
 * pending businesses get the "under review" state rather than a bare 403.
 */
export function AccountLayout() {
  const { user, isLoading, isAuthenticated, isApproved, isAdmin } = useAuth();
  const signOut = useSignOut();
  const openAccount = useUiStore((s) => s.openAccount);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Below lg the section list is a dropdown, not a horizontal scroller. Eight
  // pills in a swipe strip hid half the account behind a gesture nothing on the
  // page advertised — the two sections furthest right were effectively unreachable
  // on a 360px phone.
  const activeNav =
    ACCOUNT_NAV.find((item) => item.to !== '/account' && pathname.startsWith(item.to))?.to ??
    '/account';

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6">
        <Skeleton className="mb-6 h-10 w-56" />
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="mt-4 h-96 lg:mt-0" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <h1 className="text-[24px]">Sign in to your account</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-500">
          Order history, invoices, credit and the quick order pad live behind your Cellvix trade
          account.
        </p>
        <Button className="mt-7" size="lg" onClick={() => openAccount('signin')}>
          Sign in
        </Button>
      </div>
    );
  }

  // Staff accounts have no buyer-side orders, invoices or credit — /account is
  // the wrong dashboard for them, so send them to the admin console.
  if (isAdmin) return <Navigate to="/admin" replace />;

  if (!isApproved) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-warn-50 text-warn">
          <Clock className="size-7" strokeWidth={1.75} />
        </span>
        <h1 className="text-[24px]">Your account is under review</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-500">
          We are verifying <span className="font-medium text-ink-900">{user.businessName}</span>.
          Once that is done, trade pricing, ordering and this dashboard all unlock — usually within
          one business day.
        </p>
        <p className="mt-6 rounded-[10px] bg-surface-2 px-4 py-3 text-[13px] text-ink-500">
          Questions? Email{' '}
          <a href="mailto:sales@cellvix.ca" className="font-medium text-brand hover:underline">
            sales@cellvix.ca
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-3 py-5 sm:px-4 lg:px-6 lg:py-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1 text-ink-400">Trade account</p>
          <h1 className="truncate text-[22px] sm:text-[26px]">{user.businessName}</h1>
        </div>
        <p className="text-[13px] text-ink-500">
          {user.contactName} · <span className="text-ink-400">{user.email}</span>
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* ---- navigation ------------------------------------------------- */}
        <nav
          aria-label="Account sections"
          className="mb-4 lg:sticky lg:top-[132px] lg:mb-0 lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:p-2"
        >
          {/* ---- dropdown below lg ---------------------------------------- */}
          <div className="flex items-center gap-2 lg:hidden">
            <SelectMenu
              srLabel="Account section"
              size="md"
              align="left"
              value={activeNav}
              onChange={(to) => navigate(to)}
              options={ACCOUNT_NAV.map((item) => ({ value: item.to, label: item.label }))}
              className="min-w-0 flex-1"
            />
            <Button variant="outline" icon={LogOut} onClick={signOut} className="shrink-0">
              Sign out
            </Button>
          </div>

          {/* ---- sidebar from lg ------------------------------------------ */}
          <ul className="hidden lg:flex lg:flex-col lg:gap-0.5">
            {ACCOUNT_NAV.map((item) => {
              const Icon = accountIcon(item.icon);
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/account'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-600 hover:bg-surface-2 hover:text-ink-900',
                      )
                    }
                  >
                    {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
                    {item.label}
                  </NavLink>
                </li>
              );
            })}

            <li className="mt-2 border-t border-line pt-2">
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger"
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

export default AccountLayout;
