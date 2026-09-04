import { Link, useLocation } from 'react-router';
import { Hammer } from 'lucide-react';
import PageHeader from '@/components/admin/PageHeader';
import { matchAdminRoute } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';

/**
 * Placeholder for a screen whose phase has not landed yet.
 *
 * The nav tree is complete from phase 1 so the panel is walkable end to end,
 * which means most routes point here for now. It states the phase plainly and
 * offers no controls — an unbuilt screen must never look half-working (§6b,
 * rule 4: nothing fakes success).
 *
 * Replacing one is a two-line change: build the real page, point the route at
 * it, and bump `phase` in `lib/adminRoutes.js`.
 */
const PHASE_NAMES = {
  2: 'Component kit',
  3: 'Dashboard',
  4: 'Sales depth',
  5: 'Purchase',
  6: 'Reports',
  7: 'Quotes & RMA',
  8: 'Outlet, staff & roles',
  9: 'Marketing',
  10: 'Referrals',
  11: 'Settings',
  12: 'Cross-cutting',
  13: 'Wiring the UI-only shells',
};

export function AdminStubPage() {
  const location = useLocation();
  const meta = matchAdminRoute(location.pathname);
  const Icon = adminIcon(meta?.icon);
  const phase = meta?.phase;

  return (
    <>
      <PageHeader icon={Icon} title={meta?.title ?? 'Not built yet'} description={meta?.description} />

      <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-300">
          <Hammer className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>

        <h2 className="text-lg">Not built yet</h2>
        <p className="mt-2 max-w-[46ch] text-md leading-relaxed text-ink-500">
          {phase ? (
            <>
              This screen ships in <strong className="font-semibold text-ink-700">phase {phase}</strong>
              {PHASE_NAMES[phase] ? ` — ${PHASE_NAMES[phase]}` : ''}. The navigation is complete ahead
              of the screens so the panel can be walked end to end.
            </>
          ) : (
            'The navigation is complete ahead of the screens so the panel can be walked end to end.'
          )}
        </p>

        <Link
          to="/admin"
          className={cn(pressable, 'mt-6 inline-flex h-9 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 font-display text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2')}
        >
          Back to dashboard
        </Link>
      </div>
    </>
  );
}

export default AdminStubPage;
