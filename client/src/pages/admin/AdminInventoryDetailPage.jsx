import { Link, useParams } from 'react-router';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  MapPin,
  Truck,
  Wallet,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, dateTime, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import { PartVisual } from '@/components/product/PartFrame';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import Pagination from '@/components/ui/Pagination';
import useTablePage from '@/hooks/useTablePage';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import { useAdminInventoryItem } from '@/hooks/useAdmin';
import Skeleton from '@/components/ui/Skeleton';
import { pressable } from '@/lib/motion';

/**
 * One product, seen from the warehouse (ERP rework §6.10).
 *
 * Fields, taxonomy, competitor benchmarks, the stock movement history and the
 * purchase history that is this part's real price history. Everything here is
 * admin-only — the storefront's product page shows in stock / out of stock and
 * nothing on this screen changes that.
 */

const STOCK_TONES = { in: 'ok', low: 'warn', out: 'danger' };
const STOCK_LABELS = { in: 'in stock', low: 'low stock', out: 'out of stock' };

const MOVEMENT_LABELS = {
  purchase: 'Received',
  sale: 'Sold',
  adjustment: 'Adjustment',
  return: 'Returned',
  damage: 'Damaged',
  transfer: 'Transfer',
};

const PO_STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  partial: 'warn',
  received: 'ok',
  cancelled: 'danger',
};

