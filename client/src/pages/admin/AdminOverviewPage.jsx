import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  Package,
  Receipt,
  Undo2,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { money, moneyCompact, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import DateRangeBar, { DASHBOARD_PRESETS, useDateRange } from '@/components/admin/DateRangeBar';
import { TrendChart, BarList } from '@/components/admin/charts/Charts';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAuth } from '@/hooks/useAuth';

import { useAdminStats } from '@/hooks/useAdmin';

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin'], icon: adminIcon('Home') };

/**
 * One row of "this needs doing", with the count and a link to the filtered list.
 *
 * A card renders **only when its count is non-zero** (ERP rework §6.1.3). An
 * empty board is a good day and should say so, not show four zeroes — four
 * zeroes teach an operator to stop reading the section.
 */
function TodoCard({ icon: Icon, tone, title, body, to, cta }) {
  const tones = {
    warn: 'border-warn/30 bg-warn-50 text-warn',
    danger: 'border-danger/25 bg-danger-50 text-danger',
    info: 'border-info/25 bg-info-50 text-info',
  };

  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] border ${tones[tone]}`}
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink-900">{title}</span>
        <span className="block text-[12.5px] text-ink-500">{body}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand">
        {cta}
        <ArrowRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export function AdminOverviewPage() {
  const { user } = useAuth();
  // The range lives in the URL, so the whole dashboard is linkable (§6.1.2).
  const range = useDateRange('this-month');
  const { data, isLoading } = useAdminStats(range);

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-24" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const {
    users,
    orders,
    invoiced,
    collected,
    refunds,
    receivables,
    inventory,
    trend,
    topClients,
    recentOrders,
    pendingQueue,
    lowStockItems,
  } = data;

  const todos = [
    users.pending > 0 && {
      key: 'approve',
      icon: UserCheck,
      tone: 'warn',
      title: 'Approve accounts',
      body: `${formatCount(users.pending)} ${users.pending === 1 ? 'business is' : 'businesses are'} waiting for approval`,
      to: '/admin/approvals',
      cta: 'Review',
    },
    orders.awaitingFulfilment > 0 && {
      key: 'fulfil',
      icon: Package,
      tone: 'info',
      title: 'Fulfil orders',
      body: `${formatCount(orders.awaitingFulfilment)} placed and not yet shipped`,
      to: '/admin/orders?status=placed',
      cta: 'Open',
    },
    inventory.lowStock + inventory.outOfStock > 0 && {
      key: 'restock',
      icon: Boxes,
      tone: inventory.outOfStock > 0 ? 'danger' : 'warn',
      title: 'Restock inventory',
      body:
        inventory.outOfStock > 0
          ? `${formatCount(inventory.outOfStock)} out of stock · ${formatCount(inventory.lowStock)} running low`
          : `${formatCount(inventory.lowStock)} at or below the reorder point`,
      to: '/admin/inventory?stock=low',
      cta: 'Review',
    },
    receivables.overdue > 0 && {
      key: 'chase',
      icon: Wallet,
      tone: 'danger',
      title: 'Chase receivables',
      body: `${money(receivables.overdue)} overdue across ${formatCount(receivables.overdueCount)} ${receivables.overdueCount === 1 ? 'invoice' : 'invoices'}`,
      to: '/admin/invoices?status=overdue',
      cta: 'Open',
    },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={`${today} · Welcome back, ${user?.contactName ?? 'there'}.`}
      />

      <DateRangeBar presets={DASHBOARD_PRESETS} defaultPreset="this-month" />

      {/* ---- things to do today ------------------------------------------- */}
      {todos.length > 0 ? (
        <section aria-label="Things to do today" className="grid gap-2.5 lg:grid-cols-2">
          {todos.map(({ key, ...card }) => (
            <TodoCard key={key} {...card} />
          ))}
        </section>
      ) : (
        <p className="rounded-[12px] border border-ok/25 bg-ok-50 px-4 py-3 text-[13px] text-ok">
          Nothing needs attention: every account is reviewed, every order is moving, stock is
          healthy and no invoice is overdue.
        </p>
      )}

      {/* ---- the headline figures ------------------------------------------
          Collected and Invoiced are named separately and never collapsed into
          one word called "revenue" (§9.1). Outstanding and Inventory are
          positions as of today rather than flows through the range, and their
          hints say so. */}
      <KpiRow
        tiles={[
          {
            key: 'collected',
            label: 'Collected',
            value: money(collected.total),
            hint: 'Payments received in this period',
            tone: 'ok',
            icon: Wallet,
            delta: collected.deltaPercent,
            goodWhen: 'up',
          },
          {
            key: 'invoiced',
            label: 'Invoiced',
            value: money(invoiced.total),
            hint: `${formatCount(invoiced.count)} ${invoiced.count === 1 ? 'invoice' : 'invoices'} issued`,
            tone: 'brand',
            icon: Receipt,
          },
          {
            key: 'outstanding',
            label: 'Outstanding',
            value: money(receivables.outstanding),
            // Receivables are a position as of now, not a flow through the
            // range — the hint says so, because a tile in a dated row otherwise
            // reads as belonging to that date.
            hint:
              receivables.overdue > 0
                ? `${money(receivables.overdue)} overdue · as of today`
                : 'Nothing past due · as of today',
            tone: receivables.overdue > 0 ? 'danger' : 'info',
            icon: Wallet,
          },
          {
            key: 'refunds',
            label: 'Refunds',
            // Its own tile, never a negative folded into a revenue figure (§9.2).
            value: money(refunds.total),
            hint: `${formatCount(refunds.count)} refunded to store credit`,
            tone: refunds.total > 0 ? 'warn' : 'info',
            icon: Undo2,
          },
          {
            key: 'orders',
            label: 'Open orders',
            value: formatCount(orders.open),
            hint: `${formatCount(orders.awaitingFulfilment)} awaiting fulfilment`,
            tone: 'info',
            icon: Package,
          },
          {
            key: 'clients',
            label: 'Clients',
            value: formatCount(users.total),
            hint: `${formatCount(users.approved)} approved · ${formatCount(users.pending)} pending`,
            tone: 'info',
            icon: Building2,
          },
          {
            key: 'inventory',
            label: 'Inventory',
            // Also a position rather than a flow, like Outstanding above.
            value: moneyCompact(inventory.value),
            hint: `Value of ${formatCount(inventory.total)} SKUs · as of today`,
            tone: 'info',
            icon: Boxes,
          },
        ]}
      />

      {/* ---- trend and top clients ---------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Order value"
          description={`By ${data.range?.bucket === 'week' ? 'week' : 'day'}, cancelled orders excluded`}
        >
          <TrendChart
            points={trend}
            caption="Order value over the selected period"
            formatValue={moneyCompact}
          />
        </Panel>

        <Panel title="Top clients" description="By invoiced value in this period">
          {topClients.length === 0 ? (
            <PanelEmpty
              icon={Building2}
              title="Nothing invoiced"
              body="No invoices were issued in this period."
            />
          ) : (
            <BarList
              items={topClients.map((client) => ({
                label: client.businessName,
                value: client.total,
                hint: `${formatCount(client.invoices)} ${client.invoices === 1 ? 'invoice' : 'invoices'}`,
              }))}
              caption="Top clients by invoiced value"
              formatValue={money}
            />
          )}
        </Panel>
      </div>

      {/* ---- recent orders and low stock ---------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
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
          flush={recentOrders.length > 0}
        >
          {recentOrders.length === 0 ? (
            <PanelEmpty icon={Package} title="No orders yet" />
          ) : (
            <ul className="divide-y divide-line">
              {recentOrders.map((order) => (
                <li key={order.orderNumber} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-nowrap font-mono text-[12.5px] font-medium text-ink-900">
                      {order.orderNumber}
                    </p>
                    <p className="truncate text-[12px] text-ink-500">{order.businessName}</p>
                  </div>

                  <p className="hidden text-[12px] text-ink-400 sm:block">{date(order.createdAt)}</p>
                  <OrderStatusBadge status={order.status} size="sm" />

                  <p className="tnum w-20 shrink-0 text-right font-display text-[13px] font-bold">
                    {money(order.total)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Low stock"
          description={`${formatCount(inventory.lowStock)} low · ${formatCount(inventory.outOfStock)} out · ${money(inventory.value)} on hand`}
          action={
            <Link
              to="/admin/inventory?stock=low"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
            >
              Review stock
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
          flush={lowStockItems.length > 0}
        >
          {lowStockItems.length === 0 ? (
            <PanelEmpty
              icon={AlertTriangle}
              title="Stock is healthy"
              body="Nothing is at or below the reorder point."
            />
          ) : (
            <ul className="divide-y divide-line">
              {lowStockItems.map((product) => (
                <li key={product.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink-900">
                      {product.name}
                    </p>
                    <p className="font-mono text-[11px] text-ink-300">{product.sku}</p>
                  </div>

                  <p
                    className={`tnum w-20 shrink-0 text-right text-[12.5px] font-semibold ${
                      product.stock === 0 ? 'text-danger' : 'text-warn'
                    }`}
                  >
                    {product.stock === 0 ? 'Out of stock' : `${formatCount(product.stock)} left`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---- approvals queue: the reason this screen exists ---------------- */}
      {pendingQueue.length > 0 && (
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
          flush
        >
          <ul className="divide-y divide-line">
            {pendingQueue.map((account) => (
              <li key={account.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink-900">
                    {account.businessName}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-500">
                    {account.contactName} · {account.email}
                  </p>
                  <p className="text-[11.5px] text-ink-400">
                    Registered {date(account.createdAt)}
                    {account.businessType && ` · ${account.businessType}`}
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
        </Panel>
      )}
    </div>
  );
}

export default AdminOverviewPage;
