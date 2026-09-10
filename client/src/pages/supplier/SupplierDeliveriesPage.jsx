import { useNavigate } from 'react-router';
import { Truck } from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { useSupplierOrders } from '@/hooks/useSupplierPortal';

/**
 * The orders confirmed with this supplier, and where each one has got to.
 *
 * **Only confirmed orders.** A delivery is something the supplier the order was
 * placed with owes us; a losing bidder has nothing to deliver, and listing
 * their orders here would invite them to report on goods nobody asked them for.
 * `state === 'won'` is the filter, and the server refuses the write anyway
 * (`setDeliveryStatus` checks `confirmedBid`).
 *
 * **Reporting a delivery never moves stock.** Receiving is a physical count
 * made at our end; "delivered" from a supplier is a claim, not a receipt. This
 * screen updates a status and notifies the purchasing desk, and the stock
 * ledger stays behind the admin's own receiving screen.
 */

const DELIVERY_TONES = {
  pending: 'warn',
  preparing: 'info',
  dispatched: 'info',
  in_transit: 'info',
  delivered: 'ok',
};

const DELIVERY_LABELS = {
  pending: 'not dispatched',
  preparing: 'preparing',
  dispatched: 'dispatched',
  in_transit: 'in transit',
  delivered: 'delivered',
};

export function SupplierDeliveriesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useSupplierOrders();

  const rows = (data?.orders ?? [])
    .filter((order) => order.state === 'won')
    .map((order) => ({
      id: order.id,
      poNumber: order.poNumber,
      title: order.title,
      lines: order.items.length,
      total: order.myBid.total,
      leadTimeDays: order.myBid.leadTimeDays,
      delivery: order.myBid.delivery ?? { status: 'pending' },
    }));

  const outstanding = rows.filter((row) => row.delivery.status !== 'delivered').length;

  const columns = [
    {
      key: 'poNumber',
      header: 'Order',
      priority: 1,
      sortValue: (row) => row.poNumber,
      render: (row) => (
        <>
          <span className="block whitespace-nowrap font-mono text-sm font-medium text-ink-900">
            {row.poNumber}
          </span>
          {row.title && <span className="block truncate text-xs text-ink-400">{row.title}</span>}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Delivery',
      priority: 1,
      sortValue: (row) => row.delivery.status,
      render: (row) => (
        <Badge tone={DELIVERY_TONES[row.delivery.status] ?? 'neutral'} size="sm">
          {DELIVERY_LABELS[row.delivery.status] ?? row.delivery.status}
        </Badge>
      ),
    },
    {
      key: 'carrier',
      header: 'Carrier',
      priority: 2,
      sortValue: (row) => row.delivery.carrier ?? '',
      render: (row) =>
        row.delivery.carrier || row.delivery.trackingNumber ? (
          <>
            <span className="block text-sm text-ink-700">{row.delivery.carrier || '—'}</span>
            {row.delivery.trackingNumber && (
              <span className="block truncate font-mono text-2xs text-ink-400">
                {row.delivery.trackingNumber}
              </span>
            )}
          </>
        ) : (
          <span className="text-ink-300">—</span>
        ),
    },
    {
      key: 'expectedAt',
      header: 'Expected',
      priority: 2,
      sortValue: (row) => (row.delivery.expectedAt ? new Date(row.delivery.expectedAt).getTime() : 0),
      render: (row) =>
        row.delivery.expectedAt ? (
          <span className="text-sm text-ink-500">{date(row.delivery.expectedAt)}</span>
        ) : row.leadTimeDays != null ? (
          <span className="text-sm text-ink-400">{row.leadTimeDays}d lead time</span>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'lines',
      header: 'Lines',
      priority: 3,
      align: 'right',
      className: 'tnum',
      sortValue: (row) => row.lines,
      render: (row) => <span className="text-sm text-ink-500">{formatCount(row.lines)}</span>,
    },
    {
      key: 'total',
      header: 'Value',
      priority: 1,
      align: 'right',
      className: 'tnum',
      sortValue: (row) => row.total ?? 0,
      render: (row) => (
        <span className="text-sm font-semibold text-ink-900">{money(row.total)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Truck}
        title="Deliveries"
        description={
          outstanding
            ? `${formatCount(outstanding)} order${outstanding === 1 ? '' : 's'} still to reach us.`
            : 'Everything confirmed with you has been delivered.'
        }
      />

      <Panel flush>
        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine total={rows.length} noun={rows.length === 1 ? 'order' : 'orders'} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/supplier/orders/${row.id}`)}
          loading={isLoading}
          defaultSort={{ key: 'status', direction: 'asc' }}
          empty={
            <PanelEmpty
              icon={Truck}
              title="Nothing to deliver"
              body="Orders confirmed with you appear here, and this is where you tell us where they have got to."
            />
          }
        />
      </Panel>
    </>
  );
}

export default SupplierDeliveriesPage;