export function AdminInventoryDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useAdminInventoryItem(id);

  const product = data?.product;
  const movements = data?.movements ?? [];
  const purchases = data?.purchases ?? [];

  const purchasePage = useTablePage(purchases);

  useSetRecordLabel(product?.name);

  if (error) {
    return (
      <>
        <PageHeader icon={Boxes} title="Product" />
        <Panel>
          <PanelEmpty
            icon={Boxes}
            title="Product not found"
            body={error.message}
            action={
              <Link
                to="/admin/inventory"
                className={cn(pressable, 'inline-flex h-9 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 font-display text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2')}
              >
                Back to inventory
              </Link>
            }
          />
        </Panel>
      </>
    );
  }

  if (isLoading || !product) {
    return (
      <>
        <PageHeader icon={Boxes} title="Product" />
        <div className="space-y-3">
          <Skeleton className="h-24" rounded="lg" />
          <Skeleton className="h-64" rounded="lg" />
        </div>
      </>
    );
  }

  const margin =
    product.cost > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : null;

  const purchaseColumns = [
    {
      key: 'poNumber',
      header: 'PO',
      priority: 1,
      render: (row) => (
        <Link
          to={`/admin/purchase-orders/${row.id}`}
          className="whitespace-nowrap font-mono text-sm font-medium text-ink-900 hover:text-brand"
        >
          {row.poNumber}
        </Link>
      ),
    },
    { key: 'supplier', header: 'Supplier', priority: 2, className: 'max-w-[160px] truncate' },
    {
      key: 'orderDate',
      header: 'Ordered',
      priority: 3,
      render: (row) => <span className="text-sm text-ink-500">{date(row.orderDate)}</span>,
    },
    {
      key: 'qtyReceived',
      header: 'Received',
      priority: 2,
      align: 'right',
      className: 'tnum',
      render: (row) => `${formatCount(row.qtyReceived)} / ${formatCount(row.qtyOrdered)}`,
    },
    {
      key: 'status',
      header: 'Status',
      priority: 3,
      render: (row) => (
        <Badge tone={PO_STATUS_TONES[row.status]} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'unitCost',
      header: 'Unit cost',
      priority: 1,
      align: 'right',
      className: 'tnum font-medium text-ink-900',
      render: (row) => money(row.unitCost),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Boxes}
        title={product.name}
        description={`${product.brandName ?? ''} ${product.modelName ?? ''} · ${product.partTypeLabel}`.trim()}
        badge={
          <>
            <Badge tone={STOCK_TONES[product.stockStatus]} size="sm">
              {STOCK_LABELS[product.stockStatus]}
            </Badge>
            {!product.isActive && (
              <Badge tone="neutral" size="sm">
                hidden
              </Badge>
            )}
          </>
        }
        action={
          <Link
            to="/admin/inventory"
            className={cn(pressable, 'inline-flex h-11 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2')}
          >
            All inventory
          </Link>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'stock',
            label: 'On hand',
            value: formatCount(product.stock),
            hint:
              product.minStock > 0
                ? `Reorder point ${formatCount(product.minStock)}`
                : 'No reorder point set',
            tone: STOCK_TONES[product.stockStatus],
            icon: Boxes,
          },
          {
            key: 'price',
            label: 'Unit price',
            value: money(product.price),
            hint: 'What a client pays',
            tone: 'brand',
            icon: Wallet,
          },
          {
            key: 'cost',
            label: 'Unit cost',
            value: product.cost > 0 ? money(product.cost) : '—',
            hint: margin === null ? 'No cost recorded yet' : `${margin}% margin`,
            tone: 'warn',
            icon: Wallet,
          },
          {
            key: 'value',
            label: 'Stock value',
            value: money(product.totalValue),
            hint: 'Quantity × cost',
            tone: 'ok',
            icon: Wallet,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <Panel title="Product">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 p-1.5">
                <PartVisual product={product} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-500">{product.sku}</p>
                <p className="mt-0.5 text-xs text-ink-400">{product.grade}</p>
              </div>
            </div>

            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-400">Device</dt>
                <dd className="text-right text-ink-700">{product.deviceTypeName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-400">Brand</dt>
                <dd className="text-right text-ink-700">{product.brandName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-400">Series</dt>
                <dd className="text-right text-ink-700">{product.seriesName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-400">Model</dt>
                <dd className="text-right text-ink-700">{product.modelName ?? '—'}</dd>
              </div>
              {product.barcode && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-400">Barcode</dt>
                  <dd className="text-right font-mono text-ink-700">{product.barcode}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title="Warehouse">
            <dl className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-300" strokeWidth={2.25} aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-ink-400">Location</dt>
                  <dd className="text-ink-700">{product.location ?? 'Not set'}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 size-3.5 shrink-0 text-ink-300" strokeWidth={2.25} aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-ink-400">Default supplier</dt>
                  <dd className="text-ink-700">
                    {product.supplier ? (
                      <Link
                        to={`/admin/suppliers/${product.supplier.id}`}
                        className="hover:text-brand"
                      >
                        {product.supplier.name}
                      </Link>
                    ) : (
                      'Not set'
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          </Panel>

          {product.competitors.length > 0 && (
            <Panel
              title="Market benchmarks"
              description="What the same part costs at named rivals."
            >
              <ul className="space-y-1.5">
                {product.competitors.map((competitor) => (
                  <li
                    key={competitor.name}
                    className="tnum flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink-600">{competitor.name}</span>
                    <span
                      className={cn(
                        'shrink-0 font-medium',
                        competitor.price > product.price ? 'text-ok' : 'text-ink-900',
                      )}
                    >
                      {money(competitor.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-3">
          <Panel
            title="Purchase history"
            description="What this part has cost, per delivery."
            flush
          >
            <div className="border-b border-line px-3 py-2 sm:px-4">
              <CountLine
                total={purchases.length}
                shown={purchasePage.pageRows.length}
                from={purchasePage.from}
                noun={purchases.length === 1 ? 'delivery' : 'deliveries'}
              />
            </div>

            <DataTable
              columns={purchaseColumns}
              rows={purchasePage.pageRows}
              rowKey={(row) => row.id}
              defaultSort={{ key: 'orderDate', direction: 'desc' }}
              empty={
                <PanelEmpty
                  icon={ClipboardList}
                  title="Never ordered"
                  body="This part has not appeared on a purchase order yet."
                />
              }
            />

            <Pagination
              page={purchasePage.page}
              pages={purchasePage.totalPages}
              onChange={purchasePage.setPage}
              hideWhenSingle
              className="border-t border-line px-3 py-3 sm:px-4"
            />
          </Panel>

          <Panel
            title="Stock movements"
            description="Every change to the quantity on hand, with its reason."
            flush
          >
            {movements.length ? (
              <ul className="divide-y divide-line">
                {movements.map((movement) => {
                  const positive = movement.qtyChange > 0;
                  const Icon = positive ? ArrowUpRight : ArrowDownRight;
                  return (
                    <li key={movement.id} className="flex items-start gap-3 px-4 py-3">
                      <span
                        className={cn(
                          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                          positive ? 'bg-ok-50 text-ok' : 'bg-warn-50 text-warn',
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-2 text-sm">
                          <span className="text-ink-900">
                            {MOVEMENT_LABELS[movement.type] ?? movement.type}
                          </span>
                          <span
                            className={cn('tnum font-medium', positive ? 'text-ok' : 'text-warn')}
                          >
                            {positive ? '+' : ''}
                            {movement.qtyChange}
                          </span>
                          <span className="tnum text-xs text-ink-400">
                            {movement.qtyAfter} on hand after
                          </span>
                        </p>

                        <p className="mt-0.5 text-xs text-ink-400">
                          {dateTime(movement.at)}
                          {movement.reference?.label ? ` · ${movement.reference.label}` : ''}
                          {movement.unitCost ? ` · ${money(movement.unitCost)} each` : ''}
                        </p>

                        {movement.note && (
                          <p className="mt-0.5 text-xs text-ink-500">{movement.note}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <PanelEmpty
                icon={AlertCircle}
                title="No movements recorded"
                body="Receiving a purchase order or adjusting stock records a movement here."
              />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default AdminInventoryDetailPage;
