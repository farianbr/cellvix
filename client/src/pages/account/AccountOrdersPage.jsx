import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Package, Search } from 'lucide-react';
import { money, date } from '@/lib/format';
import { ORDER_STATUSES } from '@/lib/constants';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import { useOrders } from '@/hooks/useAccount';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  ...ORDER_STATUSES.map((status) => ({ value: status.value, label: status.label })),
  { value: 'cancelled', label: 'Cancelled' },
];

export function AccountOrdersPage() {
  const { data: orders, isLoading } = useOrders();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => {
    if (!orders) return [];
    const needle = query.trim().toLowerCase();

    return orders.filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (!needle) return true;
      // Match the order number, a PO, or any SKU or part name in the order —
      // a buyer usually remembers the part, not the order number.
      return (
        order.orderNumber.toLowerCase().includes(needle) ||
        order.poNumber?.toLowerCase().includes(needle) ||
        order.items.some(
          (item) =>
            item.sku?.toLowerCase().includes(needle) || item.name?.toLowerCase().includes(needle),
        )
      );
    });
  }, [orders, query, status]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <Panel
      title="Orders & tracking"
      description={`${filtered.length} of ${orders?.length ?? 0} orders`}
      flush
    >
      <div className="flex flex-wrap gap-2.5 border-b border-line p-4 sm:px-5">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Order number, PO, SKU or part name…"
          icon={Search}
          containerClassName="min-w-[200px] flex-1"
        />
        <Select
          options={STATUS_FILTERS}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          containerClassName="w-auto"
          className="w-[170px]"
        />
      </div>

      {filtered.length === 0 ? (
        <PanelEmpty
          icon={Package}
          title={orders?.length ? 'No orders match that search' : 'No orders yet'}
          body={
            orders?.length
              ? 'Try a different order number, PO or SKU.'
              : 'Your orders and their tracking will appear here.'
          }
          action={
            orders?.length ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Link to="/">
                <Button variant="outline" size="sm">
                  Browse parts
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((order) => (
            <li key={order.orderNumber}>
              <Link
                to={`/account/orders/${order.orderNumber}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-medium text-ink-900">
                      {order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} size="sm" />
                  </div>

                  <p className="mt-1 text-[12.5px] text-ink-500">
                    {date(order.createdAt)} · {order.items.length}{' '}
                    {order.items.length === 1 ? 'line' : 'lines'}
                    {order.poNumber && ` · PO ${order.poNumber}`}
                  </p>

                  <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-400">
                    {order.items.map((item) => item.name).join(', ')}
                  </p>

                  {order.tracking?.number && (
                    <p className="tnum mt-1 font-mono text-[11.5px] text-ink-400">
                      {order.tracking.carrier} · {order.tracking.number}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="tnum font-display text-[15px] font-bold text-ink-900">
                    {money(order.total)}
                  </p>
                  <p className="text-[11.5px] text-ink-400">{order.payment?.method === 'terms' ? 'On account' : 'Card'}</p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default AccountOrdersPage;
