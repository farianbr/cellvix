import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { ChevronDown, LogOut, Search, X } from 'lucide-react';
import cn from '@/lib/cn';
import { ADMIN_NAV } from '@shared/schemas/admin';
import { activeNavKeys } from '@/lib/adminRoutes';
import { adminIcon } from './adminIcons';
import { visibleNav } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import { pressable } from '@/lib/motion';

/**
 * The ERP sidebar (§4). Three shapes, one component:
 *
 *   <768    off-canvas drawer, opened by the top bar hamburger
 *   768–1023 64px icon rail, group icons only, tooltips on hover
 *   1024+   full tree, one group expanded at a time
 *
 * `--color-ink-deep` is the background at every width (§2b) — the warm
 * near-black already defined for exactly this, so the panel reads as Cellvix
 * rather than as generic admin chrome.
 */

function BrandBlock({ compact }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 border-b border-white/10 px-4 py-4',
        compact && 'justify-center px-0',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-gradient font-display text-lg font-bold text-white">
        C
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold leading-none text-white">
            Cellvix
          </span>
          <span className="eyebrow mt-1 block text-ink-200">Operations</span>
        </span>
      )}
    </div>
  );
}

function QuickSearch({ onOpenSearch }) {
  return (
    <div className="px-3 py-3">
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(pressable, 'flex w-full items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-2 text-sm text-ink-200 hover:border-white/25 hover:text-white')}
      >
        <Search className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
        <span className="flex-1 text-left">Quick search</span>
        <kbd className="rounded border border-white/15 px-1 py-px font-sans text-2xs leading-none text-ink-200">
          Ctrl K
        </kbd>
      </button>
    </div>
  );
}

