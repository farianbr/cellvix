import { Link, useParams } from 'react-router';
import cn from '@/lib/cn';
import { useTableClasses, CountLine } from '@/components/admin/DataTable';
import { ArrowLeft } from 'lucide-react';

import Panel, { StatTile } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminOrder } from '@/hooks/useAdmin';
import { money, date, dateTime } from '@/lib/format';
import { pressable } from '@/lib/motion';

/**
 * One order (§4b.6, phase 12).
 *
 * The route existed from phase 1 and rendered a stub; global search made that
 * visible, since an order hit navigated straight into "not built yet".
 *
 * **Read-only.** Status changes and refunds are driven from the Orders list,
 * which holds those dialogs and the rules behind them — the partial-refund
 * ceiling, the bulk-action skip reasons. A second set of controls here would be
 * a second place for them to drift.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/orders/:orderNumber'], icon: adminIcon('Package') };

const STATUS_TONE = {
  pending: 'neutral',
  processing: 'info',
  shipped: 'info',
  delivered: 'ok',
  cancelled: 'danger',
  refunded: 'warn',
};

function Address({ title, address }) {
  if (!address) return null;
  return (
    <div className="min-w-0">
      <p className="eyebrow mb-1 text-ink-400">{title}</p>
      <p className="text-sm leading-relaxed text-ink-700">
        {address.contactName && <span className="block font-medium text-ink-900">{address.contactName}</span>}
        {address.company && <span className="block">{address.company}</span>}
        {address.line1 && <span className="block">{address.line1}</span>}
        {address.line2 && <span className="block">{address.line2}</span>}
        <span className="block">
          {[address.city, address.region, address.postal].filter(Boolean).join(', ')}
        </span>
        {address.phone && <span className="mt-1 block text-ink-500">{address.phone}</span>}
      </p>
    </div>
  );
}

/** `out_for_delivery` reads as `Out for delivery`. */
/**
 * Whether the two addresses would render identically.
 *
 * Compared field by field rather than with JSON.stringify: the two objects come
 * from different places on the order, so they can carry keys in a different
 * order or hold extras the page never prints, and neither difference is one a
 * reader would see.
 */
function sameAddressAs(a, b) {
  if (!a || !b) return false;
  const fields = ['contactName', 'company', 'line1', 'line2', 'city', 'region', 'postal', 'country', 'phone'];
  return fields.every((f) => (a[f] ?? '') === (b[f] ?? ''));
}

