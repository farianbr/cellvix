import { useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

import cn from '@/lib/cn';
import Panel from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminAppointments } from '@/hooks/useAdmin';
import { pressable } from '@/lib/motion';

/**
 * The scheduling board (§6.15 category 4 — **UI only, §6b U1**, phase 11e).
 *
 * Ships as interface: the weekly board, staff filter, status legend,
 * unscheduled tray and week navigation, reading from `Appointment`, which is
 * real and ships empty (§6b rule 3). **Nothing on this screen writes**, and the
 * notice says so rather than a disabled button implying it.
 *
 * **What Cellvix schedules is a reading, not a settled fact** (§12 Q1). A
 * wholesaler has no repair calendar, but it has pickups, deliveries and RMA
 * drop-offs, and the same board serves them. That is what the status legend and
 * the tray are built around — worth re-confirming before this is wired, because
 * changing it changes the model.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/settings/calendar'], icon: adminIcon('CalendarDays') };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday of the week containing `date`. */
function startOfWeek(date) {
  const out = new Date(date);
  const day = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

const STATUS_TONE = {
  unscheduled: 'neutral',
  scheduled: 'info',
  in_progress: 'warn',
  done: 'ok',
  cancelled: 'danger',
};

export function AdminCalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [staffFilter, setStaffFilter] = useState('all');

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return end;
  }, [weekStart]);

  const { data } = useAdminAppointments({
    from: weekStart.toISOString(),
    to: weekEnd.toISOString(),
  });

  const days = useMemo(
    () =>
      DAYS.map((label, index) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + index);
        return { label, date };
      }),
    [weekStart],
  );

  const appointments = (data?.appointments ?? []).filter(
    (row) => staffFilter === 'all' || row.staff === staffFilter,
  );

  const today = new Date().toDateString();

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      {/* §6b rule 2: a persistent notice naming what is inactive and what
          unblocks it — not a tooltip, not a disabled button's title. */}
      <p className="mb-5 flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
        <span>
          <strong className="font-semibold">This board is not wired up yet.</strong> It reads real
          appointments and there are none — nothing on this screen creates, moves or cancels
          anything. It is built around pickups, deliveries and RMA drop-offs; that reading is
          confirmed as the intent, and the scheduling itself lands in a later phase.
        </span>
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const previous = new Date(weekStart);
              previous.setDate(previous.getDate() - 7);
              setWeekStart(previous);
            }}
            aria-label="Previous week"
            className={cn(pressable, 'flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-600 hover:border-ink-300 hover:bg-surface-2')}
          >
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>

          <span className="font-display text-md font-semibold text-ink-900">
            {weekStart.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })} —{' '}
            {days[6].date.toLocaleDateString('en-CA', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>

          <button
            type="button"
            onClick={() => {
              const next = new Date(weekStart);
              next.setDate(next.getDate() + 7);
              setWeekStart(next);
            }}
            aria-label="Next week"
            className={cn(pressable, 'flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-600 hover:border-ink-300 hover:bg-surface-2')}
          >
            <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className={cn(pressable, 'ml-1 inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink-600 hover:border-ink-300 hover:bg-surface-2')}
          >
            This week
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-600">
          <span className="shrink-0">Staff</span>
          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            className="h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-900 focus:border-ink-400 focus:ring-2 focus:ring-ink-900/15 focus:outline-none"
          >
            <option value="all">Everyone</option>
            {(data?.staff ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        {/* The board scrolls inside itself rather than pushing the page sideways
            — seven columns cannot fit a phone, and the page must not scroll. */}
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="grid min-w-[760px] grid-cols-7 gap-2">
            {days.map(({ label, date }) => {
              const isToday = date.toDateString() === today;
              const forDay = appointments.filter(
                (row) => row.startAt && new Date(row.startAt).toDateString() === date.toDateString(),
              );

              return (
                <div
                  key={label}
                  className={cn(
                    'min-h-[280px] rounded-lg border bg-surface p-2.5',
                    isToday ? 'border-brand' : 'border-line',
                  )}
                >
                  <p
                    className={cn(
                      'mb-2 font-display text-xs font-bold tracking-wide uppercase',
                      isToday ? 'text-brand' : 'text-ink-500',
                    )}
                  >
                    {label}{' '}
                    <span className="tnum font-medium text-ink-400">{date.getDate()}</span>
                  </p>

                  {forDay.length === 0 ? (
                    <p className="text-xs text-ink-300">—</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {forDay.map((row) => (
                        <li
                          key={row.id}
                          className="rounded-md bg-surface-2 px-2 py-1.5 text-xs text-ink-700"
                        >
                          {row.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="Unscheduled" description="Waiting for a slot.">
            {(data?.unscheduled ?? []).length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <Inbox className="size-4 text-ink-300" strokeWidth={2} aria-hidden="true" />
                Nothing waiting.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.unscheduled.map((row) => (
                  <li key={row.id} className="rounded-md bg-surface-2 px-3 py-2 text-sm">
                    {row.title}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Statuses">
            <ul className="flex flex-wrap gap-1.5">
              {(data?.statuses ?? []).map((status) => (
                <li key={status.value}>
                  <Badge tone={STATUS_TONE[status.value] ?? 'neutral'}>{status.label}</Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="What this board will hold">
            <ul className="space-y-1.5 text-sm text-ink-600">
              {(data?.kinds ?? []).map((kind) => (
                <li key={kind.value} className="flex items-center gap-2">
                  <CalendarDays className="size-3.5 text-ink-300" strokeWidth={2.25} aria-hidden="true" />
                  {kind.label}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

export default AdminCalendarPage;
