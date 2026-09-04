import { useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Check,
  Clock,
  Mail,
  Package,
  Phone,
  Receipt,
  Undo2,
  UserCheck,
  Wallet,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, moneyCompact, moneyAxis, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import DateRangeBar, { DASHBOARD_PRESETS, useDateRange } from '@/components/admin/DateRangeBar';
import { TrendChart, BarList } from '@/components/admin/charts/Charts';
import ApproveClientForm from '@/components/admin/ApproveClientForm';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAuth } from '@/hooks/useAuth';

import { useAdminStats, useAdminMutations } from '@/hooks/useAdmin';

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
      className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${tones[tone]}`}
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-md font-semibold text-ink-900">{title}</span>
        <span className="block text-sm text-ink-500">{body}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">
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

/**
 * A recent order, read without leaving the dashboard.
 *
 * `stats` already returns the whole serialised order — lines, totals, address,
 * status — so the preview needs no second request and opens instantly. It is
 * deliberately **read-only**: changing a status is the order screen's job, and
 * the footer link goes there rather than growing a second place that edits an
 * order.
 */
function OrderPreview({ order, onClose }) {
  if (!order) return null;

  const lines = order.items ?? [];

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={order.orderNumber}
      description={`${order.businessName} · ${date(order.createdAt)}`}
      size="md"
      align="top"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} size="sm" />
          {order.payment?.status && (
            <Badge tone={order.payment.status === 'paid' ? 'ok' : 'warn'} size="sm">
              {order.payment.status === 'paid' ? 'Paid' : titleCase(order.payment.status)}
            </Badge>
          )}
          {order.poNumber && (
            <span className="text-xs text-ink-400">PO {order.poNumber}</span>
          )}
        </div>

        {lines.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line">
            {lines.map((item, index) => (
              <li
                key={item.sku ?? item.product ?? index}
                className="flex items-center gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{item.name}</p>
                  {item.sku && <p className="font-mono text-2xs text-ink-300">{item.sku}</p>}
                </div>

                <p className="tnum shrink-0 text-xs text-ink-500">×{formatCount(item.qty)}</p>
                {/* `lineTotal` is the server's own figure, not qty × unitPrice
                    recomputed here — the client never does money arithmetic. */}
                <p className="tnum w-20 shrink-0 text-right text-sm font-semibold text-ink-900">
                  {money(item.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Totals repeat the server's stored figures — nothing is recomputed
            here, so the preview can never disagree with the order. */}
        <dl className="space-y-1.5 text-sm">
          <Row label="Subtotal" value={money(order.subtotal)} />
          {order.discount > 0 && (
            <Row label="Discount" value={`−${money(order.discount)}`} tone="ok" />
          )}
          {order.storeCreditApplied > 0 && (
            <Row label="Store credit" value={`−${money(order.storeCreditApplied)}`} tone="ok" />
          )}
          <Row label="Shipping" value={money(order.shipping)} />
          <Row label="Tax" value={money(order.tax)} />
          <div className="flex items-baseline justify-between border-t border-line pt-1.5">
            <dt className="font-display text-md font-bold text-ink-900">Total</dt>
            <dd className="tnum font-display text-lg font-bold text-ink-900">
              {money(order.total)}
            </dd>
          </div>
        </dl>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Link to={`/admin/orders/${order.orderNumber}`}>
            <Button icon={ArrowUpRight}>Open order</Button>
          </Link>
        </div>
      </div>
    </Modal>
  );
}

/** One totals line. Kept local: nothing outside this preview needs it. */
function Row({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className={cn('tnum font-medium', tone === 'ok' ? 'text-ok' : 'text-ink-900')}>
        {value}
      </dd>
    </div>
  );
}

/** Up to two initials for the avatar. `—` for a name that is somehow empty. */
function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}

/** `awaiting_payment` reads as `Awaiting payment` on a badge. */
function titleCase(value) {
  const spaced = String(value).replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function AdminOverviewPage() {
  const { user } = useAuth();
  // The range lives in the URL, so the whole dashboard is linkable (§6.1.2).
  const range = useDateRange('this-month');
  const { data, isLoading } = useAdminStats(range);

  const [previewing, setPreviewing] = useState(null);
  const [approving, setApproving] = useState(null);
  // The same mutation the approvals queue and the notification bell use —
  // approving from here is the identical act, so it must not be a second path.
  const { approveUser } = useAdminMutations();

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
        <p className="rounded-lg border border-ok/25 bg-ok-50 px-4 py-3 text-sm text-ok">
          Nothing needs attention: every account is reviewed, every order is moving, stock is
          healthy and no invoice is overdue.
        </p>
      )}

      {/* ---- the headline figures ------------------------------------------
          Collected and Invoiced are named separately and never collapsed into
          one word called "revenue" (§9.1). Outstanding and Inventory are
          positions as of today rather than flows through the range, and their
          hints say so.

          Every tile carries `to`, and each one lands on the list **filtered to
          the figure it just showed** rather than the section's front page — a
          tile reading "3 overdue" that opens all invoices makes the operator
          re-find the three they clicked for. */}
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
            to: '/admin/invoices?status=paid',
          },
          {
            key: 'invoiced',
            label: 'Invoiced',
            value: money(invoiced.total),
            hint: `${formatCount(invoiced.count)} ${invoiced.count === 1 ? 'invoice' : 'invoices'} issued`,
            tone: 'brand',
            icon: Receipt,
            to: '/admin/invoices',
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
            to: receivables.overdue > 0 ? '/admin/invoices?status=overdue' : '/admin/invoices?status=unpaid',
          },
          {
            key: 'refunds',
            label: 'Refunds',
            // Its own tile, never a negative folded into a revenue figure (§9.2).
            value: money(refunds.total),
            hint: `${formatCount(refunds.count)} refunded to store credit`,
            tone: refunds.total > 0 ? 'warn' : 'info',
            icon: Undo2,
            to: '/admin/rma',
          },
          {
            key: 'orders',
            label: 'Open orders',
            value: formatCount(orders.open),
            hint: `${formatCount(orders.awaitingFulfilment)} awaiting fulfilment`,
            tone: 'info',
            icon: Package,
            to: '/admin/orders?status=placed',
          },
          {
            key: 'clients',
            label: 'Clients',
            value: formatCount(users.total),
            hint: `${formatCount(users.approved)} approved · ${formatCount(users.pending)} pending`,
            tone: 'info',
            icon: Building2,
            to: '/admin/clients',
          },
          {
            key: 'inventory',
            label: 'Inventory',
            // Also a position rather than a flow, like Outstanding above.
            value: moneyCompact(inventory.value),
            hint: `Value of ${formatCount(inventory.total)} SKUs · as of today`,
            tone: 'info',
            icon: Boxes,
            to: '/admin/inventory',
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
            seriesLabel="Order value"
            // The tooltip shows the exact figure; the axis and the peak/low
            // line round, because a tick column is read as a scale rather than
            // as a set of values.
            formatValue={money}
            formatTick={moneyAxis}
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
              rank
              // Share of the top-five total, not of all invoicing — the panel
              // says "Top clients", so that is the whole this reads against.
              showShare
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
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
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
            /* A row opens the preview rather than navigating: glancing at what
               is in an order is the common act, and bouncing to a full screen
               and back for each of six orders is the slow way to do it. The
               preview's footer navigates for the times it is warranted. */
            <ul className="divide-y divide-line">
              {recentOrders.map((order) => (
                <li key={order.orderNumber}>
                  <button
                    type="button"
                    onClick={() => setPreviewing(order)}
                    className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-nowrap font-mono text-sm font-medium text-ink-900">
                        {order.orderNumber}
                      </p>
                      <p className="truncate text-xs text-ink-500">{order.businessName}</p>
                    </div>

                    <p className="hidden text-xs text-ink-400 sm:block">
                      {date(order.createdAt)}
                    </p>
                    <OrderStatusBadge status={order.status} size="sm" />

                    <p className="tnum w-20 shrink-0 text-right font-display text-sm font-bold">
                      {money(order.total)}
                    </p>

                    <ArrowUpRight
                      className="size-3.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>
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
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
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
                    <p className="truncate text-sm font-medium text-ink-900">
                      {product.name}
                    </p>
                    <p className="font-mono text-2xs text-ink-300">{product.sku}</p>
                  </div>

                  <p
                    className={`tnum w-20 shrink-0 text-right text-sm font-semibold ${
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

      {/* ---- approvals queue: the reason this screen exists ----------------

          Cards rather than a list, and the approval happens **here**.

          Each waiting business is a decision, not a row of text: the operator
          needs the industry it is in, who to call and how long it has been sitting
          before they can answer. So each card leads with an avatar and the
          business name, states the contact channels as their own labelled
          lines, and marks anything waiting over a week — the queue's real
          failure mode is an account nobody looked at, and a plain list of names
          hides that completely.

          `Approve` opens the same `ApproveClientForm` the queue and the bell
          use, so credit limit and terms are still set as part of approving
          (§7.3) — an approve button here that skipped them would be the exact
          mistake the shared form exists to prevent. The profile itself is a
          link to the client record, because the answer to "who are these
          people" is usually one screen away. */}
      {pendingQueue.length > 0 && (
        <Panel
          title="Approvals queue"
          description={`${formatCount(users.pending)} ${users.pending === 1 ? 'business is' : 'businesses are'} waiting. They cannot see pricing or order until approved.`}
          action={
            <Link
              to="/admin/approvals"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
            >
              Open queue
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
        >
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {pendingQueue.map((account) => {
              // Days waiting, floored: "waiting 8 days" is the fact that makes
              // somebody act, and it is the one thing a name-only row omits.
              const waitingDays = Math.floor(
                (Date.now() - new Date(account.createdAt).getTime()) / 86_400_000,
              );
              const stale = waitingDays >= 7;

              return (
                <li
                  key={account.id}
                  className="flex flex-col rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-50 font-display text-sm font-bold text-brand-700"
                      aria-hidden="true"
                    >
                      {initials(account.businessName)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/clients/${account.id}`}
                        className="block truncate font-display text-md font-bold text-ink-900 hover:text-brand"
                      >
                        {account.businessName}
                      </Link>
                      <p className="truncate text-xs text-ink-500">{account.contactName}</p>
                    </div>

                    {stale && (
                      <Badge tone="warn" size="sm">
                        {waitingDays}d
                      </Badge>
                    )}
                  </div>

                  <ul className="mt-2.5 space-y-1 text-xs text-ink-500">
                    <li className="flex items-center gap-1.5">
                      <Mail className="size-3.5 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                      <span className="truncate">{account.email}</span>
                    </li>
                    {account.phone && (
                      <li className="flex items-center gap-1.5">
                        <Phone className="size-3.5 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                        <span className="truncate">{account.phone}</span>
                      </li>
                    )}
                    <li className={cn('flex items-center gap-1.5', stale && 'text-warn')}>
                      <Clock className="size-3.5 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                      <span className="truncate">
                        {waitingDays === 0
                          ? 'Registered today'
                          : `Waiting ${waitingDays} ${waitingDays === 1 ? 'day' : 'days'}`}
                        {account.businessType && ` · ${account.businessType}`}
                      </span>
                    </li>
                  </ul>

                  {/* `mt-auto` keeps the buttons on one baseline across a row of
                      cards whose contact blocks differ in height. */}
                  <div className="mt-auto flex gap-2 pt-3">
                    <Button
                      size="xs"
                      icon={Check}
                      className="flex-1"
                      onClick={() => setApproving(account)}
                    >
                      Approve
                    </Button>
                    <Link to={`/admin/clients/${account.id}`} className="flex-1">
                      <Button size="xs" variant="outline" className="w-full">
                        View
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <OrderPreview order={previewing} onClose={() => setPreviewing(null)} />

      <Modal
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        title="Approve business account"
        size="md"
        align="top"
      >
        {approving && (
          <ApproveClientForm
            user={approving}
            isPending={approveUser.isPending}
            error={approveUser.error?.message}
            onCancel={() => setApproving(null)}
            onSubmit={(body) =>
              approveUser.mutate(
                { id: approving.id, ...body },
                // The mutation invalidates the whole `['admin']` subtree, so the
                // dashboard refetches and the card leaves on its own.
                { onSuccess: () => setApproving(null) },
              )
            }
          />
        )}
      </Modal>
    </div>
  );
}

export default AdminOverviewPage;
