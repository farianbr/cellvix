import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Package } from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import Pagination from '@/components/ui/Pagination';
import useTablePage from '@/hooks/useTablePage';
import { useSupplierOrders } from '@/hooks/useSupplierPortal';
import cn from '@/lib/cn';

/**
 * Every purchase order this supplier was asked to price.
 *
 * **The admin panel's list, in the portal.** `DataTable`, `FilterStrip`,
 * `PageHeader` and `Pagination` are already generic and are reused as-is — a
 * supplier's list of orders is the same kind of screen as a buyer's list of
 * orders, and forking the table to make it "simpler" would mean two tables to
 * keep sorted, paged and responsive.
 *
 * **Nothing here names another supplier.** Every row comes from
 * `purchaseBidService.shapeForSupplier`, which returns this supplier's own bid
 * and nothing else — no rank, no gap to the leader (§6.8a rule 2). That is
 * enforced by the serializer rather than by this screen remembering to omit it.
 */

const BID_TONES = {
  invited: 'warn',
  viewed: 'warn',
  quoted: 'info',
  negotiating: 'brand',
  confirmed: 'ok',
  declined: 'neutral',
  lost: 'neutral',
};

const BID_LABELS = {
  invited: 'needs a price',
  viewed: 'needs a price',
  quoted: 'priced',
  negotiating: 'we have a question',
  confirmed: 'confirmed with you',
  declined: 'you declined',
  lost: 'not chosen',
};

const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'needs-price', label: 'Needs your price' },
  { value: 'quoted', label: 'Waiting on us' },
  { value: 'won', label: 'Confirmed' },
  { value: 'closed', label: 'Decided' },
];

/** Which pill an order belongs under. One bucket each, never two. */
function bucketOf(order) {
  const status = order.myBid.status;
  if (order.state === 'open' && ['invited', 'viewed', 'negotiating'].includes(status)) {
    return 'needs-price';
  }
  if (order.state === 'open' && status === 'quoted') return 'quoted';
  if (order.state === 'won') return 'won';
  return 'closed';
}

export function SupplierOrdersPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pill, setPill] = useState('all');

  const { data, isLoading } = useSupplierOrders();
  const all = data?.orders ?? [];

  const counts = all.reduce(
    (acc, order) => {
      acc[bucketOf(order)] = (acc[bucketOf(order)] ?? 0) + 1;
      return acc;
    },
    { all: all.length },
  );

  const needle = query.trim().toLowerCase();
  const orders = all.filter((order) => {
    if (pill !== 'all' && bucketOf(order) !== pill) return false;
    if (!needle) return true;
    return (
      order.poNumber.toLowerCase().includes(needle) ||
      (order.title ?? '').toLowerCase().includes(needle)
    );
  });

  const { pageRows, page, totalPages, from, setPage } = useTablePage(orders);

  const columns = [
    {
      key: 'poNumber',
      header: 'Order',
      priority: 1,
      sortValue: (order) => order.poNumber,
      render: (order) => (
        <>
          <span className="block whitespace-nowrap font-mono text-sm font-medium text-ink-900">
            {order.poNumber}
          </span>
          {order.title && (
            <span className="block truncate text-xs text-ink-400">{order.title}</span>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Your bid',
      priority: 1,
      sortValue: (order) => order.myBid.status,
      render: (order) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={BID_TONES[order.myBid.status]} size="sm">
            {BID_LABELS[order.myBid.status]}
          </Badge>
          {order.myBid.proforma && (
            <Badge tone="neutral" size="sm" icon={FileText}>
              PI
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Lines',
      priority: 3,
      align: 'right',
      className: 'tnum',
      sortValue: (order) => order.items.length,
      render: (order) => (
        <span className="text-sm text-ink-500">{formatCount(order.items.length)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Your total',
      priority: 1,
      align: 'right',
      className: 'tnum',
      sortValue: (order) => order.myBid.total ?? 0,
      render: (order) =>
        ['quoted', 'negotiating', 'confirmed'].includes(order.myBid.status) ? (
          <span className="text-sm font-semibold text-ink-900">{money(order.myBid.total)}</span>
        ) : (
          <span className="text-ink-300">—</span>
        ),
    },
    {
      key: 'closesAt',
      header: 'Closes',
      priority: 2,
      sortValue: (order) => (order.closesAt ? new Date(order.closesAt).getTime() : 0),
      render: (order) =>
        order.closesAt ? (
          <span className={cn('text-sm', order.closed ? 'text-danger' : 'text-ink-500')}>
            {date(order.closesAt)}
          </span>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Package}
        title="Purchase orders"
        description="Everything you have been asked to price, and what happened to it."
      />

      <Panel flush className="mb-3">
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Order number or title…"
          pills={PILLS.map((p) => ({ ...p, count: counts[p.value] }))}
          activePill={pill}
          onPillChange={setPill}
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={orders.length}
            shown={pageRows.length}
            from={from}
            noun={orders.length === 1 ? 'order' : 'orders'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(order) => order.id}
          onRowClick={(order) => navigate(`/supplier/orders/${order.id}`)}
          loading={isLoading}
          defaultSort={{ key: 'poNumber', direction: 'desc' }}
          empty={
            <PanelEmpty
              icon={Package}
              title="No orders here"
              body="When we ask you to price something, it appears here and you will get an email about it."
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

export default SupplierOrdersPage;
