import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Download,
  Hourglass,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_SOURCES,
} from '@shared/schemas/admin';
import cn from '@/lib/cn';
import { count as formatCount, titleize } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SelectMenu from '@/components/ui/SelectMenu';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminTickets, useAdminMutations } from '@/hooks/useAdmin';

/**
 * Repair tickets (Sales § Ticket).
 *
 * **The Age column drives the day**, as it does on RMA: it carries the warning
 * past the SLA and stops counting once a ticket closes, because a row that
 * always shouts is a row an operator learns to ignore.
 *
 * The status control is an inline dropdown on every row rather than a menu
 * item, which is deliberate. A repair moves several times a day and often
 * backwards — the wrong screen arrives, a fix does not hold — so the move an
 * operator makes most often should cost one click, not three. The server takes
 * any status and records each move on the ticket timeline; the timeline is the
 * control here, not a transition table.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/tickets'], icon: adminIcon('ClipboardList') };

/** The pills, in workflow order. `completed`/`cancelled` live under Filters. */
const PILL_STATUSES = [
  'diagnosis',
  'accepted',
  'waiting_for_parts',
  'ready_to_repair',
  'processing',
  'retention_policy',
  'ready_to_pickup',
];

const PILLS = [
  { value: 'all', label: 'All' },
  ...PILL_STATUSES.map((value) => ({ value, label: TICKET_STATUS_LABELS[value] })),
];

const STATUS_TONES = {
  diagnosis: 'info',
  accepted: 'info',
  waiting_for_parts: 'warn',
  ready_to_repair: 'info',
  processing: 'warn',
  retention_policy: 'neutral',
  ready_to_pickup: 'ok',
  completed: 'ok',
  cancelled: 'danger',
};

const PRIORITY_TONES = { low: 'neutral', normal: 'neutral', high: 'warn', urgent: 'danger' };

const STATUS_OPTIONS = TICKET_STATUSES.map((value) => ({
  value,
  label: TICKET_STATUS_LABELS[value],
}));

const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((value) => ({ value, label: titleize(value) }));
const SOURCE_OPTIONS = TICKET_SOURCES.map((value) => ({ value, label: titleize(value) }));


const PER_PAGE_OPTIONS = [10, 25, 50, 100].map((n) => ({ value: String(n), label: `${n} per page` }));

