import { Link, useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import cn from '@/lib/cn';
import { adminBreadcrumbTrail } from '@/lib/adminRoutes';
import { useRecordLabel } from '@/components/admin/shell/recordLabel';
import { pressable } from '@/lib/motion';

/**
 * The admin breadcrumb (§4b). Built from route metadata, never parsed from the
 * URL — parsing is how `purchase-orders` reaches the screen as
 * "Purchase-orders".
 *
 * `recordLabel` renames the last crumb on a detail page, so three open tabs are
 * tellable apart: `⌂ > Sales > Orders > CVX-2026-00042`.
 */
export function Breadcrumbs({ recordLabel, className }) {
  const location = useLocation();
  // A detail page publishes its record name through context, because the shell
  // renders this trail and cannot receive it as a prop from a sibling route.
  const fromContext = useRecordLabel();
  const trail = adminBreadcrumbTrail(location.pathname, { recordLabel: recordLabel ?? fromContext });
  const isHome = location.pathname === '/admin';

  // Mobile shows the last two crumbs only, prefixed with a back chevron to the
  // parent (§4b.9) — the full trail must never wrap to a second line.
  const parent = [...trail].reverse().find((crumb) => crumb.to);

  return (
    <nav
      aria-label="Breadcrumb"
      /* Navigation is chrome: it means nothing on paper, so the printable
         Business Overview (§6.11) drops it with the sidebar and top bar. */
      className={cn(
        'flex h-9 items-center border-b border-line bg-surface px-3 sm:px-4 print:hidden',
        className,
      )}
    >
      {parent && (
        <Link
          to={parent.to}
          className={cn(pressable, 'mr-1 flex items-center text-ink-300 hover:text-ink-900 sm:hidden')}
          aria-label={`Back to ${parent.label}`}
        >
          <ChevronLeft className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </Link>
      )}

      <ol className="flex min-w-0 items-center gap-1 text-xs">
        <li className={cn('flex items-center gap-1', !isHome && 'hidden sm:flex')}>
          {isHome ? (
            <span
              aria-current="page"
              className="flex items-center gap-1 font-medium text-ink-900"
            >
              <Home className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              Home
            </span>
          ) : (
            <Link
              to="/admin"
              className={cn(pressable, 'flex items-center text-ink-300 hover:text-ink-900')}
              aria-label="Home"
            >
              <Home className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            </Link>
          )}
        </li>

        {!isHome &&
          trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;
            // Mobile keeps the last two crumbs (§4b.9); the rest, and the Home
            // icon, fold away rather than wrapping to a second line.
            const onMobile = index >= trail.length - 2;
            // The chevron separates this crumb from the previous one. When
            // nothing before it is visible, it is a leading `›` pointing at
            // nothing.
            const leadingOnMobile = index === trail.length - 2;

            return (
              <li
                key={`${crumb.label}-${index}`}
                className={cn('flex min-w-0 items-center gap-1', !onMobile && 'hidden sm:flex')}
              >
                <ChevronRight
                  className={cn(
                    'size-3 shrink-0 text-ink-200',
                    leadingOnMobile && 'hidden sm:block',
                  )}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                {isLast ? (
                  <span
                    aria-current="page"
                    title={crumb.label}
                    className="max-w-[180px] truncate font-medium text-ink-900 sm:max-w-[260px]"
                  >
                    {crumb.label}
                  </span>
                ) : crumb.to ? (
                  <Link
                    to={crumb.to}
                    title={crumb.label}
                    className={cn(pressable, 'max-w-[160px] truncate text-ink-300 hover:text-ink-900')}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span title={crumb.label} className="max-w-[160px] truncate text-ink-300">
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
