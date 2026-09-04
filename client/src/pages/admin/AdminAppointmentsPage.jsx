import { useState } from 'react';
import { AlertCircle, CalendarClock } from 'lucide-react';

import cn from '@/lib/cn';
import Panel from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminAppointments } from '@/hooks/useAdmin';

/**
 * The booking grid (§6.15 category 4 — **UI only, §6b U2**, phase 11e).
 *
 * A time grid for one day, reading from `Appointment`, which ships empty.
 *
 * **`Book Appointment` is disabled rather than wired**, and there is no write
 * route behind it (§6b rule 4: nothing fakes success). A button that opened a
 * dialog and saved would be storing bookings against slot rules and conflict
 * checks nobody has specified — the shape of which is exactly what is still
 * open. So the control is present, visibly inert, and the notice says why.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/settings/appointments'], icon: adminIcon('CalendarClock') };

/** 8am to 6pm, the hours a warehouse counter is open. */
const HOURS = Array.from({ length: 11 }, (_, index) => 8 + index);

const formatHour = (hour) => {
  const suffix = hour < 12 ? 'a.m.' : 'p.m.';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
};

export function AdminAppointmentsPage() {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));

  const dayStart = new Date(`${day}T00:00:00`);
  const dayEnd = new Date(`${day}T23:59:59`);

  const { data } = useAdminAppointments({
    from: dayStart.toISOString(),
    to: dayEnd.toISOString(),
  });

  const booked = data?.appointments ?? [];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <button
            type="button"
            disabled
            className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3.5 text-sm font-medium text-ink-400"
          >
            <CalendarClock className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Book appointment
          </button>
        }
      />

      <p className="mb-5 flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
        <span>
          <strong className="font-semibold">Booking is not wired up yet.</strong> The grid reads real
          appointments and there are none. <em>Book appointment</em> is deliberately inert rather
          than opening a dialog that would save against slot rules and conflict checks that have not
          been decided — building those on a guess is what this is waiting to avoid.
        </span>
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-600">
          <span className="shrink-0">Day</span>
          <input
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className="h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-900 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
        </label>

        <Badge tone="neutral">
          {booked.length} {booked.length === 1 ? 'booking' : 'bookings'}
        </Badge>
      </div>

      <Panel flush className="max-w-[760px]">
        <ul className="divide-y divide-line">
          {HOURS.map((hour) => {
            const inSlot = booked.filter((row) => {
              if (!row.startAt) return false;
              return new Date(row.startAt).getHours() === hour;
            });

            return (
              <li key={hour} className="flex gap-3 px-4 py-3 sm:px-5">
                <span className="tnum w-20 shrink-0 pt-0.5 text-sm text-ink-500">
                  {formatHour(hour)}
                </span>

                <div className="min-w-0 flex-1">
                  {inSlot.length === 0 ? (
                    <span
                      className={cn(
                        'block rounded-md border border-dashed border-line px-3 py-2 text-sm text-ink-300',
                      )}
                    >
                      Free
                    </span>
                  ) : (
                    <ul className="space-y-1.5">
                      {inSlot.map((row) => (
                        <li
                          key={row.id}
                          className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-700"
                        >
                          {row.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

export default AdminAppointmentsPage;