function titleCase(value) {
  const spaced = String(value ?? '').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function AdminOrderDetailPage() {
  const t = useTableClasses();
  const { orderNumber } = useParams();
  const { data, isLoading, error } = useAdminOrder(orderNumber);

  if (isLoading) return <p className="text-sm text-ink-500">Loading order…</p>;

  if (error) {
    return (
      <>
        <PageHeader icon={ADMIN_PAGE.icon} title="Order not found" />
        <p className="text-sm text-ink-500">
          {error.message}{' '}
          <Link to="/admin/orders" className="font-semibold text-brand underline">
            Back to orders
          </Link>
        </p>
      </>
    );
  }

  const order = data?.order;
  if (!order) return null;

  const sameAddress = sameAddressAs(order.shippingAddress, order.billingAddress);

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={order.orderNumber}
        description={`Placed ${date(order.createdAt)} by ${order.displayName ?? order.businessName}.`}
        action={
          <Link
            to="/admin/orders"
            className={cn(pressable, 'inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink-600 hover:border-ink-300 hover:bg-surface-2')}
          >
            <ArrowLeft className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            All orders
          </Link>
        }
      />

      <div className="max-w-record space-y-4">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total" value={money(order.total)} />
          {/* Title-cased, not the raw enum. Every other status in the app is
              rendered through a Badge and reads "Placed"; this tile printed the
              stored value, so the one screen dedicated to a single order was
              also the one screen that spelled its status differently from the
              list it was opened from. */}
          <StatTile
            label="Status"
            value={titleCase(order.status)}
            tone={STATUS_TONE[order.status] ?? 'neutral'}
          />
          <StatTile
            label="Store credit used"
            value={money(order.storeCreditApplied)}
            tone={order.storeCreditApplied > 0 ? 'info' : 'neutral'}
          />
          <StatTile
            label="Refunded"
            value={money(order.refundedTotal)}
            tone={order.refundedTotal > 0 ? 'warn' : 'neutral'}
          />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
        <Panel title="Lines" description="What a warehouse picks. Bundle members are listed as parts.">
          {/* Carries the density toggle. These lines follow the same density as
              every list table, so the page has to offer a way to set it. */}
          <div className="mb-2 border-b border-line pb-2">
            <CountLine
              total={order.items.length}
              noun={order.items.length === 1 ? 'line' : 'lines'}
            />
          </div>

          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-130 text-left">
              <thead>
                <tr className={t.headRow}>
                  <th scope="col" className={t.headCell()}>Part</th>
                  <th scope="col" className={t.headCell()}>Qty</th>
                  <th scope="col" className={t.headCell('right')}>Unit</th>
                  <th scope="col" className={t.headCell('right')}>Line</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.sku}-${index}`} className={t.row}>
                    <td className={t.cell()}>
                      <span className="block font-medium text-ink-900">{item.name}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-ink-400">{item.sku}</span>
                        {/* A bundle member is priced as part of a unit, so its
                            line total does not add up on its own — saying which
                            offer it came from is what makes that legible. */}
                        {item.bundle?.title && <Badge tone="brand">{item.bundle.title}</Badge>}
                      </span>
                    </td>
                    <td className={cn(t.cell(), 'tnum text-ink-700')}>{item.qty}</td>
                    <td className={cn(t.cell('right'), 'tnum text-ink-700')}>
                      {money(item.unitPrice)}
                    </td>
                    <td className={cn(t.cell('right'), 'tnum font-medium text-ink-900')}>
                      {money(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Subtotal</dt>
              <dd className="tnum text-ink-900">{money(order.subtotal)}</dd>
            </div>
            {order.bundleDiscount > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ok">Bundle pricing</dt>
                <dd className="tnum text-ok">−{money(order.bundleDiscount)}</dd>
              </div>
            )}
            {order.promoDiscount > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ok">{order.promo?.code ?? 'Offer'}</dt>
                <dd className="tnum text-ok">−{money(order.promoDiscount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Shipping</dt>
              <dd className="tnum text-ink-900">{money(order.shipping)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Tax</dt>
              <dd className="tnum text-ink-900">{money(order.tax)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-1.5">
              <dt className="font-display font-bold text-ink-900">Total</dt>
              <dd className="tnum font-display font-bold text-ink-900">{money(order.total)}</dd>
            </div>
          </dl>
        </Panel>

        </div>

        <div className="space-y-4">
        <Panel title="Delivery & account">
          {/* One column when the two addresses are the same, which is the
              common case for a business buying to its own premises. Printing an
              identical address twice under two headings makes a reader compare
              them line by line to find the difference, and there is none. */}
          <div
            className={cn(
              'grid gap-5',
              sameAddress ? 'sm:grid-cols-1' : 'sm:grid-cols-2',
            )}
          >
            <Address
              title={sameAddress ? 'Ship & bill to' : 'Ship to'}
              address={order.shippingAddress}
            />
            {!sameAddress && <Address title="Bill to" address={order.billingAddress} />}
          </div>

          <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Account</dt>
              <dd className="min-w-0 truncate">
                {order.userId ? (
                  <Link to={`/admin/clients/${order.userId}`} className="font-medium text-brand hover:underline">
                    {order.displayName ?? order.businessName}
                  </Link>
                ) : (
                  order.displayName ?? order.businessName
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Invoice</dt>
              <dd>
                {order.invoiceNumber ? (
                  <Link to={`/admin/invoices/${order.invoiceNumber}`} className="font-medium text-brand hover:underline">
                    {order.invoiceNumber}
                  </Link>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Delivery</dt>
              <dd className="text-ink-900">{order.deliveryMethod?.label ?? '—'}</dd>
            </div>
            {order.poNumber && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">PO number</dt>
                <dd className="font-mono text-sm text-ink-900">{order.poNumber}</dd>
              </div>
            )}
          </dl>

          {order.deliveryNotes && (
            <p className="mt-3 rounded-md bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-ink-600">
              <span className="font-medium text-ink-700">Delivery notes: </span>
              {order.deliveryNotes}
            </p>
          )}
        </Panel>

        <Panel
          title="Timeline"
          description="Append-only — it is what the buyer's tracking page renders."
        >
          <ol className="space-y-2.5">
            {(order.timeline ?? []).map((entry, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <Badge tone={STATUS_TONE[entry.status] ?? 'neutral'}>{entry.status}</Badge>
                <span className="min-w-0 flex-1 text-sm text-ink-600">{entry.note}</span>
                <span className="tnum shrink-0 text-xs text-ink-400">{dateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
        </Panel>
        </div>
        </div>
      </div>
    </>
  );
}

export default AdminOrderDetailPage;
