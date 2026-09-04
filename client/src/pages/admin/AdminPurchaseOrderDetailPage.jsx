import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  Ban,
  Boxes,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Send,
  Truck,
  Wallet,
} from 'lucide-react';
import { money, date, dateTime, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import ProcessStrip from '@/components/admin/ProcessStrip';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import {
  useAdminPurchaseOrder,
  useAdminExpenseCategories,
  useAdminMutations,
} from '@/hooks/useAdmin';

/**
 * One purchase order — lines, receiving, landed cost and the stage actions
 * (ERP rework §6.8).
 *
 * The two automation steps live here and both are server-side: receiving a line
 * increments `Product.stock` and writes a `StockMovement`; recording the
 * payment creates an `Expense`. The client sends quantities and a reference,
 * never a stock level, a status or a money total.
 */

const STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  partial: 'warn',
  received: 'ok',
  cancelled: 'danger',
};

const METHODS = [
  { value: 'Wire transfer', label: 'Wire transfer' },
  { value: 'e-Transfer', label: 'e-Transfer' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Credit card', label: 'Credit card' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Other', label: 'Other' },
];

/** Where this one order actually sits in the purchase automation cycle. */
function cycleStage(order) {
  if (order.status === 'draft') return 'po';
  if (order.status === 'received') return 'inventory';
  if (order.status === 'partial') return 'received';
  if (order.payment.status === 'paid') return 'shipment';
  return 'sent';
}

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day westward. */
function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Receive a delivery.
 *
 * The quantities are what arrived **in this delivery**, defaulted to whatever
 * is still outstanding. The server adds them to what has already arrived,
 * refuses an over-receipt line by line, and re-derives the status — so this
 * form never sends a running total and never sends a status.
 */