/** A resting/hover/active nav row. The gradient fill is the active state (§2b). */
function navRowClass(isActive, extra) {
  return cn(
    pressable,
    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
    isActive ? 'bg-brand-gradient text-white' : 'text-ink-200 hover:bg-white/[0.08] hover:text-white',
    extra,
  );
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="tnum ml-auto min-w-[20px] rounded-full bg-white/15 px-1.5 py-0.5 text-center text-2xs font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavTree({ badges, onNavigate }) {
  const location = useLocation();
  const { permissions } = useAuth();

  // A group the role cannot reach is not rendered. The server refuses it
  // anyway; hiding it stops an operator clicking into a wall (§7.6).
  const nav = useMemo(() => visibleNav(ADMIN_NAV, permissions), [permissions]);
  const { group: activeGroup, child: activeChild } = activeNavKeys(location.pathname, location.search);

  // One parent expanded at a time (§2, convention 2). Kept in state rather than
  // derived so a deliberate collapse survives until the route changes.
  const [openGroup, setOpenGroup] = useState(activeGroup);
  useEffect(() => setOpenGroup(activeGroup), [activeGroup]);

  return (
    <nav aria-label="Admin sections" className="min-h-0 flex-1 overflow-y-auto scroll-slim px-3 pb-3">
      <ul className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const Icon = adminIcon(item.icon);

          if (!item.children) {
            return (
              <li key={item.key}>
                <NavLink to={item.to} end onClick={onNavigate} className={({ isActive }) => navRowClass(isActive)}>
                  {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          }

          const isOpen = openGroup === item.key;
          const groupBadge = item.children.reduce(
            (sum, child) => sum + (child.badge ? (badges[child.badge] ?? 0) : 0),
            0,
          );

          return (
            <li key={item.key} className="mt-1">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenGroup(isOpen ? null : item.key)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors',
                  isOpen || activeGroup === item.key
                    ? 'text-white'
                    : 'text-ink-200 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
                <span className="flex-1 text-left">{item.label}</span>
                {!isOpen && <Badge count={groupBadge} />}
                <ChevronDown
                  className={cn('size-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')}
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              </button>

              {isOpen && (
                <ul className="mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2.5 ml-[17px]">
                  {item.children.map((child) => {
                    const ChildIcon = adminIcon(child.icon);
                    const isActive = activeChild === child.key;

                    return (
                      <li key={child.key}>
                        <NavLink
                          to={child.to}
                          onClick={onNavigate}
                          className={navRowClass(isActive, 'text-sm')}
                        >
                          {ChildIcon && (
                            <ChildIcon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                          )}
                          <span className="min-w-0 truncate">{child.label}</span>
                          <Badge count={child.badge ? badges[child.badge] : 0} />
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The 768–1023 rail: group icons only, each linking to its first child. A
 * tooltip carries the label, because an icon alone is not a name.
 */
function IconRail({ badges }) {
  const location = useLocation();
  const { permissions } = useAuth();
  const nav = useMemo(() => visibleNav(ADMIN_NAV, permissions), [permissions]);
  const { group: activeGroup } = activeNavKeys(location.pathname, location.search);

  return (
    <nav aria-label="Admin sections" className="min-h-0 flex-1 overflow-y-auto scroll-slim py-3">
      <ul className="flex flex-col items-center gap-1">
        {nav.map((item) => {
          const Icon = adminIcon(item.icon);
          const to = item.to ?? item.children?.[0]?.to;
          const isActive = activeGroup === item.key;
          const count = item.children
            ? item.children.reduce((sum, c) => sum + (c.badge ? (badges[c.badge] ?? 0) : 0), 0)
            : 0;

          return (
            <li key={item.key} className="group relative">
              <NavLink
                to={to}
                end={item.to === '/admin'}
                aria-label={item.label}
                className={cn(
                  pressable,
                  'relative flex size-10 items-center justify-center rounded-md',
                  isActive ? 'bg-brand-gradient text-white' : 'text-ink-200 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                {Icon && <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />}
                {count > 0 && (
                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-danger" aria-hidden="true" />
                )}
              </NavLink>

              <span
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-ink-900 px-2 py-1 text-xs text-white opacity-0 shadow-card transition-opacity group-hover:opacity-100"
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserFooter({ user, onSignOut, compact }) {
  const initials = (user?.contactName ?? user?.businessName ?? 'A')
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  if (compact) {
    return (
      <div className="border-t border-white/10 p-2">
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className={cn(pressable, 'flex size-10 items-center justify-center rounded-md text-ink-200 hover:bg-danger/20 hover:text-white')}
        >
          <LogOut className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 px-3 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">
            {user?.contactName ?? 'Admin'}
          </span>
          <span className="block truncate text-xs text-ink-200">{user?.email}</span>
        </span>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className={cn(pressable, 'flex size-8 shrink-0 items-center justify-center rounded-md text-ink-200 hover:bg-danger/25 hover:text-white')}
        >
          <LogOut className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({ user, badges = {}, onSignOut, onOpenSearch, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* 1024+ — the full tree. */}
      <aside className="hidden h-dvh w-[220px] shrink-0 flex-col bg-ink-deep lg:flex xl:w-[250px] print:hidden">
        <BrandBlock />
        <QuickSearch onOpenSearch={onOpenSearch} />
        <NavTree badges={badges} />
        <UserFooter user={user} onSignOut={onSignOut} />
      </aside>

      {/* 768–1023 — the icon rail. */}
      <aside className="hidden h-dvh w-16 shrink-0 flex-col items-center bg-ink-deep md:flex lg:hidden print:hidden">
        <BrandBlock compact />
        <IconRail badges={badges} />
        <UserFooter user={user} onSignOut={onSignOut} compact />
      </aside>

      {/* <768 — off-canvas drawer. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-ink-900/55"
          />
          <div className="relative flex h-dvh w-[264px] max-w-[85vw] flex-col bg-ink-deep">
            <div className="flex items-center justify-between border-b border-white/10 pr-2">
              <div className="flex-1 border-b-0">
                <BrandBlock />
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink-200 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4.5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <QuickSearch
              onOpenSearch={() => {
                onCloseMobile?.();
                onOpenSearch?.();
              }}
            />
            <NavTree badges={badges} onNavigate={onCloseMobile} />
            <UserFooter user={user} onSignOut={onSignOut} />
          </div>
        </div>
      )}
    </>
  );
}

export default AdminSidebar;
