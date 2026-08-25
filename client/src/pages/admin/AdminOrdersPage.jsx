import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Package, Search, Truck, Undo2 } from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, count as formatCount } from '@/lib/format';
import { ORDER_STATUS_FLOW, CARRIERS } from '@shared/schemas/admin';
import { ORDER_STATUSES } from '@/lib/constants';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import SelectMenu from '@/components/ui/SelectMenu';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import { useAdminOrders, useAdminMutations } from '@/hooks/useAdmin';

const FILTERS = [
  { value: 'all', label: 'All statuses' },
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

export function AdminOrdersPage() {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useAdminOrders({ status, q: query || undefined });
  const { updateOrderStatus, refundOrder } = useAdminMutations();
  const [refunding, setRefunding] = useState(null);

  const orders = data?.orders ?? [];
  const counts = data?.counts ?? {};

  return (
    <>
      <Panel
        title="Orders"
        description={`${formatCount(orders.length)} shown · ${formatCount(
          (counts.placed ?? 0) + (counts.processing ?? 0),
        )} awaiting dispatch`}
        flush
      >
        <div className="flex flex-wrap gap-2.5 border-b border-line p-4 sm:px-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order number, PO or SKU…"
            icon={Search}
            containerClassName="min-w-[200px] flex-1"
          />
          <SelectMenu
            options={FILTERS}
            value={status}
            onChange={setStatus}
            srLabel="Filter by status"
            size="md"
            className="w-[180px]"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 sm:p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <PanelEmpty icon={Package} title="No orders match" body="Try a different filter or search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Order', 'Business', 'Placed', 'Items', 'Total', 'Status', 'Tracking', ''].map(
                    (heading) => (
                      <th key={heading} scope="col" className="eyebrow px-4 py-2.5 text-ink-400 first:sm:pl-5">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.orderNumber} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3 sm:pl-5">
                      <span className="font-mono text-[12.5px] font-medium text-ink-900">
                        {order.orderNumber}
                      </span>
                      {order.poNumber && (
                        <span className="block text-[11px] text-ink-400">PO {order.poNumber}</span>
                      )}
                    </td>

                    <td className="max-w-[180px] truncate px-4 py-3 text-[13px] text-ink-700">
                      {order.businessName}
                    </td>

                    <td className="px-4 py-3 text-[12.5px] text-ink-500">{date(order.createdAt)}</td>

                    <td className="tnum px-4 py-3 text-[12.5px] text-ink-500">
                      {order.items.length}
                    </td>

                    <td className="tnum px-4 py-3 text-[13px] font-medium text-ink-900">
                      {money(order.total)}
                    </td>

                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} size="sm" />
                    </td>

                    <td className="px-4 py-3">
                      {order.tracking?.number ? (
                        <span className="tnum block font-mono text-[11.5px] text-ink-500">
                          {order.tracking.number}
                          <span className="block text-ink-300">{order.tracking.carrier}</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          icon={Truck}
                          disabled={order.status === 'delivered' || order.status === 'cancelled'}
                          onClick={() => setEditing(order)}
                        >
                          Update
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={Undo2}
                          disabled={(order.refundedTotal ?? 0) >= order.total}
                          onClick={() => setRefunding(order)}
                        >
                          {(order.refundedTotal ?? 0) > 0 ? 'Refunded' : 'Refund'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
