import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Package,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { money, moneyCompact, date, count as formatCount } from '@/lib/format';
import Panel, { StatTile, PanelEmpty } from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';

import { useAdminStats } from '@/hooks/useAdmin';

export function AdminOverviewPage() {
  const { data, isLoading } = useAdminStats();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { users, orders, revenue, receivables, inventory, recentOrders, pendingQueue } = data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Awaiting approval"
          value={formatCount(users.pending)}
          hint={`${formatCount(users.approved)} approved accounts`}
          tone={users.pending > 0 ? 'warn' : 'ok'}
          icon={UserCheck}
        />
        <StatTile
          label="Open orders"
          value={formatCount(orders.open)}
          hint={`${formatCount(orders.last30Days)} placed in 30 days`}
          icon={Package}
        />
        <StatTile
          label="Revenue · 30 days"
          value={moneyCompact(revenue.last30Days)}
          hint="Excludes cancelled orders"
          icon={TrendingUp}
        />
        <StatTile
          label="Receivables"
          value={money(receivables.outstanding)}
          hint={
            receivables.overdue > 0
              ? `${money(receivables.overdue)} overdue`
              : 'Nothing past due'
          }
          tone={receivables.overdue > 0 ? 'danger' : 'neutral'}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---- approvals queue: the reason this screen exists ------------- */}
        <Panel
          title="Approvals queue"
          description="New businesses cannot see pricing or order until approved."
          action={
            <Link
              to="/admin/approvals"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
            >
              Open queue
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
          flush={pendingQueue.length > 0}
        >
          {pendingQueue.length === 0 ? (
            <PanelEmpty
              icon={UserCheck}
              title="Nothing waiting"
              body="Every registered business has been reviewed."
            />
          ) : (
            <ul className="divide-y divide-line">
              {pendingQueue.map((user) => (
                <li key={user.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink-900">
                      {user.businessName}
                    </p>
                    <p className="truncate text-[12.5px] text-ink-500">
                      {user.contactName} · {user.email}
                    </p>
                    <p className="text-[11.5px] text-ink-400">
                      Registered {date(user.createdAt)}
                      {user.businessType && ` · ${user.businessType}`}
                    </p>
                  </div>

                  <Link to="/admin/approvals">
                    <Button size="xs" variant="brandSoft">
                      Review
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ---- inventory health ------------------------------------------- */}
        <Panel title="Inventory" description={`${formatCount(inventory.total)} active SKUs`}>
          <ul className="space-y-2.5">
            <li className="flex items-center justify-between gap-3 rounded-[11px] border border-line px-3.5 py-3">
              <span className="flex items-center gap-2.5 text-[13.5px] text-ink-700">
                <span className="flex size-8 items-center justify-center rounded-lg bg-warn-50 text-warn">
                  <AlertTriangle className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                Low stock (under 50)
              </span>
              <span className="tnum font-display text-[16px] font-bold text-ink-900">
                {formatCount(inventory.lowStock)}
              </span>
            </li>

            <li className="flex items-center justify-between gap-3 rounded-[11px] border border-line px-3.5 py-3">
              <span className="flex items-center gap-2.5 text-[13.5px] text-ink-700">
                <span className="flex size-8 items-center justify-center rounded-lg bg-danger-50 text-danger">
                  <Boxes className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                Out of stock
              </span>
              <span className="tnum font-display text-[16px] font-bold text-ink-900">
                {formatCount(inventory.outOfStock)}
              </span>
            </li>
          </ul>

          <Link
            to="/admin/products?stock=low"
            className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
          >
            Review stock levels
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        </Panel>
      </div>

      {/* ---- recent orders ------------------------------------------------- */}
      <Panel
        title="Recent orders"
        action={
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
          >
            All orders
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        }
        flush
      >
        {recentOrders.length === 0 ? (
          <PanelEmpty icon={Package} title="No orders yet" />
        ) : (
          <ul className="divide-y divide-line">
            {recentOrders.map((order) => (
              <li key={order.orderNumber} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12.5px] font-medium text-ink-900">
                    {order.orderNumber}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-500">{order.businessName}</p>
                </div>

                <p className="hidden text-[12px] text-ink-400 sm:block">{date(order.createdAt)}</p>
                <OrderStatusBadge status={order.status} size="sm" />

                <p className="tnum w-24 shrink-0 text-right font-display text-[13.5px] font-bold">
                  {money(order.total)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default AdminOverviewPage;
