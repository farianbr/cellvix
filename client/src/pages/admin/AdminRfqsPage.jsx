import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Award, ClipboardList, Eye, Plus, Send, Truck, XCircle } from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import Pagination from '@/components/ui/Pagination';
import useTablePage from '@/hooks/useTablePage';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { pressable } from '@/lib/motion';
import { toast } from '@/store/toastStore';
import cn from '@/lib/cn';
import { useAdminRfqs, useAdminMutations } from '@/hooks/useAdmin';

/**
 * Requests for quote — the step before a purchase order (§6.8a).
 *
 * A PO names one supplier and a price already agreed. The question asked before
 * that one — who will supply this, and for how much — was being answered in
 * inboxes, and this is the screen that answers it: pick component types, ask
 * every supplier tagged with them, compare the replies side by side, award one.
 *
 * The **Quotes** column is what makes the list worth scanning: "2 of 5" is the
 * only number that tells a purchasing clerk whether a request is ready to
 * decide or still waiting on somebody.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/rfqs'], icon: adminIcon('Send') };

const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Out for quote' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  awarded: 'ok',
  cancelled: 'danger',
};

const STATUS_LABELS = {
  draft: 'draft',
  sent: 'out for quote',
  awarded: 'awarded',
  cancelled: 'cancelled',
};

export function AdminRfqsPage() {
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const status = searchParams.get('status') ?? 'all';

  const { data, isLoading } = useAdminRfqs({ status, q: query || undefined });
  const { sendRfq, cancelRfq } = useAdminMutations();

  const rfqs = data?.rfqs ?? [];
  const counts = data?.counts ?? {};

  const { pageRows, page, totalPages, from, setPage } = useTablePage(rfqs);

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  }

  /**
   * Send, and report who was actually reached.
   *
   * The server mails each supplier independently so one bad address cannot stop
   * the rest, and it answers with both lists. Reporting a flat "sent" would
   * leave a clerk waiting on an answer from somebody who never got the message.
   */
  function send(row) {
    sendRfq.mutate(
      { id: row.id },
      {
        onSuccess: (result) => {
          if (result.failed.length) {
            toast.error(
              `${result.failed.length} supplier(s) were not reached`,
              `${result.failed.map((entry) => entry.supplier).join(', ')} — check their email address. The others have it.`,
            );
          } else {
            toast.ok(
              `${row.rfqNumber} is out for quote`,
              `${result.sent.length} supplier(s) have been asked.`,
            );
          }
        },
        onError: (error) => toast.error('Nothing was sent', error.message),
      },
    );
  }

  const columns = [
    {
      key: 'rfqNumber',
      header: 'Request',
      priority: 1,
      render: (rfq) => (
        <>
          <span className="block whitespace-nowrap font-mono text-sm font-medium text-ink-900">
            {rfq.rfqNumber}
          </span>
          {rfq.title && <span className="block truncate text-2xs text-ink-400">{rfq.title}</span>}
        </>
      ),
    },
    {
      key: 'componentTypes',
      header: 'Component types',
      priority: 3,
      className: 'max-w-[200px] truncate',
      sortValue: (rfq) => rfq.componentTypes.join(', '),
      render: (rfq) =>
        rfq.componentTypes.length ? (
          <span className="text-sm text-ink-500">{rfq.componentTypes.join(', ')}</span>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'itemCount',
      header: 'Lines',
      priority: 3,
      align: 'right',
      className: 'tnum',
      render: (rfq) => <span className="text-sm text-ink-900">{formatCount(rfq.itemCount)}</span>,
    },
    {
      /**
       * How many of the suppliers asked have answered.
       *
       * The one figure that says whether this request can be decided yet. A
       * draft shows a dash rather than "0 of 3" — nobody has been asked, so
       * zero replies is not a fact about anybody's responsiveness.
       */
      key: 'quotes',
      header: 'Quotes',
      priority: 1,
      align: 'right',
      className: 'tnum',
      sortValue: (rfq) => rfq.quoteCount,
      render: (rfq) =>
        rfq.status === 'draft' ? (
          <span className="text-xs text-ink-300">—</span>
        ) : (
          <>
            <span className="text-sm font-medium text-ink-900">
              {rfq.quoteCount} of {rfq.inviteCount}
            </span>
            <span className="block text-2xs text-ink-400">answered</span>
          </>
        ),
    },
    {
      key: 'best',
      header: 'Best quote',
      priority: 2,
      align: 'right',
      className: 'tnum',
      sortValue: (rfq) => rfq.invites.find((invite) => invite.isBest)?.total ?? 0,
      render: (rfq) => {
        const best = rfq.invites.find((invite) => invite.isBest);
        if (!best) return <span className="text-xs text-ink-300">—</span>;
        return (
          <>
            <span className="text-sm font-medium text-ink-900">{money(best.total)}</span>
            <span className="block max-w-35 truncate text-2xs text-ink-400">
              {best.supplier.name}
            </span>
          </>
        );
      },
    },
    {
      key: 'closesAt',
      header: 'Closes',
      priority: 3,
      render: (rfq) =>
        rfq.closesAt ? (
          <span className={cn('text-sm', rfq.closed ? 'font-medium text-danger' : 'text-ink-500')}>
            {date(rfq.closesAt)}
          </span>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      render: (rfq) => (
        <Badge tone={STATUS_TONES[rfq.status]} size="sm">
          {STATUS_LABELS[rfq.status]}
        </Badge>
      ),
    },
  ];

  const rowMenu = [
    {
      key: 'view',
      label: 'Open request',
      icon: Eye,
      onSelect: (rfq) => navigate(`/admin/rfqs/${rfq.id}`),
    },
    {
      key: 'send',
      label: 'Send to suppliers',
      icon: Send,
      // The server refuses anything else regardless — this is a courtesy, not
      // the control (invariant 13).
      disabled: (rfq) => rfq.status !== 'draft' || !rfq.inviteCount,
      onSelect: send,
    },
    {
      key: 'award',
      label: 'Compare and award',
      icon: Award,
      disabled: (rfq) => rfq.status !== 'sent' || !rfq.quoteCount,
      onSelect: (rfq) => navigate(`/admin/rfqs/${rfq.id}`),
    },
    {
      key: 'cancel',
      label: 'Cancel request',
      icon: XCircle,
      tone: 'danger',
      hidden: (rfq) => ['awarded', 'cancelled'].includes(rfq.status),
      onSelect: (rfq) =>
        cancelRfq.mutate(
          { id: rfq.id },
          {
            onSuccess: () => toast.ok(`${rfq.rfqNumber} cancelled`),
            onError: (error) => toast.error('It was not cancelled', error.message),
          },
        ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <>
            <Link
              to="/admin/suppliers"
              className={cn(
                pressable,
                'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2',
              )}
            >
              <Truck className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Suppliers
            </Link>
            <Link
              to="/admin/rfqs/create"
              className={cn(
                pressable,
                'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md bg-brand-gradient px-5 font-display text-md font-semibold text-white',
              )}
            >
              <Plus className="size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              New request
            </Link>
          </>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'draft',
            label: 'Draft',
            value: formatCount(counts.draft ?? 0),
            hint: 'Not yet sent to anybody',
            tone: 'neutral',
            icon: ClipboardList,
          },
          {
            key: 'sent',
            label: 'Out for quote',
            value: formatCount(counts.sent ?? 0),
            hint: 'Waiting on supplier prices',
            tone: 'info',
            icon: Send,
          },
          {
            key: 'awarded',
            label: 'Awarded',
            value: formatCount(counts.awarded ?? 0),
            hint: 'Turned into a purchase order',
            tone: 'ok',
            icon: Award,
          },
          {
            /**
             * Requests with every supplier in, ready to decide.
             *
             * Counted from the loaded set rather than the server's status
             * tallies, because "ready" is not a status — it is a reading of how
             * many invites have answered, and it is the tile that tells a clerk
             * where their attention is owed today.
             */
            key: 'ready',
            label: 'Ready to award',
            value: formatCount(
              rfqs.filter((rfq) => rfq.status === 'sent' && rfq.quoteCount >= rfq.inviteCount)
                .length,
            ),
            hint: 'Every supplier asked has replied',
            tone: 'brand',
            icon: Award,
          },
        ]}
      />

      <Panel flush className="mb-3">
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Request number or title…"
          pills={PILLS.map((pill) => ({ ...pill, count: counts[pill.value] }))}
          activePill={status}
          onPillChange={(next) => setParam('status', next)}
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={rfqs.length}
            shown={pageRows.length}
            from={from}
            noun={rfqs.length === 1 ? 'request' : 'requests'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(rfq) => rfq.id}
          rowMenu={rowMenu}
          onRowClick={(rfq) => navigate(`/admin/rfqs/${rfq.id}`)}
          loading={isLoading}
          defaultSort={{ key: 'rfqNumber', direction: 'desc' }}
          empty={
            <PanelEmpty
              icon={Send}
              title="No requests for quote yet"
              body="Pick the component types you are buying and we will show you every supplier tagged with them."
              action={
                <Link
                  to="/admin/rfqs/create"
                  className={cn(
                    pressable,
                    'mt-4 inline-flex h-11 select-none items-center justify-center gap-2 rounded-md bg-brand-gradient px-5 font-display text-md font-semibold text-white',
                  )}
                >
                  <Plus className="size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                  New request
                </Link>
              }
            />
          }
        />

        <Pagination
          page={page}
          pages={totalPages}
          onChange={setPage}
          hideWhenSingle
          className="border-t border-line px-3 py-3 sm:px-4"
        />
      </Panel>
    </>
  );
}

export default AdminRfqsPage;
