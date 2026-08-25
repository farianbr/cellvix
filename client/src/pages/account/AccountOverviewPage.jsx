import { Link } from 'react-router';
import {
  ArrowRight,
  Bookmark,
  FileText,
  Package,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, moneyCompact, date, count as formatCount } from '@/lib/format';
import Panel, { StatTile, PanelEmpty } from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import PartIllustration from '@/components/product/PartIllustration';
import { useAccountSummary, useAccountMutations } from '@/hooks/useAccount';
import { useCart } from '@/hooks/useCart';
import useUiStore from '@/store/uiStore';

/** Credit utilisation meter — the one place the gradient earns a progress fill. */
function CreditMeter({ credit }) {
  const tone = credit.utilisation >= 85 ? 'danger' : credit.utilisation >= 60 ? 'warn' : 'ok';

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow text-ink-400">Available credit</p>
          <p className="tnum mt-1 font-display text-[26px] font-bold leading-none text-ink-900">
            {money(credit.available)}
          </p>
        </div>
        <p className="tnum text-right text-[12.5px] text-ink-500">
          of {money(credit.limit)}
          <span className="block text-ink-400">{credit.terms.replace('net', 'Net ')}</span>
        </p>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-valuenow={credit.utilisation}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Credit used"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            tone === 'danger' ? 'bg-danger' : tone === 'warn' ? 'bg-warn' : 'bg-brand-gradient',
          )}
          style={{ width: `${Math.max(2, credit.utilisation)}%` }}
        />
      </div>

      <p className="tnum mt-2 text-[12px] text-ink-400">
        {money(credit.balance)} drawn · {credit.utilisation}% of limit
      </p>
    </div>
  );
}

export function AccountOverviewPage() {
  const { data, isLoading } = useAccountSummary();
  const { addItem } = useCart();
  const { restoreSavedCart } = useAccountMutations();
  const openCart = useUiStore((s) => s.openCart);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const { credit, invoices, stats, recentOrders, quickReorder, savedCarts } = data;

  return (
    <div className="space-y-4">
      {/* ---- stat row ----------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open orders"
          value={formatCount(stats.openOrders)}
          hint={`${formatCount(stats.orderCount)} lifetime`}
          icon={Package}
        />
        <StatTile
          label="Available credit"
          value={moneyCompact(credit.available)}
          hint={`${credit.utilisation}% of ${moneyCompact(credit.limit)} used`}
          tone={credit.utilisation >= 85 ? 'danger' : 'neutral'}
          icon={Wallet}
        />
        <StatTile
          label="Outstanding"
          value={moneyCompact(invoices.outstandingAmount)}
          hint={`${invoices.outstandingCount} open ${invoices.outstandingCount === 1 ? 'invoice' : 'invoices'}`}
          icon={FileText}
        />
        <StatTile
          label="Overdue"
          value={moneyCompact(invoices.overdueAmount)}
          hint={
            invoices.overdueCount > 0
              ? `${invoices.overdueCount} past due date`
              : 'Nothing past due'
          }
          tone={invoices.overdueCount > 0 ? 'danger' : 'ok'}
          icon={FileText}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ---- recent orders --------------------------------------------- */}
        <Panel
          title="Recent orders"
          action={
            <Link
              to="/account/orders"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
            >
              View all
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
          flush
        >
          {recentOrders.length === 0 ? (
            <PanelEmpty
              icon={Package}
              title="No orders yet"
              body="Your order history and tracking will appear here."
              action={
                <Link to="/">
                  <Button variant="outline" size="sm">
                    Browse parts
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {recentOrders.map((order) => (
                <li key={order.orderNumber}>
                  <Link
                    to={`/account/orders/${order.orderNumber}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[12.5px] font-medium text-ink-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {date(order.createdAt)} · {order.items.length}{' '}
                        {order.items.length === 1 ? 'line' : 'lines'}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                    <p className="tnum w-20 shrink-0 text-right font-display text-[13.5px] font-bold">
                      {money(order.total)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ---- credit + rep ---------------------------------------------- */}
        <div className="space-y-4">
          <Panel title="Credit">
            <CreditMeter credit={credit} />
          </Panel>

          {savedCarts.length > 0 && (
            <Panel title="Saved carts" flush>
              <ul className="divide-y divide-line">
                {savedCarts.map((cart) => (
                  <li key={cart.id} className="flex items-center gap-3 px-4 py-3">
                    <Bookmark className="size-4 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">{cart.name}</p>
                      <p className="tnum text-[12px] text-ink-400">
                        {cart.itemCount} items · {date(cart.createdAt)}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      loading={restoreSavedCart.isPending}
                      onClick={() => {
                        restoreSavedCart.mutate(cart.id);
                        openCart();
                      }}
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      {/* ---- quick reorder ------------------------------------------------ */}
      <Panel
        title="Quick reorder"
        description="The parts this account buys most often."
        action={
          <Link
            to="/account/quick-order"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
          >
            Bulk order pad
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        }
      >
        {quickReorder.length === 0 ? (
          <PanelEmpty
            icon={RotateCcw}
            title="Nothing to reorder yet"
            body="Once you have ordered a few times, your regular parts show up here for one-click reordering."
          />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {quickReorder.map((product) => (
              <li
                key={product.id}
                className="flex items-center gap-3 rounded-[11px] border border-line p-2.5"
              >
                <Link
                  to={`/product/${product.slug}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 p-1.5"
                >
                  <PartIllustration partType={product.partType} />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${product.slug}`}
                    className="line-clamp-1 text-[13px] font-medium text-ink-900 hover:text-brand"
                  >
                    {product.name}
                  </Link>
                  <p className="tnum text-[11.5px] text-ink-400">
                    {money(product.price)} · ordered {product.timesOrdered}×
                  </p>
                </div>

                <Button
                  size="xs"
                  variant="brandSoft"
                  icon={RotateCcw}
                  disabled={!product.inStock}
                  onClick={() => {
                    addItem(product, 1);
                    openCart();
                  }}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default AccountOverviewPage;
