import { Link, useParams } from 'react-router';
import {
  Boxes,
  ClipboardList,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Truck,
  Wallet,
} from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import DataTable from '@/components/admin/DataTable';
import { BarList } from '@/components/admin/charts/Charts';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import { useAdminSupplier } from '@/hooks/useAdmin';

/**
 * One supplier — contact details, linked products, PO history and the spend
 * chart that feeds the Supplier Prices report (ERP rework §6.7).
 *
 * The breadcrumb names the supplier rather than the type (§4b.6), which the
 * page publishes through `useRecordLabel` — the shell renders one `Breadcrumbs`
 * for every screen, so a detail page is a sibling of its trail, not a parent.
 */

const PO_STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  partial: 'warn',
  received: 'ok',
  cancelled: 'danger',
};

const TERMS_LABELS = {
  prepaid: 'Prepaid',
  net15: 'Net 15',
  net30: 'Net 30',
  net60: 'Net 60',
};

/** `2026-03` → `Mar 2026`, for the spend chart's axis. */
function monthLabel(key) {
  const [year, month] = String(key).split('-');
  const formatted = new Date(Number(year), Number(month) - 1, 1);
  return formatted.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' });
}

function ContactRow({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 text-sm text-ink-600">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function AdminSupplierProfilePage() {
  const { id } = useParams();
  const { data, isLoading, error } = useAdminSupplier(id);

  const supplier = data?.supplier;
  const orders = data?.orders ?? [];
  const products = data?.products ?? [];
  const spend = data?.spend ?? [];

  // The breadcrumb names the supplier rather than the type. It clears on
  // unmount, so a stale name cannot survive onto the next screen.
  useSetRecordLabel(supplier?.name);

  if (error) {
    return (
      <>
        <PageHeader icon={Truck} title="Supplier" />
        <Panel>
          <PanelEmpty
            icon={Truck}
            title="Supplier not found"
            body={error.message}
            action={
              <Link
                to="/admin/suppliers"
                className="inline-flex h-9 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 font-display text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
              >
                Back to suppliers
              </Link>
            }
          />
        </Panel>
      </>
    );
  }

  if (isLoading || !supplier) {
    return (
      <>
        <PageHeader icon={Truck} title="Supplier" />
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-64 animate-pulse rounded-lg bg-surface-2" />
        </div>
      </>
    );
  }

  const address = supplier.address ?? {};
  const addressLine = [address.line1, address.line2, address.city, address.region, address.postal]
    .filter(Boolean)
    .join(', ');

  // Outstanding is what has been ordered and not yet paid for — a position, not
  // a flow, so it is "as of today" regardless of any date filter (§9).
  const outstanding = orders
    .filter((order) => order.payment.status !== 'paid' && order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.total, 0);

  const openOrders = orders.filter(
    (order) => !['received', 'cancelled'].includes(order.status),
  ).length;

  const orderColumns = [
    {
      key: 'poNumber',
      header: 'PO',
      priority: 1,
      render: (order) => (
        <Link
          to={`/admin/purchase-orders/${order.id}`}
          className="whitespace-nowrap font-mono text-sm font-medium text-ink-900 hover:text-brand"
        >
          {order.poNumber}
        </Link>
      ),
    },
    {
      key: 'orderDate',
      header: 'Ordered',
      priority: 2,
      render: (order) => <span className="text-sm text-ink-500">{date(order.orderDate)}</span>,
    },
    {
      key: 'expectedDate',
      header: 'Expected',
      priority: 3,
      render: (order) =>
        order.expectedDate ? (
          <span
            className={`text-sm ${order.overdue ? 'font-medium text-danger' : 'text-ink-500'}`}
          >
            {date(order.expectedDate)}
          </span>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'itemCount',
      header: 'Lines',
      priority: 3,
      align: 'right',
      className: 'tnum',
      render: (order) => formatCount(order.itemCount),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      render: (order) => (
        <Badge tone={PO_STATUS_TONES[order.status]} size="sm">
          {order.status}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      priority: 1,
      align: 'right',
      className: 'tnum',
      render: (order) => (
        <>
          <span className="text-sm font-medium text-ink-900">{money(order.total)}</span>
          <span className="block text-2xs text-ink-400">
            {order.payment.status === 'paid' ? 'paid' : 'unpaid'}
          </span>
        </>
      ),
    },
  ];

  const productColumns = [
    { key: 'name', header: 'Product', priority: 1, className: 'max-w-[220px] truncate' },
    {
      key: 'sku',
      header: 'SKU',
      priority: 2,
      render: (product) => (
        <span className="font-mono text-xs text-ink-500">{product.sku}</span>
      ),
    },
    {
      key: 'stock',
      header: 'On hand',
      priority: 1,
      align: 'right',
      className: 'tnum',
      render: (product) => (
        <>
          <span className="text-sm text-ink-900">{formatCount(product.stock)}</span>
          {product.minStock > 0 && (
            <span className="block text-2xs text-ink-400">min {product.minStock}</span>
          )}
        </>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      priority: 2,
      align: 'right',
      className: 'tnum',
      render: (product) =>
        product.cost > 0 ? (
          money(product.cost)
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'price',
      header: 'Sell',
      priority: 3,
      align: 'right',
      className: 'tnum',
      render: (product) => money(product.price),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Truck}
        title={supplier.name}
        description={
          supplier.contactName
            ? `${supplier.contactName} · terms ${TERMS_LABELS[supplier.paymentTerms] ?? supplier.paymentTerms}`
            : `Terms ${TERMS_LABELS[supplier.paymentTerms] ?? supplier.paymentTerms}`
        }
        badge={
          <Badge tone={supplier.isActive ? 'ok' : 'neutral'} size="sm">
            {supplier.isActive ? 'active' : 'inactive'}
          </Badge>
        }
        action={
          <Link
            to="/admin/suppliers"
            className="inline-flex h-11 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
          >
            All suppliers
          </Link>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'spent',
            label: 'Total spent',
            value: money(supplier.totalSpent),
            hint: 'Across every sent and received order',
            tone: 'brand',
            icon: Wallet,
          },
          {
            key: 'orders',
            label: 'Purchase orders',
            value: formatCount(supplier.ordersCount),
            hint: `${formatCount(openOrders)} still open`,
            tone: 'info',
            icon: ClipboardList,
          },
          {
            key: 'outstanding',
            label: 'Unpaid',
            value: money(outstanding),
            // A position, not a flow — it says so rather than reading as a
            // figure belonging to some date range (§9).
            hint: 'Ordered and not yet paid, as of today',
            tone: outstanding > 0 ? 'warn' : 'ok',
            icon: Receipt,
          },
          {
            key: 'products',
            label: 'Linked products',
            value: formatCount(products.length),
            hint: 'Reorder defaults to this supplier',
            tone: 'neutral',
            icon: Boxes,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <Panel title="Contact">
            <div className="space-y-2.5">
              <ContactRow icon={Mail}>
                {supplier.email && (
                  <a href={`mailto:${supplier.email}`} className="hover:text-brand">
                    {supplier.email}
                  </a>
                )}
              </ContactRow>
              <ContactRow icon={Phone}>
                {supplier.phone && (
                  <a href={`tel:${supplier.phone}`} className="hover:text-brand">
                    {supplier.phone}
                  </a>
                )}
              </ContactRow>
              <ContactRow icon={MapPin}>{addressLine || null}</ContactRow>
              <ContactRow icon={ExternalLink}>
                {supplier.website && (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all hover:text-brand"
                  >
                    {supplier.website}
                  </a>
                )}
              </ContactRow>

              {supplier.code && (
                <p className="pt-1 text-xs text-ink-400">
                  Code <span className="font-mono text-ink-600">{supplier.code}</span>
                </p>
              )}
            </div>
          </Panel>

          {supplier.notes && (
            <Panel title="Notes">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">
                {supplier.notes}
              </p>
            </Panel>
          )}

          <Panel title="Spend by month" description="Sent and received orders only — a draft is a plan, not money.">
            <BarList
              items={spend.map((row) => ({
                label: monthLabel(row.label),
                value: row.total,
                hint: `${formatCount(row.count)} order${row.count === 1 ? '' : 's'}`,
              }))}
              caption="Spend by month"
              formatValue={money}
            />
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Purchase orders" flush>
            <DataTable
              columns={orderColumns}
              rows={orders}
              rowKey={(order) => order.id}
              defaultSort={{ key: 'orderDate', direction: 'desc' }}
              empty={
                <PanelEmpty
                  icon={ClipboardList}
                  title="No purchase orders"
                  body="Nothing has been ordered from this supplier yet."
                />
              }
            />
          </Panel>

          <Panel
            title="Linked products"
            description="Parts whose reorder defaults to this supplier."
            flush
          >
            <DataTable
              columns={productColumns}
              rows={products}
              rowKey={(product) => product.id}
              empty={
                <PanelEmpty
                  icon={Boxes}
                  title="No linked products"
                  body="Set a default supplier on a product from the Inventory screen."
                />
              }
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

export default AdminSupplierProfilePage;
