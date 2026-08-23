import { useEffect, useId, useLayoutEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { LogOut, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import cn from '@/lib/cn';
import { ACCOUNT_NAV } from '@shared/schemas/account';
import { accountIcon } from './accountIcons';
import useUiStore from '@/store/uiStore';
import { useAuth, useSignOut } from '@/hooks/useAuth';

/**
 * Props for any button that opens the account menu.
 *
 * Marking the pressed button is what lets the panel anchor to the control the
 * user actually touched — three of them are mounted at once, and two are
 * visible together on a phone.
 */
export function useAccountMenuTrigger() {
  const toggle = useUiStore((s) => s.toggleAccountMenu);
  const open = useUiStore((s) => s.accountMenuOpen);

  return {
    'data-account-trigger': '',
    'aria-expanded': open,
    'aria-haspopup': 'dialog',
    onClick(event) {
      const pressed = event.currentTarget;
      for (const element of document.querySelectorAll('[data-account-active]')) {
        element.removeAttribute('data-account-active');
      }
      pressed.setAttribute('data-account-active', '');
      toggle();
    },
  };
}

/**
 * The signed-in account menu, anchored under the header account button.
 *
 * Reaching order history used to mean landing on /account first and finding the
 * sidebar; the same eight destinations are one click from any page now. It
 * reads `ACCOUNT_NAV` — the shared list the sidebar uses — so the two cannot
 * fall out of step.
 *
 * Rendered inside <header> next to CartDropdown, and behaves the same way: no
 * portal, scrim below the header, its own Escape handler.
 */
export function AccountMenu() {
  const open = useUiStore((s) => s.accountMenuOpen);
  const close = useUiStore((s) => s.closeAccountMenu);

  const { user, isApproved, isPending, isAdmin } = useAuth();
  const signOut = useSignOut();

  const titleId = useId();

  // Three different buttons open this — desktop header, mobile header, bottom
  // bar — and they sit in different places. The panel is positioned against the
  // one that was actually pressed (see useAccountMenuTrigger), so it always
  // reads as belonging to that control rather than to the page edge.
  const [anchor, setAnchor] = useState(null);

  useLayoutEffect(() => {
    if (!open) return undefined;

    function measure() {
      const visible = [...document.querySelectorAll('[data-account-trigger]')].filter(
        (element) => element.offsetParent !== null,
      );
      const trigger = visible.find((element) => element.hasAttribute('data-account-active')) ?? visible[0];
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      // A trigger in the lower half of the screen — the bottom bar — gets the
      // panel above it; hanging it below would put it off-screen.
      const below = rect.top < window.innerHeight / 2;

      setAnchor({
        top: below ? rect.bottom + 10 : undefined,
        bottom: below ? undefined : window.innerHeight - rect.top + 10,
        // Clamped so a trigger near the screen edge cannot push the panel off it.
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') close();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  if (!user) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 top-[var(--header-h,116px)] z-30 bg-ink-900/40 backdrop-blur-[1px]"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ top: anchor?.top, bottom: anchor?.bottom, right: anchor?.right ?? 12 }}
            className={cn('fixed z-40', anchor?.bottom ? 'origin-bottom-right' : 'origin-top-right')}
          >
            <div className="flex justify-end">
              <div
                role="dialog"
                aria-labelledby={titleId}
                className="flex max-h-[min(72vh,620px)] w-[min(320px,calc(100vw-24px))] flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-flyout"
              >
                <header id={titleId} className="shrink-0 border-b border-line px-4 py-3.5">
                  <p className="truncate font-display text-[15px] font-bold text-ink-900">
                    {user.businessName}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-400">{user.email}</p>

                  <span
                    className={cn(
                      'mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
                      isAdmin
                        ? 'bg-surface-3 text-ink-700'
                        : isApproved
                          ? 'bg-ok-50 text-ok'
                          : 'bg-warn-50 text-warn',
                    )}
                  >
                    <ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    {isAdmin ? 'Staff account' : isApproved ? 'Trade account approved' : 'Under review'}
                  </span>
                </header>

                <div className="scroll-slim flex-1 overflow-y-auto overscroll-contain p-2">
                  {isAdmin ? (
                    // Staff have no buyer orders, invoices or credit — the buyer
                    // nav would be eight dead ends.
                    <Link
                      to="/admin"
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-surface-2 hover:text-ink-900"
                    >
                      Admin console
                    </Link>
                  ) : (
                    <ul className="space-y-0.5">
                      {ACCOUNT_NAV.map((item) => {
                        const Icon = accountIcon(item.icon);
                        return (
                          <li key={item.key}>
                            <NavLink
                              to={item.to}
                              end={item.to === '/account'}
                              onClick={close}
                              className={({ isActive }) =>
                                cn(
                                  'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                                  isActive
                                    ? 'bg-brand-50 text-brand-700'
                                    : 'text-ink-700 hover:bg-surface-2 hover:text-ink-900',
                                )
                              }
                            >
                              <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                              {item.label}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <footer className="shrink-0 border-t border-line p-2">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-medium text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger"
                  >
                    <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    Sign out
                  </button>
                </footer>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AccountMenu;