export function AdminTicketsPage() {
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * `?new=1` still opens intake — it now redirects to the form's own route.
   *
   * The `+ Create > Ticket` menu and the customer profile both link here with
   * that flag (and, from a profile, the customer's details as companions). The
   * form moved to `/admin/tickets/new`, so rather than teach every caller a new
   * URL this forwards the whole query string on arrival: one place changed, and
   * an old link somebody bookmarked still lands on the right screen.
   */
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    const params = new URLSearchParams(searchParams);
    params.delete('new');
    const forwarded = params.toString();
    navigate(`/admin/tickets/new${forwarded ? `?${forwarded}` : ''}`, { replace: true });
  }, [searchParams, navigate]);

  const status = searchParams.get('status') ?? 'all';
  const priority = searchParams.get('priority') ?? 'all';
  const technician = searchParams.get('technician') ?? 'all';
  const perPage = searchParams.get('perPage') ?? '25';
  const page = Number(searchParams.get('page') ?? 1);

  const { data, isLoading } = useAdminTickets({
    status,
    q: query || undefined,
    priority: priority === 'all' ? undefined : priority,
    technician: technician === 'all' ? undefined : technician,
    limit: perPage,
    page,
  });

  const { createTicket, updateTicket, setTicketStatus, deleteTicket } = useAdminMutations();

  const tickets = data?.tickets ?? [];
  const counts = data?.counts ?? {};
  const technicians = data?.technicians ?? [];
  const slaDays = data?.slaDays ?? 7;

  /**
   * Every filter lives in the URL so a filtered board can be linked to. Any
   * change but the page itself resets to page 1 — staying on page 4 of a set
   * that now has two pages shows an empty table.
   */
  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    if (key !== 'page') params.delete('page');
    setSearchParams(params, { replace: true });
  }

  const activeFilterCount =
    (priority === 'all' ? 0 : 1) + (technician === 'all' ? 0 : 1) + (perPage === '25' ? 0 : 1);

  const columns = [
    {
      key: 'ticketNumber',
      header: 'Ticket #',
      priority: 1,
      render: (ticket) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-mono text-sm font-medium text-ink-900">
            {ticket.ticketNumber}
          </span>
          {ticket.source === 'kiosk' && (
            <Badge tone="ok" size="sm">
              Kiosk
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      priority: 1,
      className: 'max-w-[170px]',
      sortValue: (ticket) => ticket.customer.name,
      render: (ticket) => (
        <>
          <span className="block truncate text-sm font-medium text-ink-900">
            {ticket.customer.name}
          </span>
          <span className="tnum block text-xs text-ink-400">{ticket.customer.phone}</span>
        </>
      ),
    },
    {
      key: 'device',
      header: 'Device & issue',
      priority: 1,
      className: 'max-w-[220px]',
      sortValue: (ticket) => `${ticket.device.brand ?? ''} ${ticket.device.model ?? ''}`,
      render: (ticket) => (
        <>
          <span className="block truncate text-sm">
            {ticket.device.brand && (
              <span className="font-medium text-ink-900">{ticket.device.brand}</span>
            )}
            {ticket.device.brand && ticket.device.model && (
              <span className="text-ink-300"> · </span>
            )}
            <span className="text-ink-500">{ticket.device.model ?? '—'}</span>
          </span>
          <span className="block truncate text-xs text-ink-500">{ticket.issue}</span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      // The move an operator makes most often, so it costs one click. The
      // server takes any status and records the move (invariant 13: this is a
      // convenience, never the control).
      render: (ticket) => (
        <div onClick={(event) => event.stopPropagation()}>
          <SelectMenu
            srLabel={`Status for ${ticket.ticketNumber}`}
            value={ticket.status}
            options={STATUS_OPTIONS}
            align="left"
            onChange={(next) =>
              next !== ticket.status && setTicketStatus.mutate({ id: ticket.id, status: next })
            }
          />
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      priority: 2,
      render: (ticket) => (
        <Badge tone={PRIORITY_TONES[ticket.priority]} size="sm">
          {titleize(ticket.priority)}
        </Badge>
      ),
    },
    {
      key: 'technician',
      header: 'Technician',
      priority: 2,
      className: 'max-w-[140px] truncate',
      sortValue: (ticket) => ticket.technician?.name ?? '',
      render: (ticket) =>
        ticket.technician?.name ? (
          <span className="text-sm text-ink-700">{ticket.technician.name}</span>
        ) : (
          <span className="text-sm italic text-ink-300">Unassigned</span>
        ),
    },
    {
      key: 'age',
      header: 'Age',
      priority: 1,
      align: 'right',
      className: 'tnum',
      sortValue: (ticket) => ticket.age,
      render: (ticket) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-sm',
            ticket.overSla
              ? 'font-medium text-danger'
              : ticket.closed
                ? 'text-ink-300'
                : 'text-ink-600',
          )}
        >
          {ticket.overSla && (
            <AlertTriangle className="size-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          )}
          {ticket.age}d
        </span>
      ),
    },
  ];

  const rowMenu = [
    {
      key: 'edit',
      label: 'Edit ticket',
      icon: Pencil,
      onSelect: (ticket) => navigate(`/admin/tickets/${ticket.id}/edit`),
    },
    {
      key: 'pdf',
      label: 'Download PDF',
      icon: Download,
      onSelect: (ticket) =>
        window.alert(
          `A printable job sheet for ${ticket.ticketNumber} arrives with the ticket detail screen.`,
        ),
    },
    {
      key: 'delete',
      label: 'Delete ticket',
      icon: Trash2,
      tone: 'danger',
      onSelect: (ticket) => setDeleting(ticket),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <Button onClick={() => navigate('/admin/tickets/new')} icon={Plus}>
            New ticket
          </Button>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'open',
            label: 'Open repairs',
            value: formatCount(counts.open ?? 0),
            hint: 'Still on the bench',
            tone: (counts.open ?? 0) > 0 ? 'warn' : 'ok',
            icon: Wrench,
          },
          {
            key: 'overdue',
            label: `Past ${slaDays} days`,
            value: formatCount(counts.overdue ?? 0),
            hint: 'Open longer than the SLA allows',
            tone: (counts.overdue ?? 0) > 0 ? 'danger' : 'ok',
            icon: Hourglass,
          },
          {
            key: 'pickup',
            label: 'Ready to pickup',
            value: formatCount(counts.ready_to_pickup ?? 0),
            hint: 'Fixed, waiting to be collected',
            tone: 'info',
            icon: ClipboardList,
          },
          {
            key: 'parts',
            label: 'Waiting for parts',
            value: formatCount(counts.waiting_for_parts ?? 0),
            hint: 'Blocked on stock',
            tone: (counts.waiting_for_parts ?? 0) > 0 ? 'warn' : 'neutral',
            icon: AlertTriangle,
          },
        ]}
      />

      <Panel flush>
        <FilterStrip
          search={query}
          onSearchChange={(next) => {
            setQuery(next);
            setParam('page', '');
          }}
          searchPlaceholder="Ticket #, customer, device…"
          stackPills
          pills={PILLS.map((pill) => ({ ...pill, count: counts[pill.value] }))}
          activePill={status}
          onPillChange={(next) => setParam('status', next)}
          activeFilterCount={activeFilterCount}
          onClearFilters={() => {
            const params = new URLSearchParams(searchParams);
            ['priority', 'technician', 'perPage', 'page'].forEach((key) => params.delete(key));
            setSearchParams(params, { replace: true });
          }}
          filters={
            <div className="space-y-3">
              <div>
                <p className="eyebrow mb-1.5 text-ink-400">Priority</p>
                <SelectMenu
                  srLabel="Filter by priority"
                  value={priority}
                  onChange={(next) => setParam('priority', next)}
                  options={[{ value: 'all', label: 'Any priority' }, ...PRIORITY_OPTIONS]}
                  align="left"
                  className="w-full"
                />
              </div>

              <div>
                <p className="eyebrow mb-1.5 text-ink-400">Technician</p>
                <SelectMenu
                  srLabel="Filter by technician"
                  value={technician}
                  onChange={(next) => setParam('technician', next)}
                  options={[
                    { value: 'all', label: 'Anyone' },
                    { value: 'unassigned', label: 'Unassigned' },
                    ...technicians.map((person) => ({ value: person.id, label: person.name })),
                  ]}
                  align="left"
                  className="w-full"
                />
              </div>

              <div>
                <p className="eyebrow mb-1.5 text-ink-400">Rows</p>
                <SelectMenu
                  srLabel="Rows per page"
                  value={perPage}
                  onChange={(next) => setParam('perPage', next)}
                  options={PER_PAGE_OPTIONS}
                  align="left"
                  className="w-full"
                />
              </div>
            </div>
          }
          onExport={(format) =>
            window.alert(
              `Export to ${format} arrives in phase 12. It will carry the current filters: ` +
                `status "${status}"${query ? `, search "${query}"` : ''}.`,
            )
          }
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={data?.total ?? tickets.length}
            shown={tickets.length}
            noun={(data?.total ?? tickets.length) === 1 ? 'ticket' : 'tickets'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={tickets}
          rowKey={(ticket) => ticket.id}
          rowMenu={rowMenu}
          onRowClick={(ticket) => navigate(`/admin/tickets/${ticket.id}/edit`)}
          loading={isLoading}
          empty={
            <PanelEmpty
              icon={ClipboardList}
              title="No tickets match"
              body="Try a different filter, or open one at the counter."
            />
          }
        />

        {(data?.totalPages ?? 1) > 1 && (
          <div className="border-t border-line p-3">
            <Pagination
              page={data.page}
              pages={data.totalPages}
              onChange={(next) => setParam('page', String(next))}
            />
          </div>
        )}
      </Panel>


      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          deleteTicket.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        title={`Delete ${deleting?.ticketNumber ?? 'ticket'}?`}
        body="This removes the repair history for the device. It cannot be undone."
        confirmLabel="Delete ticket"
        loading={deleteTicket.isPending}
        error={deleteTicket.error?.message}
      />
    </>
  );
}

export default AdminTicketsPage;
