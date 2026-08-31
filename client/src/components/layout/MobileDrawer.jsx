import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { iconFor } from '@/lib/icons';
import { ChevronLeft, ChevronRight, Facebook, Instagram, Linkedin, LogOut, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import cn from '@/lib/cn';
import { count as formatCount } from '@/lib/format';
import { BUSINESS_INFO } from '@/lib/constants';
import Drawer from '@/components/ui/Drawer';
import LiveSearch from '@/components/search/LiveSearch';
import useUiStore from '@/store/uiStore';
import useApplyFilterPath from '@/hooks/useApplyFilterPath';
import { useTaxonomy } from '@/hooks/useCatalog';
import { useAuth, useSignOut } from '@/hooks/useAuth';

/**
 * The drawer is the SITE's menu, not the account's.
 *
 * The account sections deliberately are not here. They live one tap away in the
 * bottom bar's account slot (`MobileBottomNav`), which opens the full
 * `AccountMenu` — all nine of them, always current. Mirroring four of the nine
 * into this list gave the drawer a second, permanently incomplete copy of a
 * menu that already exists, and made "where do I find my invoices" a question
 * with two different answers.
 */
const NAV_LINKS = [
  { label: 'Shop all parts', to: '/' },
  { label: 'Offers & combo deals', to: '/offers' },
  { label: 'Blog', to: '/blog' },
  { label: 'FAQ', to: '/faq' },
  { label: 'About us', to: '/about' },
  { label: 'Contact us', to: '/contact' },
  // Both point at /contact, which is where the footer's own Privacy and Terms
  // links already go: neither page has been written yet. Pointed at a real page
  // rather than a route that 404s, and both move to their own paths the moment
  // the copy exists.
  //
  // `neverActive` because the active test below is an exact path match, and
  // three entries sharing /contact would otherwise all light up at once — the
  // highlight is meant to say "you are here", not "one of these three".
  { label: 'Privacy policy', to: '/contact', neverActive: true },
  { label: 'Terms & conditions', to: '/contact', neverActive: true },
];

// Staff get one door into the console rather than the buyer dashboard links.
// The ERP has its own sidebar and its own thirty-odd screens — mirroring that
// tree into the storefront drawer would be a second, worse copy of it.
const ADMIN_LINKS = [
  { label: 'Shop all parts', to: '/' },
  { label: 'Admin console', to: '/admin' },
  { label: 'Offers & combo deals', to: '/offers' },
  { label: 'Blog', to: '/blog' },
  { label: 'FAQ', to: '/faq' },
  { label: 'About us', to: '/about' },
  { label: 'Contact us', to: '/contact' },
];

const SOCIAL = [
  { icon: Facebook, key: 'facebook', label: 'Facebook' },
  { icon: Instagram, key: 'instagram', label: 'Instagram' },
  { icon: Linkedin, key: 'linkedin', label: 'LinkedIn' },
  { icon: Youtube, key: 'youtube', label: 'YouTube' },
];

/**
 * Left slide-in navigation drawer (brief §4.2).
 *
 * Two tabs: Menu (site links) and Categories (a drill-down of the same tree the
 * desktop mega menu renders). Categories entries filter the grid and close the
 * drawer — they do not navigate.
 */
export function MobileDrawer() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const close = useUiStore((s) => s.closeMobileNav);
  const setPath = useApplyFilterPath();

  // The tab lives in the store, not here: the bottom bar's Categories button
  // opens this drawer straight onto the drill-down.
  const tab = useUiStore((s) => s.mobileNavTab);
  const setTab = useUiStore((s) => s.setMobileNavTab);

  // Drill-down stack of nodes, deepest last.
  const [stack, setStack] = useState([]);

  const { pathname } = useLocation();

  const { data: tree } = useTaxonomy();
  const { isAdmin, isAuthenticated } = useAuth();
  const signOut = useSignOut();
  const navLinks = isAdmin ? ADMIN_LINKS : NAV_LINKS;

  const currentNodes = stack.length === 0 ? (tree ?? []) : (stack[stack.length - 1].children ?? []);
  const levelKeys = ['deviceType', 'brand', 'series', 'model'];

  function applyAndClose(nodes) {
    const partial = {};
    const labels = {};
    nodes.forEach((node, index) => {
      partial[levelKeys[index]] = node.slug;
      labels[levelKeys[index]] = node.name;
    });
    setPath(partial, labels);
    setStack([]);
    close();
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      side="left"
      header={
        <div>
          <img
            src="/brand/logo.png"
            alt={BUSINESS_INFO.name}
            width="1000"
            height="254"
            className="h-7 w-auto"
          />
          <p className="eyebrow mt-1.5 text-ink-400">{BUSINESS_INFO.tagline}</p>
        </div>
      }
      bodyClassName="flex flex-col"
      footer={
        <div className="space-y-3 bg-surface-2 p-4">
          <div className="flex gap-2">
            {SOCIAL.map(({ icon: Icon, key, label }) => (
              <a
                key={key}
                href={BUSINESS_INFO.social[key]}
                aria-label={label}
                className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-500 transition-colors hover:border-brand hover:text-brand"
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </a>
            ))}
          </div>

          <ul className="space-y-1.5 text-[12.5px] text-ink-500">
            <li className="flex items-center gap-2">
              <Phone className="size-3.5 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
              {BUSINESS_INFO.phone}
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-3.5 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
              {BUSINESS_INFO.email}
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
              <span>
                {BUSINESS_INFO.address.line1}, {BUSINESS_INFO.address.city},{' '}
                {BUSINESS_INFO.address.region}
              </span>
            </li>
          </ul>
        </div>
      }
    >
      <div className="border-b border-line p-3">
        <LiveSearch onNavigate={close} />
      </div>

      <div className="grid shrink-0 grid-cols-2 border-b border-line">
        {[
          { key: 'menu', label: 'Menu' },
          { key: 'categories', label: 'Categories' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={cn(
              'relative py-3 font-display text-[13px] font-semibold transition-colors',
              tab === item.key
                ? 'bg-brand/6 text-ink-900'
                : 'text-ink-400 hover:text-ink-700',
            )}
          >
            {item.label}
            {tab === item.key && (
              <span className="rule-brand-gradient absolute inset-x-0 bottom-0 h-0.5" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      {tab === 'menu' ? (
        <nav aria-label="Site navigation" className="p-2">
          {navLinks.map((link) => {
            // Exact match only: a prefix test would light up "Shop all parts"
            // on every page in the catalogue. `neverActive` opts out the
            // entries that share a destination with another entry.
            const active = !link.neverActive && pathname === link.to;

            return (
              <Link
                key={link.to + link.label}
                to={link.to}
                onClick={close}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors',
                  active
                    ? 'bg-brand/8 font-semibold text-brand-700'
                    : 'font-medium text-ink-700 hover:bg-surface-2 hover:text-ink-900',
                )}
              >
                {active && (
                  <span
                    className="bg-brand-gradient absolute inset-y-1.5 left-0 w-[3px] rounded-full"
                    aria-hidden="true"
                  />
                )}
                {link.label}
                <ChevronRight
                  className={cn('size-4', active ? 'text-brand' : 'text-ink-300')}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
            );
          })}

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                close();
                signOut();
              }}
              className="mt-1 flex w-full items-center gap-2 border-t border-line px-3 py-2.5 pt-3.5 text-[14px] font-medium text-ink-500 transition-colors hover:text-danger"
            >
              <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Sign out
            </button>
          )}
        </nav>
      ) : (
        <div className="p-2">
          {stack.length > 0 && (
            <button
              type="button"
              onClick={() => setStack((s) => s.slice(0, -1))}
              className="mb-1 flex w-full items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-ink-500 transition-colors hover:bg-surface-2"
            >
              <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              {stack.length === 1 ? 'All categories' : stack[stack.length - 2].name}
            </button>
          )}

          {stack.length > 0 && (
            <button
              type="button"
              onClick={() => applyAndClose(stack)}
              className="mb-2 flex w-full items-center justify-between rounded-[10px] bg-brand-50 px-3 py-2.5 text-[13.5px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
            >
              Shop all {stack[stack.length - 1].name}
              <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          )}

          <ul>
            {currentNodes.map((node) => {
              const Icon = node.icon ? iconFor(node.icon) : null;
              const hasChildren = (node.children?.length ?? 0) > 0;
              const nextStack = [...stack, node];

              return (
                <li key={node.slug}>
                  <button
                    type="button"
                    onClick={() => (hasChildren ? setStack(nextStack) : applyAndClose(nextStack))}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    {Icon && (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-500" aria-hidden="true">
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink-900">
                        {node.name}
                      </span>
                      <span className="tnum block text-[11.5px] text-ink-400">
                        {formatCount(node.count)} parts
                      </span>
                    </span>
                    {hasChildren && (
                      <ChevronRight className="size-4 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Drawer>
  );
}

export default MobileDrawer;
