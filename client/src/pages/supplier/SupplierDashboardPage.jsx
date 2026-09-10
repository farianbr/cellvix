import { Link } from 'react-router';
import { ArrowRight, CheckCircle2, Clock, FileText, Inbox, MessageSquare, Truck } from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { useSupplierSession, useSupplierOrders } from '@/hooks/useSupplierPortal';

/**
 * What a supplier sees when they sign in (§6.8a).
 *
 * **Work first, history after.** A supplier opens this to answer something, not
 * to browse, so the three groups are ordered by what is owed: orders waiting on
 * a price (including one we have queried), orders waiting on *us*, and orders
 * confirmed with them and moving. Sorting by date and making them scan for
 * which of nine rows still needs something would put the one piece of work
 * behind the eight that are done.
 *
 * Nothing on this screen mentions another supplier. The server's serializer
 * returns this supplier's own bid and nothing else — no rank, no "you were $40
 * off" — because a sealed process that quietly reports the competition is a
 * live auction nobody agreed to run.
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

const DELIVERY_LABELS = {
  pending: 'not dispatched',
  preparing: 'preparing',
  dispatched: 'dispatched',
  in_transit: 'in transit',
  delivered: 'delivered',
};

function OrderCard({ order }) {
  const bid = order.myBid;
  const needsPrice = order.state === 'open' && ['invited', 'viewed'].includes(bid.status);
  const answering = order.state === 'open' && bid.status === 'negotiating';

  return (
    <li>
      <Link
        to={`/supplier/orders/${order.id}`}
        className={cn(
          pressable,
          'flex items-start gap-3 rounded-lg border bg-surface p-4',
          needsPrice || answering ? 'border-brand/40' : 'border-line hover:border-line-strong',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-ink-900">{order.poNumber}</span>
            <Badge tone={BID_TONES[bid.status]} size="sm">
              {BID_LABELS[bid.status]}
            </Badge>
            {bid.proforma && (
              <Badge tone="neutral" size="sm" icon={FileText}>
                PI sent
              </Badge>
            )}
            {order.state === 'closed' && bid.status !== 'lost' && (
              <Badge tone="neutral" size="sm">
                closed
              </Badge>
            )}
          </span>

          {order.title && (
            <span className="mt-0.5 block truncate text-sm text-ink-700">{order.title}</span>
          )}

          <span className="mt-1 block text-xs text-ink-400">
            {formatCount(order.items.length)} line{order.items.length === 1 ? '' : 's'}
            {bid.delivery && (
              <>
                {' · '}
                {DELIVERY_LABELS[bid.delivery.status] ?? bid.delivery.status}
              </>
            )}
            {order.closesAt && (
              <>
                {' · '}
                {order.closed ? 'closed' : 'closes'} {date(order.closesAt)}
              </>
            )}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          {['quoted', 'negotiating', 'confirmed'].includes(bid.status) ? (
            <span className="tnum font-display text-md font-semibold text-ink-900">
              {money(bid.total)}
            </span>
          ) : null}
          <ArrowRight className="size-4 text-ink-300" strokeWidth={2} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

function Group({ icon: Icon, title, orders }) {
  if (!orders.length) return null;

  return (
    <section>
      <h2 className="eyebrow mb-2 flex items-center gap-1.5 text-ink-400">
        <Icon className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        {title}
      </h2>
      <ul className="space-y-2">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ul>
    </section>
  );
}

export function SupplierDashboardPage() {
  const { supplier } = useSupplierSession();
  const { data, isLoading } = useSupplierOrders();

  const orders = data?.orders ?? [];

  // Needs an answer from them: never priced, or priced and queried.
  const needsPrice = orders.filter(
    (order) =>
      order.state === 'open' &&
      ['invited', 'viewed', 'negotiating'].includes(order.myBid.status),
  );
  // Priced, and the decision is ours to make.
  const waiting = orders.filter(
    (order) => order.state === 'open' && order.myBid.status === 'quoted',
  );
  // Won, and now a delivery rather than a quote.
  const confirmed = orders.filter((order) => order.state === 'won');
  const settled = orders.filter(
    (order) =>
      !needsPrice.includes(order) && !waiting.includes(order) && !confirmed.includes(order),
  );

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-24 w-full" />
        <Skeleton className="mt-3 h-24 w-full" />
      </>
    );
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold leading-tight text-ink-900">
          {needsPrice.length
            ? `${formatCount(needsPrice.length)} order${needsPrice.length === 1 ? '' : 's'} waiting on you`
            : 'Nothing needs a price right now'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Signed in as {supplier?.name}. We will email you when a new order goes out.
        </p>
      </div>

      {!orders.length ? (
        <Panel>
          <PanelEmpty
            icon={Inbox}
            title="No orders yet"
            body="When we ask you to price something, it appears here and you will get an email about it."
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          <Group icon={Clock} title="Needs your price" orders={needsPrice} />
          <Group icon={CheckCircle2} title="Priced, waiting on us" orders={waiting} />
          <Group icon={Truck} title="Confirmed with you" orders={confirmed} />
          <Group icon={MessageSquare} title="Decided" orders={settled} />
        </div>
      )}
    </>
  );
}

export default SupplierDashboardPage;
