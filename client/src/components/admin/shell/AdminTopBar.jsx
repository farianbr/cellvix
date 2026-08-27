import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Bell, Menu, Search } from 'lucide-react';
import cn from '@/lib/cn';
import { matchAdminRoute } from '@/lib/adminRoutes';
import CreateMenu from './CreateMenu';

/**
 * The ERP top bar (§4, convention 4): page-title chip with a back arrow,
 * global search, `+ Create`, notification bell, user chip.
 *
 * The bell stays disabled with an honest title until phase 12 — a button that
 * silently does nothing is worse than one that says why.
 */
export function AdminTopBar({ user, unread = 0, onOpenSearch, onOpenMobileNav }) {
  const location = useLocation();
  const navigate = useNavigate();
  const meta = matchAdminRoute(location.pathname);
  const isHome = location.pathname === '/admin';

  const initials = (user?.contactName ?? user?.businessName ?? 'A')
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4 print:hidden">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="flex size-9 shrink-0 items-center justify-center rounded-[9px] text-ink-500 hover:bg-surface-2 hover:text-ink-900 md:hidden"
      >
        <Menu className="size-[18px]" strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="flex min-w-0 items-center gap-1.5">
        {!isHome && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-ink-400 hover:bg-surface-2 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <span className="min-w-0 truncate rounded-full bg-surface-2 px-3 py-1 font-display text-[13px] font-semibold text-ink-700">
          {meta?.title ?? 'Admin'}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="ml-auto hidden max-w-[380px] flex-1 items-center gap-2 rounded-[9px] border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-300 transition-colors hover:border-line-strong hover:text-ink-500 lg:flex"
      >
        <Search className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1 text-left">Search clients, orders, products…</span>
        <kbd className="rounded border border-line px-1 py-px text-[10px] leading-none text-ink-300">
          Ctrl K
        </kbd>
      </button>

      <div className={cn('flex shrink-0 items-center gap-1.5', 'ml-auto lg:ml-2')}>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search"
          className="flex size-9 items-center justify-center rounded-[9px] text-ink-500 hover:bg-surface-2 hover:text-ink-900 lg:hidden"
        >
          <Search className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        </button>

        <CreateMenu />

        <button
          type="button"
          disabled
          title="Notifications ship in phase 12."
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          className="relative flex size-9 items-center justify-center rounded-[9px] text-ink-500 opacity-45"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" aria-hidden="true" />
          )}
        </button>

        <span
          className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-[11.5px] font-semibold text-ink-700"
          title={user?.email}
        >
          {initials}
        </span>
      </div>
    </header>
  );
}

export default AdminTopBar;
