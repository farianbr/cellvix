import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Package, PackageCheck, Truck, Undo2, Wallet } from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, count as formatCount } from '@/lib/format';
import { ORDER_STATUS_FLOW, CARRIERS } from '@shared/schemas/admin';
import { ORDER_STATUSES } from '@/lib/constants';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminOrders, useAdminMutations } from '@/hooks/useAdmin';

/** Segmented pills, not a select — the counts are the point (§4, convention 8). */
const PILLS = [
  { value: 'all', label: 'All' },
  ...ORDER_STATUSES.map((status) => ({ value: status.value, label: status.label })),
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Status advancement.
 *
 * Only forward transitions are offered, because that is all the server accepts —
 * the timeline is what the buyer's tracking page renders, and rewriting it would
 * mean rewriting what the customer was already told.
 */
function StatusForm({ order, onSubmit, onCancel, isPending, error }) {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus = ORDER_STATUS_FLOW[currentIndex + 1] ?? order.status;

  const { register, handleSubmit, watch, control } = useForm({
    defaultValues: {
      status: nextStatus,
      note: '',
      carrier: order.tracking?.carrier ?? '',
      number: order.tracking?.number ?? '',
    },
  });

  const status = watch('status');
  // Shipping is exactly when the buyer expects a tracking number to appear.
  const needsTracking = status === 'shipped' && !order.tracking?.number;

  const options = [
    ...ORDER_STATUS_FLOW.slice(currentIndex).map((value) => ({
      value,
      label: ORDER_STATUSES.find((s) => s.value === value)?.label ?? value,
    })),
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          status: values.status,
          note: values.note || undefined,
          tracking:
            values.carrier || values.number
              ? {
                  carrier: values.carrier,
                  number: values.number,
                  url: CARRIERS.find((c) => c.value === values.carrier)?.url,
                }
              : undefined,
        }),
      )}
      className="space-y-4"
    >
      <div className="rounded-[11px] bg-surface-2 p-3.5">
        <p className="font-mono text-[13.5px] font-medium text-ink-900">{order.orderNumber}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-500">
          {order.businessName} · {money(order.total)}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-400">
          Currently {ORDER_STATUSES.find((s) => s.value === order.status)?.label ?? order.status}
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <SelectField control={control} name="status" label="Move to" options={options} />

      <fieldset
        className={cn(
          'rounded-[11px] border p-3.5 transition-colors',
          needsTracking ? 'border-warn/40 bg-warn-50/40' : 'border-line',
        )}
      >
        <legend className="eyebrow px-1 text-ink-400">
          Tracking {needsTracking && <span className="text-warn">· required to ship</span>}
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            control={control}
            name="carrier"
            label="Carrier"
            options={[{ value: '', label: 'Select a carrier…' }, ...CARRIERS]}
          />
          <Input label="Tracking number" placeholder="CVX9107311" {...register('number')} />
        </div>
      </fieldset>

      <Input
        label="Note"
        placeholder="Leave blank for the default message"
        hint="Shown to the buyer in their status history."
        {...register('note')}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Update order
        </Button>
      </div>
    </form>
  );
}

/**
 * Refund to store credit.
 *
 * There is no gateway to send money back through (payments are mocked, and a
 * real one would still need a card reference we do not keep), and a trade
 * account's next order is usually days away — so a refund credits the account
 * and the credit spends itself at checkout. Partial refunds are allowed up to
 * what is left unrefunded; the server is the one that enforces that.
 */
function RefundForm({ order, onSubmit, onCancel, isPending, error }) {
  const refundable = order.total - (order.refundedTotal ?? 0);
  const { register, handleSubmit } = useForm({
    defaultValues: { amountDollars: (refundable / 100).toFixed(2), note: '' },
  });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({ amountDollars: Number(values.amountDollars), note: values.note }),
      )}
      className="space-y-4"
    >
      <div className="rounded-[11px] bg-surface-2 p-3.5">
        <p className="font-mono text-[12.5px] font-medium text-ink-900">{order.orderNumber}</p>
        <p className="tnum mt-1 text-[12.5px] text-ink-500">
          Order total {money(order.total)}
          {order.refundedTotal > 0 && ` · ${money(order.refundedTotal)} already refunded`} ·{' '}
          <span className="font-medium text-ink-900">{money(refundable)} refundable</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Input label="Amount" inputMode="decimal" suffix="CAD" {...register('amountDollars')} />
        <Input label="Reason" placeholder="Screen arrived cracked" {...register('note')} />
      </div>

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-500">
        The amount is credited to this customer's store credit and shows on their statement
        immediately. It comes off their next order automatically.
      </p>

      {error && (
        <p className="flex items-start gap-2 text-[12.5px] text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={refundable <= 0}>
          Refund to store credit
        </Button>
      </div>
    </form>
  );
}

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/orders'], icon: adminIcon('Package') };

