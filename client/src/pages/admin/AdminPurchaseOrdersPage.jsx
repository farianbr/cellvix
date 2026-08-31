import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useFieldArray, useForm } from 'react-hook-form';
import useCreateParam from '@/hooks/useCreateParam';
import {
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Plus,
  Send,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import ProcessStrip from '@/components/admin/ProcessStrip';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import {
  useAdminPurchaseOrders,
  useAdminSuppliers,
  useAdminInventory,
  useAdminMutations,
} from '@/hooks/useAdmin';

/**
 * Purchase orders — stock on order, what has arrived and what is outstanding
 * (ERP rework §6.8).
 *
 * The `ProcessStrip` at the foot is a status display of the purchase automation
 * cycle, not a wizard the operator drives — which is exactly why it is a
 * separate component from `StepIndicator` and never a fork of it (invariant 10).
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/purchase-orders'], icon: adminIcon('ClipboardList') };

const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  partial: 'warn',
  received: 'ok',
  cancelled: 'danger',
};

/**
 * Which stage of the cycle a list is sitting at, for the strip beneath it.
 *
 * The list shows many orders at once, so the stage reflects where the filtered
 * set mostly is rather than pretending one order is being tracked — the detail
 * page is where a single order's real stage lives.
 */
function cycleStage(status) {
  if (status === 'draft') return 'po';
  if (status === 'sent') return 'sent';
  if (status === 'partial') return 'shipment';
  if (status === 'received') return 'received';
  return 'supplier';
}

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day westward. */
function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Raise a purchase order.
 *
 * The form sends product ids, quantities and a negotiated unit cost — and
 * nothing else. Every subtotal and total is recomputed server-side, so the
 * running figure below the lines is a preview, never the number that binds
 * (invariant 8).
 */
function PurchaseOrderForm({ suppliers, products, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: {
      supplier: suppliers[0]?.id ?? '',
      orderDate: todayIso(),
      expectedDate: '',
      taxDollars: '0.00',
      shippingDollars: '0.00',
      notes: '',
      items: [{ product: '', qtyOrdered: 10, unitCostDollars: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watched = watch('items');
  const tax = Math.round(Number(watch('taxDollars') || 0) * 100);
  const shipping = Math.round(Number(watch('shippingDollars') || 0) * 100);

  const subtotal = (watched ?? []).reduce((sum, line) => {
    const qty = Number(line?.qtyOrdered ?? 0);
    const cost = Math.round(Number(line?.unitCostDollars ?? 0) * 100);
    return sum + (Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0);
  }, 0);

  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.sku} · ${product.name}`,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          control={control}
          name="supplier"
          label="Supplier"
          options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
        />
        <Input label="Order date" type="date" {...register('orderDate')} />
        <Input label="Expected" type="date" {...register('expectedDate')} />
      </div>

      <div>
        <p className="eyebrow mb-2 text-ink-400">Lines</p>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid items-end gap-2 rounded-[10px] bg-surface-2 p-2.5 sm:grid-cols-[1fr_90px_120px_auto]"
            >
              <SelectField
                control={control}
                name={`items.${index}.product`}
                label={index === 0 ? 'Product' : undefined}
                options={productOptions}
                size="sm"
              />
              <Input
                label={index === 0 ? 'Qty' : undefined}
                type="number"
                min="1"
                {...register(`items.${index}.qtyOrdered`)}
              />
              <Input
                label={index === 0 ? 'Unit cost' : undefined}
                inputMode="decimal"
                suffix="CAD"
                placeholder="0.00"
                {...register(`items.${index}.unitCostDollars`)}
              />
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                aria-label={`Remove line ${index + 1}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-line text-ink-400 transition-colors hover:border-danger/30 hover:bg-danger-50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={Plus}
          className="mt-2"
          onClick={() => append({ product: '', qtyOrdered: 10, unitCostDollars: '' })}
        >
          Add line
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Tax" inputMode="decimal" suffix="CAD" {...register('taxDollars')} />
        <Input label="Shipping" inputMode="decimal" suffix="CAD" {...register('shippingDollars')} />
      </div>

      <Textarea label="Notes" rows={2} {...register('notes')} />

      <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
        <p className="tnum flex items-baseline justify-between text-[13px] text-ink-600">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </p>
        <p className="tnum mt-1 flex items-baseline justify-between text-[13px] text-ink-600">
          <span>Tax and shipping</span>
          <span>{money(tax + shipping)}</span>
        </p>
        <p className="tnum mt-1.5 flex items-baseline justify-between border-t border-line pt-1.5 text-[14px] font-semibold text-ink-900">
          <span>Total</span>
          <span>{money(subtotal + tax + shipping)}</span>
        </p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
          A preview. Every total is recomputed on the server from the lines.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Create draft
        </Button>
      </div>
    </form>
  );
}

export function AdminPurchaseOrdersPage() {
  const [query, setQuery] = useState('');
  // Opened directly by `+ Create` (§7.2), which arrives with `?new=1`.
  const [creating, setCreating] = useCreateParam();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const status = searchParams.get('status') ?? 'all';
  const supplierId = searchParams.get('supplier') ?? '';

  const { data, isLoading } = useAdminPurchaseOrders({
    status,
    supplier: supplierId || undefined,
    q: query || undefined,
  });
  const { data: supplierData } = useAdminSuppliers({ status: 'active' });
  // Only loaded while the create form is open — the catalogue is 400+ rows and
  // nothing on the list screen itself needs it.
  const { data: inventoryData } = useAdminInventory({}, creating);
  const { createPurchaseOrder, setPurchaseOrderStatus } = useAdminMutations();

  const orders = data?.orders ?? [];
  const counts = data?.counts ?? {};
  const totals = data?.totals ?? {};
  const suppliers = supplierData?.suppliers ?? [];
  const products = inventoryData?.products ?? [];

  const overdueCount = useMemo(
    () => orders.filter((order) => order.overdue).length,
    [orders],
  );

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  }

  const columns = [
    {
      key: 'poNumber',
      header: 'PO Number',
      priority: 1,
      render: (order) => (
        <span className="block whitespace-nowrap font-mono text-[12.5px] font-medium text-ink-900">
          {order.poNumber}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      priority: 1,
      className: 'max-w-[180px] truncate',
      sortValue: (order) => order.supplier.name,
      render: (order) => order.supplier.name,
    },
    {
      key: 'orderDate',
      header: 'Order date',
      priority: 3,
      render: (order) => <span className="text-[12.5px] text-ink-500">{date(order.orderDate)}</span>,
    },
    {
      key: 'expectedDate',
      header: 'Expected',
      priority: 2,
      render: (order) =>
        order.expectedDate ? (
          <span
            className={`inline-flex items-center gap-1 text-[12.5px] ${
              order.overdue ? 'font-medium text-danger' : 'text-ink-500'
            }`}
          >
            {order.overdue && (
              <AlertTriangle className="size-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            )}
            {date(order.expectedDate)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
    {
      key: 'itemCount',
      header: 'Items',
      priority: 3,
      align: 'right',
      className: 'tnum',
      render: (order) => (
        <>
          <span className="text-[13px] text-ink-900">{formatCount(order.itemCount)}</span>
          {order.qtyOutstanding > 0 && order.status !== 'draft' && (
            <span className="block text-[11px] text-ink-400">
              {formatCount(order.qtyOutstanding)} due
            </span>
          )}
        </>
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
          <span className="text-[13px] font-medium text-ink-900">{money(order.total)}</span>
          <span
            className={`block text-[11px] ${
              order.payment.status === 'paid' ? 'text-ok' : 'text-ink-400'
            }`}
          >
            {order.payment.status === 'paid' ? 'paid' : 'unpaid'}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      render: (order) => (
        <Badge tone={STATUS_TONES[order.status]} size="sm">
          {order.status}
        </Badge>
      ),
    },
  ];

  const rowMenu = [
    {
      key: 'view',
      label: 'View order',
      icon: ClipboardList,
      onSelect: (order) => navigate(`/admin/purchase-orders/${order.id}`),
    },
    {
      key: 'send',
      label: 'Send to supplier',
      icon: Send,
      // Only a draft can be sent. The server refuses anything else regardless,
      // so this is a courtesy rather than the control (invariant 13).
      disabled: (order) => order.status !== 'draft',
      onSelect: (order) =>
        setPurchaseOrderStatus.mutate({ id: order.id, status: 'sent' }),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <>
            <Link
              to="/admin/suppliers"
              className="inline-flex h-11 select-none items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface px-5 font-display text-[14px] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
            >
              <Truck className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Suppliers
            </Link>
            <Button onClick={() => setCreating(true)} icon={Plus} disabled={!suppliers.length}>
              New purchase order
            </Button>
          </>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'draft',
            label: 'Draft',
            value: formatCount(counts.draft ?? 0),
            hint: 'Not yet sent to a supplier',
            tone: 'neutral',
            icon: ClipboardList,
          },
          {
            key: 'sent',
            label: 'Sent',
            value: formatCount(counts.sent ?? 0),
            hint: 'Awaiting delivery',
            tone: 'info',
            icon: Send,
          },
          {
            key: 'partial',
            label: 'Partial',
            value: formatCount(counts.partial ?? 0),
            hint: 'Some lines still short',
            tone: 'warn',
            icon: AlertTriangle,
          },
          {
            key: 'received',
            label: 'Received',
            value: formatCount(counts.received ?? 0),
            hint: 'Every line landed',
            tone: 'ok',
            icon: Truck,
          },
          {
            key: 'pending',
            label: 'Pending value',
            value: money(totals.pendingValue ?? 0),
            // A position, not a flow — committed and not yet landed, as of
            // today, whatever the filter says (§9).
            hint: 'Committed and not yet received, as of today',
            tone: 'brand',
            icon: Wallet,
          },
        ]}
      />

      <Panel flush className="mb-3">
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="PO number or supplier…"
          pills={PILLS.map((pill) => ({
            ...pill,
            count: pill.value === 'overdue' ? overdueCount : counts[pill.value],
          }))}
          activePill={status}
          onPillChange={(next) => setParam('status', next)}
          activeFilterCount={supplierId ? 1 : 0}
          onClearFilters={() => setParam('supplier', '')}
          filters={
            <div>
              <p className="eyebrow mb-1.5 text-ink-400">Supplier</p>
              <select
                value={supplierId}
                onChange={(event) => setParam('supplier', event.target.value)}
                className="h-9 w-full rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink-700"
              >
                <option value="">All suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          }
          onExport={(format) =>
            window.alert(
              `Export to ${format} arrives in phase 12. It will carry the current filters: ` +
                `status "${status}"${query ? `, search "${query}"` : ''}.`,
            )
          }
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={orders.length}
            noun={orders.length === 1 ? 'purchase order' : 'purchase orders'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(order) => order.id}
          rowMenu={rowMenu}
          onRowClick={(order) => navigate(`/admin/purchase-orders/${order.id}`)}
          loading={isLoading}
          defaultSort={{ key: 'orderDate', direction: 'desc' }}
          empty={
            <PanelEmpty
              icon={ClipboardList}
              title="No purchase orders match"
              body={
                suppliers.length
                  ? 'Try a different filter, or raise a new order.'
                  : 'Add a supplier first — a purchase order needs somebody to buy from.'
              }
            />
          }
        />
      </Panel>

      <ProcessStrip current={cycleStage(status)} />

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New purchase order"
        size="xl"
        align="top"
      >
        {creating && (
          <PurchaseOrderForm
            suppliers={suppliers}
            products={products}
            isPending={createPurchaseOrder.isPending}
            error={createPurchaseOrder.error?.message}
            onCancel={() => setCreating(false)}
            onSubmit={(values) =>
              createPurchaseOrder.mutate(
                {
                  supplier: values.supplier,
                  orderDate: values.orderDate || undefined,
                  expectedDate: values.expectedDate || undefined,
                  tax: Math.round(Number(values.taxDollars || 0) * 100),
                  shipping: Math.round(Number(values.shippingDollars || 0) * 100),
                  notes: values.notes || undefined,
                  items: values.items
                    .filter((line) => line.product)
                    .map((line) => ({
                      product: line.product,
                      qtyOrdered: Number(line.qtyOrdered),
                      unitCost: Math.round(Number(line.unitCostDollars || 0) * 100),
                    })),
                },
                {
                  onSuccess: (payload) => {
                    setCreating(false);
                    // Straight to the order that was just raised — the next
                    // thing an operator does is send it.
                    if (payload?.order?.id) navigate(`/admin/purchase-orders/${payload.order.id}`);
                  },
                },
              )
            }
          />
        )}
      </Modal>
    </>
  );
}

export default AdminPurchaseOrdersPage;