function ReceiveForm({ order, onSubmit, onCancel, isPending, error, result }) {
  const outstanding = order.items.filter((item) => item.qtyOrdered - item.qtyReceived > 0);

  const { register, handleSubmit } = useForm({
    defaultValues: {
      note: '',
      lines: Object.fromEntries(
        outstanding.map((item) => [item.sku, item.qtyOrdered - item.qtyReceived]),
      ),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Partial by design: what moved and what did not, with a reason per
          skip. Silently receiving nineteen of twenty lines is how an operator
          comes to trust a button that is lying to them. */}
      {result && (
        <div className="space-y-2">
          {result.received.length > 0 && (
            <div className="rounded-md bg-ok-50 px-3 py-2.5 text-sm text-ok">
              <p className="font-semibold">Received {result.received.length} line(s)</p>
              <ul className="mt-1 space-y-0.5">
                {result.received.map((row) => (
                  <li key={row.sku} className="tnum">
                    {row.sku} — {row.qty} received, {row.qtyAfter} on hand
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div className="rounded-md bg-warn-50 px-3 py-2.5 text-sm text-warn">
              <p className="font-semibold">Skipped {result.skipped.length} line(s)</p>
              <ul className="mt-1 space-y-0.5">
                {result.skipped.map((row) => (
                  <li key={row.sku}>
                    <span className="font-mono">{row.sku}</span> — {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {outstanding.map((item) => {
          const due = item.qtyOrdered - item.qtyReceived;
          return (
            <div
              key={item.sku}
              className="grid items-center gap-2 rounded-md bg-surface-2 p-2.5 sm:grid-cols-[1fr_110px]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-900">{item.name}</p>
                <p className="tnum mt-0.5 text-xs text-ink-400">
                  <span className="font-mono">{item.sku}</span> · {item.qtyReceived} of{' '}
                  {item.qtyOrdered} received · {due} outstanding
                </p>
              </div>
              <Input
                label="Receiving"
                type="number"
                min="0"
                max={due}
                {...register(`lines.${item.sku}`)}
              />
            </div>
          );
        })}
      </div>

      <Textarea label="Note" rows={2} placeholder="Packing slip, carrier, condition…" {...register('note')} />

      <p className="rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-500">
        Enter what arrived in this delivery, not a running total. Stock and the order status are both
        recalculated on the server, and each line is checked on its own — one line that cannot be
        received will not fail the rest.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        <Button type="submit" loading={isPending} disabled={!outstanding.length}>
          Receive delivery
        </Button>
      </div>
    </form>
  );
}

/**
 * Record the payment — which creates the expense.
 *
 * The amount is not on this form: it is `order.total`, read from the order on
 * the server. A payment form that let an operator type a different number would
 * be a second source of truth for what this order cost.
 */
function PaymentForm({ order, categories, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      method: 'Wire transfer',
      reference: order.poNumber,
      paidAt: todayIso(),
      category: categories.find((row) => row.slug === 'inventory-purchases')?.id ?? categories[0]?.id ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-md bg-surface-2 p-3.5">
        <p className="font-mono text-sm font-medium text-ink-900">{order.poNumber}</p>
        <p className="mt-0.5 text-sm text-ink-500">{order.supplier.name}</p>
        <p className="tnum mt-1.5 text-sm">
          <span className="font-semibold text-ink-900">{money(order.total)}</span>
          <span className="text-ink-500"> — the amount this will record</span>
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField control={control} name="method" label="Method" options={METHODS} />
        <Input label="Paid on" type="date" max={todayIso()} {...register('paidAt')} />
      </div>

      <Input label="Reference" placeholder="Wire or cheque number" {...register('reference')} />

      <SelectField
        control={control}
        name="category"
        label="File under"
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
      />

      <p className="rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-500">
        Recording this creates an expense for {money(order.total)}, linked to this order. It can only
        be recorded once — the expense is owned by the purchase order, so the two can never
        double-count.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Record payment
        </Button>
      </div>
    </form>
  );
}

export function AdminPurchaseOrderDetailPage() {
  const { id } = useParams();
  const [receiving, setReceiving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receiveResult, setReceiveResult] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const { data, isLoading, error } = useAdminPurchaseOrder(id);
  const { data: categoryData } = useAdminExpenseCategories();
  const { receivePurchaseOrder, recordPurchasePayment, setPurchaseOrderStatus } =
    useAdminMutations();

  const order = data?.order;
  const movements = data?.movements ?? [];
  const categories = (categoryData?.categories ?? []).filter((category) => category.isActive);

  useSetRecordLabel(order?.poNumber);

  if (error) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Purchase order" />
        <Panel>
          <PanelEmpty
            icon={ClipboardList}
            title="Purchase order not found"
            body={error.message}
            action={
              <Link
                to="/admin/purchase-orders"
                className="inline-flex h-9 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 font-display text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
              >
                Back to purchase orders
              </Link>
            }
          />
        </Panel>
      </>
    );
  }

  if (isLoading || !order) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Purchase order" />
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-64 animate-pulse rounded-lg bg-surface-2" />
        </div>
      </>
    );
  }

  const qtyOrdered = order.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
  const qtyReceived = order.items.reduce((sum, item) => sum + item.qtyReceived, 0);
  const canReceive = !['draft', 'received', 'cancelled'].includes(order.status);
  const canPay =
    !['draft', 'cancelled'].includes(order.status) && order.payment.status !== 'paid';

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title={order.poNumber}
        description={`${order.supplier.name} · ordered ${date(order.orderDate)}`}
        badge={
          <>
            <Badge tone={STATUS_TONES[order.status]} size="sm">
              {order.status}
            </Badge>
            {order.overdue && (
              <Badge tone="danger" size="sm">
                overdue
              </Badge>
            )}
          </>
        }
        action={
          <>
            {order.status === 'draft' && (
              <Button
                icon={Send}
                loading={setPurchaseOrderStatus.isPending}
                onClick={() => setPurchaseOrderStatus.mutate({ id: order.id, status: 'sent' })}
              >
                Send to supplier
              </Button>
            )}
            {canReceive && (
              <Button icon={PackageCheck} onClick={() => setReceiving(true)}>
                Receive delivery
              </Button>
            )}
            {canPay && (
              <Button variant="outline" icon={Wallet} onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )}
            {order.status !== 'cancelled' && qtyReceived === 0 && (
              <Button
                variant="ghost"
                icon={Ban}
                onClick={() => setCancelling(true)}
              >
                Cancel
              </Button>
            )}
          </>
        }
      />

      {setPurchaseOrderStatus.error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {setPurchaseOrderStatus.error.message}
        </p>
      )}

      <KpiRow
        tiles={[
          {
            key: 'total',
            label: 'Order total',
            value: money(order.total),
            hint: `${money(order.subtotal)} of goods`,
            tone: 'brand',
            icon: Wallet,
          },
          {
            key: 'received',
            label: 'Received',
            value: `${formatCount(qtyReceived)} / ${formatCount(qtyOrdered)}`,
            hint: qtyOrdered - qtyReceived > 0
              ? `${formatCount(qtyOrdered - qtyReceived)} still outstanding`
              : 'Every line landed',
            tone: qtyReceived >= qtyOrdered ? 'ok' : 'warn',
            icon: PackageCheck,
          },
          {
            key: 'expected',
            label: 'Expected',
            value: order.expectedDate ? date(order.expectedDate) : '—',
            hint: order.overdue ? 'Past its expected date' : 'On schedule',
            tone: order.overdue ? 'danger' : 'info',
            icon: Truck,
          },
          {
            key: 'payment',
            label: 'Payment',
            value: order.payment.status === 'paid' ? 'Paid' : 'Unpaid',
            hint:
              order.payment.status === 'paid'
                ? `${order.payment.method ?? 'Recorded'} · ${date(order.payment.paidAt)}`
                : 'No expense recorded yet',
            tone: order.payment.status === 'paid' ? 'ok' : 'neutral',
            icon: Wallet,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <Panel title="Lines" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="eyebrow px-4 py-2.5 text-ink-400">
                      Product
                    </th>
                    <th scope="col" className="eyebrow px-4 py-2.5 text-right text-ink-400">
                      Ordered
                    </th>
                    <th scope="col" className="eyebrow px-4 py-2.5 text-right text-ink-400">
                      Received
                    </th>
                    <th scope="col" className="eyebrow px-4 py-2.5 text-right text-ink-400">
                      Unit cost
                    </th>
                    <th scope="col" className="eyebrow px-4 py-2.5 text-right text-ink-400">
                      Line total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => {
                    const short = item.qtyOrdered - item.qtyReceived;
                    return (
                      <tr key={item.sku} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-sm text-ink-900">{item.name}</p>
                          <p className="font-mono text-xs text-ink-400">{item.sku}</p>
                        </td>
                        <td className="tnum px-4 py-3 text-right text-sm text-ink-700">
                          {formatCount(item.qtyOrdered)}
                        </td>
                        <td className="tnum px-4 py-3 text-right text-sm">
                          <span className={short > 0 ? 'text-warn' : 'text-ok'}>
                            {formatCount(item.qtyReceived)}
                          </span>
                          {short > 0 && order.status !== 'draft' && (
                            <span className="block text-2xs text-ink-400">{short} short</span>
                          )}
                        </td>
                        <td className="tnum px-4 py-3 text-right text-sm text-ink-700">
                          {money(item.unitCost)}
                        </td>
                        <td className="tnum px-4 py-3 text-right text-sm font-medium text-ink-900">
                          {money(item.lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line px-4 py-3">
              <dl className="ml-auto max-w-[260px] space-y-1 text-sm">
                <div className="tnum flex justify-between text-ink-600">
                  <dt>Subtotal</dt>
                  <dd>{money(order.subtotal)}</dd>
                </div>
                <div className="tnum flex justify-between text-ink-600">
                  <dt>Tax</dt>
                  <dd>{money(order.tax)}</dd>
                </div>
                <div className="tnum flex justify-between text-ink-600">
                  <dt>Shipping</dt>
                  <dd>{money(order.shipping)}</dd>
                </div>
                <div className="tnum flex justify-between border-t border-line pt-1 text-md font-semibold text-ink-900">
                  <dt>Total</dt>
                  <dd>{money(order.total)}</dd>
                </div>
                {/* Landed cost per unit — what a received part actually cost
                    once tax and freight are spread over it. */}
                {qtyReceived > 0 && (
                  <div className="tnum flex justify-between pt-1 text-xs text-ink-400">
                    <dt>Landed cost per unit</dt>
                    <dd>{money(Math.round(order.total / Math.max(qtyOrdered, 1)))}</dd>
                  </div>
                )}
              </dl>
            </div>
          </Panel>

          <Panel title="Stock movements" description="Every receipt against this order." flush>
            {movements.length ? (
              <ul className="divide-y divide-line">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-ok-50 text-ok">
                      <Boxes className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-900">
                        {movement.product?.name ?? 'Product'}{' '}
                        <span className="tnum text-ok">+{movement.qtyChange}</span>
                      </p>
                      <p className="tnum mt-0.5 text-xs text-ink-400">
                        {movement.product?.sku} · {movement.qtyAfter} on hand after ·{' '}
                        {dateTime(movement.at)}
                      </p>
                      {movement.note && (
                        <p className="mt-0.5 text-xs text-ink-500">{movement.note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <PanelEmpty
                icon={Boxes}
                title="Nothing received yet"
                body="Receiving a line moves stock and records a movement here."
              />
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Supplier">
            <p className="text-md font-medium text-ink-900">{order.supplier.name}</p>
            {order.supplier.email && (
              <a
                href={`mailto:${order.supplier.email}`}
                className="mt-0.5 block break-all text-sm text-ink-500 hover:text-brand"
              >
                {order.supplier.email}
              </a>
            )}
            {order.supplier.id && (
              <Link
                to={`/admin/suppliers/${order.supplier.id}`}
                className="mt-3 inline-flex h-8 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-3 font-display text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
              >
                View profile
              </Link>
            )}
          </Panel>

          {order.notes && (
            <Panel title="Notes">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">
                {order.notes}
              </p>
            </Panel>
          )}

          <Panel title="Timeline" flush>
            <ul className="divide-y divide-line">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.status}-${index}`} className="flex items-start gap-2.5 px-4 py-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-400">
                    <CheckCircle2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{entry.status}</p>
                    <p className="text-xs text-ink-400">{dateTime(entry.at)}</p>
                    {entry.note && (
                      <p className="mt-0.5 text-xs text-ink-500">{entry.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <ProcessStrip current={cycleStage(order)} className="mt-3" />

      <Modal
        open={receiving}
        onClose={() => {
          setReceiving(false);
          setReceiveResult(null);
        }}
        title="Receive delivery"
        size="lg"
        align="top"
      >
        {receiving && (
          <ReceiveForm
            order={order}
            result={receiveResult}
            isPending={receivePurchaseOrder.isPending}
            error={receivePurchaseOrder.error?.message}
            onCancel={() => {
              setReceiving(false);
              setReceiveResult(null);
            }}
            onSubmit={(values) =>
              receivePurchaseOrder.mutate(
                {
                  id: order.id,
                  note: values.note || undefined,
                  lines: Object.entries(values.lines ?? {})
                    .map(([sku, qty]) => ({ sku, qty: Number(qty) || 0 }))
                    .filter((line) => line.qty > 0),
                },
                {
                  // Kept open on success so the operator reads what moved and
                  // what did not, rather than the dialog closing over the skips.
                  onSuccess: (payload) =>
                    setReceiveResult({
                      received: payload.received ?? [],
                      skipped: payload.skipped ?? [],
                    }),
                },
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={paying}
        onClose={() => setPaying(false)}
        title="Record payment"
        size="md"
        align="top"
      >
        {paying && (
          <PaymentForm
            order={order}
            categories={categories}
            isPending={recordPurchasePayment.isPending}
            error={recordPurchasePayment.error?.message}
            onCancel={() => setPaying(false)}
            onSubmit={(values) =>
              recordPurchasePayment.mutate(
                { id: order.id, ...values },
                { onSuccess: () => setPaying(false) },
              )
            }
          />
        )}
      </Modal>

      {/* Only offered while nothing has been received, but it still closes the
          order out against the supplier and there is no un-cancel. */}
      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() =>
          setPurchaseOrderStatus.mutate(
            { id: order.id, status: 'cancelled' },
            { onSuccess: () => setCancelling(false) },
          )
        }
        title="Cancel this purchase order?"
        body={`${order.poNumber} to ${order.supplier.name} closes as cancelled. Nothing on it has been received.`}
        consequence="There is no un-cancel. Ordering these parts again means raising a new PO."
        tone="danger"
        confirmLabel="Cancel order"
        cancelLabel="Keep it open"
        loading={setPurchaseOrderStatus.isPending}
        error={setPurchaseOrderStatus.error?.message}
      />
    </>
  );
}

export default AdminPurchaseOrderDetailPage;