export function AdminOrdersPage() {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState([]);

  const [bulkResult, setBulkResult] = useState(null);

  const { data, isLoading } = useAdminOrders({ status, q: query || undefined });
  const { updateOrderStatus, refundOrder, bulkOrderStatus } = useAdminMutations();
  const [refunding, setRefunding] = useState(null);

  /**
   * The server decides which of the selected orders can actually make the move
   * — the client neither pre-filters the selection nor guesses the outcome.
   * Whatever it reports back is what the operator is shown.
   */
  function setBulkStatus(next) {
    bulkOrderStatus.mutate(
      { orderNumbers: selected, status: next },
      {
        onSuccess: (result) => {
          setBulkResult(result);
          setSelected([]);
        },
      },
    );
  }

  const orders = data?.orders ?? [];
  const counts = data?.counts ?? {};

  const awaiting = (counts.placed ?? 0) + (counts.processing ?? 0);
  const shipped = (counts.shipped ?? 0) + (counts.out_for_delivery ?? 0);
  const rangeValue = orders.reduce((sum, order) => sum + order.total, 0);

  const columns = [
    {
      key: 'orderNumber',
      header: 'Order',
      priority: 1,
      render: (order) => (
        <>
          <span className="block whitespace-nowrap font-mono text-[12.5px] font-medium text-ink-900">
            {order.orderNumber}
          </span>
          {order.poNumber && (
            <span className="block text-[11px] text-ink-400">PO {order.poNumber}</span>
          )}
        </>
      ),
    },
    {
      key: 'businessName',
      header: 'Business',
      // Folds away below 768: the order number, total and status are what an
      // operator scans a phone for, and all three fit only without this.
      priority: 2,
      className: 'max-w-[180px] truncate',
    },
    {
      key: 'createdAt',
      header: 'Placed',
      priority: 2,
      render: (order) => <span className="text-[12.5px] text-ink-500">{date(order.createdAt)}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      priority: 3,
      align: 'right',
      className: 'tnum',
      sortValue: (order) => order.items.length,
      render: (order) => order.items.length,
    },
    {
      key: 'total',
      header: 'Total',
      priority: 1,
      align: 'right',
      className: 'tnum font-medium text-ink-900',
      render: (order) => money(order.total),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      render: (order) => <OrderStatusBadge status={order.status} size="sm" />,
    },
    {
      key: 'tracking',
      header: 'Tracking',
      priority: 3,
      sortable: false,
      render: (order) =>
        order.tracking?.number ? (
          <span className="tnum block font-mono text-[11.5px] text-ink-500">
            {order.tracking.number}
            <span className="block text-ink-300">{order.tracking.carrier}</span>
          </span>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
  ];

  // The two actions that used to be inline buttons. They move into the `···`
  // menu so the row stops widening with every action added later.
  const rowMenu = [
    {
      key: 'status',
      label: 'Update status',
      icon: Truck,
      disabled: (order) => order.status === 'delivered' || order.status === 'cancelled',
      onSelect: setEditing,
    },
    {
      key: 'refund',
      label: (order) => ((order.refundedTotal ?? 0) > 0 ? 'Refund again' : 'Refund to store credit'),
      icon: Undo2,
      tone: 'danger',
      disabled: (order) => (order.refundedTotal ?? 0) >= order.total,
      onSelect: setRefunding,
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <KpiRow
        tiles={[
          {
            key: 'open',
            label: 'Open orders',
            value: formatCount(awaiting + shipped),
            hint: 'Placed through out for delivery',
            tone: 'brand',
            icon: Package,
          },
          {
            key: 'awaiting',
            label: 'To fulfil',
            value: formatCount(awaiting),
            hint: 'Placed or processing',
            tone: awaiting > 0 ? 'warn' : 'ok',
            icon: PackageCheck,
          },
          {
            key: 'shipped',
            label: 'In transit',
            value: formatCount(shipped),
            hint: 'Shipped or out for delivery',
            tone: 'info',
            icon: Truck,
          },
          {
            key: 'value',
            label: 'Value',
            value: money(rangeValue),
            hint: `Across ${formatCount(orders.length)} order${orders.length === 1 ? '' : 's'}`,
            tone: 'ok',
            icon: Wallet,
          },
        ]}
      />

      <Panel flush>
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Order number, PO or SKU…"
          pills={PILLS.map((pill) => ({
            ...pill,
            count: pill.value === 'all' ? undefined : counts[pill.value],
          }))}
          activePill={status}
          onPillChange={setStatus}
          onExport={(format) =>
            // Wired to a real endpoint in phase 12 (§7.4); until then it says so
            // rather than downloading an empty file.
            window.alert(
              `Export to ${format} arrives in phase 12. It will carry the current filters: ` +
                `status "${status}"${query ? `, search "${query}"` : ''}.`,
            )
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 sm:px-4">
          <CountLine total={orders.length} noun={orders.length === 1 ? 'order' : 'orders'} />

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12.5px] text-ink-500">
                <span className="font-semibold text-ink-900">{selected.length}</span> selected
              </p>

              {/* Bulk deliberately offers no `shipped` step: one tracking number
                  across many parcels is wrong, so shipping stays a per-order
                  action with its own form. */}
              <Button
                size="xs"
                variant="outline"
                onClick={() => setBulkStatus('processing')}
                loading={bulkOrderStatus.isPending}
              >
                Mark processing
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setBulkStatus('delivered')}
                loading={bulkOrderStatus.isPending}
              >
                Mark delivered
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* A batch is partial by design, so what did **not** move is reported
            rather than swallowed — silently moving nineteen of twenty is how an
            operator comes to trust a button that is lying to them. */}
        {bulkResult && (
          <div className="border-b border-line bg-surface-2 px-3 py-2.5 sm:px-4">
            <p className="text-[12.5px] text-ink-700">
              <span className="font-semibold text-ok">{bulkResult.updated.length} moved</span>
              {bulkResult.skipped.length > 0 && (
                <>
                  {' · '}
                  <span className="font-semibold text-warn">
                    {bulkResult.skipped.length} skipped
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => setBulkResult(null)}
                className="ml-2 text-[12px] text-ink-400 underline hover:text-ink-900"
              >
                Dismiss
              </button>
            </p>

            {bulkResult.skipped.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {bulkResult.skipped.map((skip) => (
                  <li key={skip.orderNumber} className="text-[12px] text-ink-500">
                    <span className="font-mono text-ink-700">{skip.orderNumber}</span> — {skip.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(order) => order.orderNumber}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          rowMenu={rowMenu}
          loading={isLoading}
          defaultSort={{ key: 'createdAt', direction: 'desc' }}
          empty={
            <PanelEmpty
              icon={Package}
              title="No orders match"
              body="Try a different filter or search."
            />
          }
        />
      </Panel>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Update order status"
        size="md"
        align="top"
      >
        {editing && (
          <StatusForm
            order={editing}
            isPending={updateOrderStatus.isPending}
            error={updateOrderStatus.error?.message}
            onCancel={() => setEditing(null)}
            onSubmit={(body) =>
              updateOrderStatus.mutate(
                { orderNumber: editing.orderNumber, ...body },
                { onSuccess: () => setEditing(null) },
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(refunding)}
        onClose={() => setRefunding(null)}
        title="Refund to store credit"
        size="md"
        align="top"
      >
        {refunding && (
          <RefundForm
            order={refunding}
            isPending={refundOrder.isPending}
            error={refundOrder.error?.message}
            onCancel={() => setRefunding(null)}
            onSubmit={(body) =>
              refundOrder.mutate(
                { orderNumber: refunding.orderNumber, ...body },
                { onSuccess: () => setRefunding(null) },
              )
            }
          />
        )}
      </Modal>
    </>
  );
}

export default AdminOrdersPage;
