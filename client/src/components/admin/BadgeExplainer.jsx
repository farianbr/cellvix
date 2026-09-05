import { Link, useLocation, useSearchParams } from 'react-router';
import { ArrowRight, Bell } from 'lucide-react';
import cn from '@/lib/cn';
import { ADMIN_NAV } from '@shared/schemas/admin';
import { useAdminStats } from '@/hooks/useAdmin';
import { count as formatCount } from '@/lib/format';
import { pressableSurface } from '@/lib/motion';

/**
 * Says what the sidebar's number on this page meant.
 *
 * **The problem.** A count in the nav is a promise that something needs doing,
 * and the operator clicks it to find out what. They then arrive at the page's
 * default view — every ticket, every product — where the badged number appears
 * nowhere. Inventory badged 189 and opened a list of 420. The number is not
 * wrong, but it is unverifiable, and an unverifiable number is one the operator
 * learns to stop reading. That is worse than no badge: the signal is still
 * costing attention while no longer earning any.
 *
 * **The fix is to answer the question at the moment it is asked.** A tooltip on
 * the badge helps somebody who thinks to hover; this states the same fact on
 * arrival, where the doubt actually occurs, and offers the filter that shows
 * exactly those rows. One click from "6" to the six.
 *
 * It renders only when there is something to explain — a non-zero count, and
 * the operator not already filtered to it. Once they are looking at the six, a
 * banner announcing six is noise.
 */
export function BadgeExplainer({ className }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { data: stats } = useAdminStats();

  // The nav entry that owns this path, and the badge it carries.
  const entry = ADMIN_NAV.flatMap((group) => group.children ?? [group]).find(
    (item) => item.badge && item.to === pathname,
  );
  if (!entry) return null;

  const count = badgeCount(stats, entry.badge);
  if (!count) return null;

  // Already filtered to the badged set? Then the number is on screen and this
  // would be repeating it back.
  const filter = entry.badgeFilter ? new URLSearchParams(entry.badgeFilter) : null;
  const alreadyFiltered =
    filter && [...filter].every(([key, value]) => searchParams.get(key) === value);
  if (alreadyFiltered) return null;

  const phrase = entry.badgePhrase
    ? entry.badgePhrase[count === 1 ? 0 : 1]
    : (entry.badgeLabel ?? 'need attention');

  const to = filter ? `${pathname}?${filter}` : pathname;

  return (
    <Link
      to={to}
      className={cn(
        pressableSurface,
        'group mb-4 flex items-center gap-3 rounded-lg border border-warn/30 bg-warn-50 px-4 py-2.5 hover:border-warn/50',
        className,
      )}
    >
      <Bell className="size-4 shrink-0 text-warn" strokeWidth={2.25} aria-hidden="true" />

      <p className="min-w-0 flex-1 text-sm text-ink-700">
        <span className="font-semibold text-ink-900">
          {formatCount(count)} {phrase}
        </span>
        <span className="text-ink-500"> </span>
      </p>

      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-warn">
        Show {count === 1 ? 'it' : 'them'}
        <ArrowRight
          className="size-3.5 transition-transform duration-fast ease-entrance group-hover:translate-x-0.5"
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

/**
 * The counter behind a badge name.
 *
 * Mirrors `AdminShell`'s map by name rather than importing it, because that one
 * is built for the sidebar's props and this needs a single lookup. Both read
 * the same `GET /admin/stats` shape, and a name that resolves to nothing simply
 * renders no banner.
 */
function badgeCount(stats, name) {
  switch (name) {
    case 'pendingUsers':
      return stats?.users?.pending ?? 0;
    case 'overdueInvoices':
      return stats?.receivables?.overdueCount ?? 0;
    case 'lowStock':
      return (stats?.inventory?.lowStock ?? 0) + (stats?.inventory?.outOfStock ?? 0);
    case 'openRmas':
      return stats?.rma?.open ?? 0;
    case 'openTickets':
      return stats?.tickets?.open ?? 0;
    default:
      return 0;
  }
}

export default BadgeExplainer;
