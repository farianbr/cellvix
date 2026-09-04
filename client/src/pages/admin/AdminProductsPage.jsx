import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  Boxes,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  SlidersHorizontal,
  Truck,
  Wallet,
} from 'lucide-react';
import cn from '@/lib/cn';
import useCreateParam from '@/hooks/useCreateParam';
import { money, date, count as formatCount } from '@/lib/format';
import { GRADE_ORDER, GRADES, LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { optionsFor } from '@/lib/taxonomy';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import SelectMenu from '@/components/ui/SelectMenu';
import SelectField from '@/components/ui/SelectField';
import Checkbox from '@/components/ui/Checkbox';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { PartVisual } from '@/components/product/PartFrame';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useTaxonomy } from '@/hooks/useCatalog';
import downloadExport from '@/lib/exportDownload';
import { pressable } from '@/lib/motion';
import {
  useAdminInventory,
  useAdminSuppliers,
  useAdminMutations,
} from '@/hooks/useAdmin';

/**
 * Inventory (ERP rework §6.10).
 *
 * Reads `GET /admin/inventory`, which returns exact quantities, reorder points,
 * cost and inventory value — all admin-only. **The storefront still shows only
 * in stock / out of stock**, never a count and never a date; that payload is
 * produced by `productService.serialize`, which is an allowlist, so nothing
 * added to this screen can leak into a public response.
 *
 * The counts and the KPI row describe the **whole catalogue**, not the filtered
 * set: a pill reading "Low stock 0" because you are already filtered to Out of
 * stock tells the operator nothing.
 */
const STOCK_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
];

const STOCK_TONES = { in: 'ok', low: 'warn', out: 'danger' };
const STOCK_LABELS = { in: 'in stock', low: 'low', out: 'out of stock' };

const GRADE_OPTIONS = GRADE_ORDER.map((grade) => ({
  value: grade,
  label: GRADES[grade]?.label ?? grade,
}));

/**
 * Product form.
 *
 * The four taxonomy selects cascade — picking a brand narrows the series list —
 * so a product cannot be filed under a model that does not belong to its brand.
 * That mis-filing would be invisible in this form but would break the shop's
 * filter hierarchy, which reads the same four slugs.
 */
function ProductForm({ product, tree, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, watch, setValue, formState, control } = useForm({
    defaultValues: {
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      description: product?.description ?? '',
      partType: product?.partType ?? '',
      partTypeLabel: product?.partTypeLabel ?? '',
      grade: product?.grade ?? 'NEW',
      priceDollars: product ? (product.price / 100).toFixed(2) : '',
      stock: product?.stock ?? 0,
      deviceTypeSlug: product?.deviceTypeSlug ?? '',
      brandSlug: product?.brandSlug ?? '',
      seriesSlug: product?.seriesSlug ?? '',
      modelSlug: product?.modelSlug ?? '',
      isActive: product?.isActive ?? true,
    },
  });

  const path = {
    deviceType: watch('deviceTypeSlug'),
    brand: watch('brandSlug'),
    series: watch('seriesSlug'),
    model: watch('modelSlug'),
  };

  const deviceTypes = optionsFor(tree, path, 'deviceType');
  const brands = optionsFor(tree, path, 'brand');
  const seriesList = optionsFor(tree, path, 'series');
  const models = optionsFor(tree, path, 'model');

  // Clear the levels below whichever one changed, so a stale model cannot
  // survive a brand switch.
  function pick(level, value) {
    const order = ['deviceTypeSlug', 'brandSlug', 'seriesSlug', 'modelSlug'];
    const index = order.indexOf(level);
    setValue(level, value);
    for (const below of order.slice(index + 1)) setValue(below, '');
  }

  const toOptions = (nodes, placeholder) => [
    { value: '', label: placeholder },
    ...nodes.map((node) => ({ value: node.slug, label: node.name })),
  ];

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          ...values,
          price: Math.round(Number(values.priceDollars) * 100) || 0,
          stock: Number(values.stock) || 0,
        }),
      )}
      className="space-y-4"
    >
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="SKU"
          placeholder="CVX-SAM-SA-1224"
          className="font-mono"
          error={formState.errors.sku?.message}
          data-autofocus
          {...register('sku', { required: 'Enter a SKU.' })}
        />
        <SelectField control={control} name="grade" label="Grade" options={GRADE_OPTIONS} />
      </div>

      <Input
        label="Product name"
        placeholder="Galaxy S23 Ultra Screen Assembly"
        error={formState.errors.name?.message}
        {...register('name', { required: 'Enter a name.' })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Component type slug"
          placeholder="screen-assembly"
          className="font-mono"
          {...register('partType', { required: true })}
        />
        <Input
          label="Component type label"
          placeholder="Screen Assembly"
          {...register('partTypeLabel', { required: true })}
        />
      </div>

      <fieldset className="rounded-md border border-line p-3.5">
        <legend className="eyebrow px-1 text-ink-400">Fitment</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectMenu
            label="Device type"
            size="md"
            align="left"
            options={toOptions(deviceTypes, 'Select…')}
            value={path.deviceType}
            onChange={(next) => pick('deviceTypeSlug', next)}
          />
          <SelectMenu
            label="Brand"
            size="md"
            align="left"
            options={toOptions(brands, path.deviceType ? 'Select…' : 'Pick a device type first')}
            value={path.brand}
            disabled={!path.deviceType}
            onChange={(next) => pick('brandSlug', next)}
          />
          <SelectMenu
            label="Series"
            size="md"
            align="left"
            options={toOptions(seriesList, path.brand ? 'Select…' : 'Pick a brand first')}
            value={path.series}
            disabled={!path.brand}
            onChange={(next) => pick('seriesSlug', next)}
          />
          <SelectMenu
            label="Model"
            size="md"
            align="left"
            options={toOptions(models, path.series ? 'Select…' : 'Pick a series first')}
            value={path.model}
            disabled={!path.series}
            onChange={(next) => pick('modelSlug', next)}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Price"
          inputMode="decimal"
          suffix="CAD"
          error={formState.errors.priceDollars?.message}
          {...register('priceDollars', { required: 'Enter a price.' })}
        />
        <Input
          label="Stock on hand"
          inputMode="numeric"
          hint="The storefront only shows in stock or out of stock."
          {...register('stock')}
        />
      </div>

      <Input label="Description" {...register('description')} />

      <Checkbox label="Listed on the storefront" className="-ml-2" {...register('isActive')} />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={isPending}
          disabled={!path.deviceType || !path.brand || !path.series || !path.model}
        >
          {product ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}

/**
 * The operations fields (§6.10) — reorder point, cost, bin, default supplier
 * and barcode.
 *
 * Deliberately a separate form from `ProductForm`: the catalogue form owns what
 * a buyer sees and this one owns what the warehouse sees, and a single form
 * writing both would let one screen's stale copy overwrite the other's fields.
 */
function OpsForm({ product, suppliers, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      minStock: product?.minStock ?? 0,
      costDollars: product?.cost ? (product.cost / 100).toFixed(2) : '',
      location: product?.location ?? '',
      supplier: product?.supplier?.id ?? '',
      barcode: product?.barcode ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-md bg-surface-2 p-3.5">
        <p className="text-sm font-medium text-ink-900">{product.name}</p>
        <p className="font-mono text-xs text-ink-400">{product.sku}</p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Reorder point"
          type="number"
          min="0"
          hint="Zero means no point set."
          {...register('minStock')}
        />
        <Input
          label="Unit cost"
          inputMode="decimal"
          suffix="CAD"
          placeholder="0.00"
          {...register('costDollars')}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Location" placeholder="A-12-3" {...register('location')} />
        <Input label="Barcode" {...register('barcode')} />
      </div>

      <SelectField
        control={control}
        name="supplier"
        label="Default supplier"
        options={[
          { value: '', label: 'None' },
          ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
        ]}
      />

      <p className="rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-500">
        Cost is what Cellvix pays, and is separate from the price a client pays. Receiving a purchase
        order updates it automatically from what the delivery actually cost.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

/**
 * A manual stock correction.
 *
 * Signed, and the reason is required — "why is this 40 and not 47" is a
 * question somebody asks later, and an unexplained correction cannot answer it.
 * The change goes through the same ledger every receipt does.
 */
function AdjustForm({ product, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: { qtyChange: '', type: 'adjustment', note: '' },
  });

  const delta = Number(watch('qtyChange') || 0);
  const projected = product.stock + (Number.isFinite(delta) ? delta : 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-md bg-surface-2 p-3.5">
        <p className="text-sm font-medium text-ink-900">{product.name}</p>
        <p className="tnum mt-0.5 text-xs text-ink-500">
          <span className="font-mono">{product.sku}</span> · {formatCount(product.stock)} on hand
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Change"
          type="number"
          placeholder="-3"
          hint="Negative removes stock."
          {...register('qtyChange')}
        />
        <SelectField
          control={control}
          name="type"
          label="Reason"
          options={[
            { value: 'adjustment', label: 'Count adjustment' },
            { value: 'damage', label: 'Damaged' },
            { value: 'return', label: 'Returned to stock' },
            { value: 'transfer', label: 'Transfer' },
          ]}
        />
      </div>

      <Input label="Note" placeholder="Cycle count 2026-08-28" {...register('note')} />

      {delta !== 0 && (
        <p
          className={cn(
            'tnum rounded-md px-3 py-2.5 text-sm',
            projected < 0 ? 'bg-danger-50 text-danger' : 'bg-surface-2 text-ink-600',
          )}
        >
          {projected < 0
            ? `That would take ${product.sku} below zero, which the server will refuse.`
            : `${formatCount(product.stock)} → ${formatCount(projected)} on hand.`}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={delta === 0}>
          Record adjustment
        </Button>
      </div>
    </form>
  );
}

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/inventory'], icon: adminIcon('Boxes') };

export function AdminProductsPage() {
  const [query, setQuery] = useState('');
  // `+ Create > Product` arrives with `?new=1`; the sentinel is the same one
  // the edit modal already reads.
  const [editing, setEditing] = useCreateParam('new', null); // product, or 'new'
  const [editingOps, setEditingOps] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [selected, setSelected] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // The dashboard links to `?stock=low`, so the filter lives in the URL.
  const stock = searchParams.get('stock') ?? 'all';

  const { data: tree } = useTaxonomy();
  const { data, isLoading } = useAdminInventory({
    q: query || undefined,
    stock: stock === 'all' ? undefined : stock,
  });
  const { data: supplierData } = useAdminSuppliers({ status: 'active' });
  const {
    createProduct,
    updateProduct,
    toggleProduct,
    updateInventoryOps,
    adjustStock,
  } = useAdminMutations();

  const products = data?.products ?? [];
  const counts = data?.counts ?? {};
  const totals = data?.totals ?? {};
  const suppliers = supplierData?.suppliers ?? [];
  const isPending = createProduct.isPending || updateProduct.isPending;
  const error = (createProduct.error ?? updateProduct.error)?.message;

  function setStock(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('stock');
    else params.set('stock', next);
    setSearchParams(params, { replace: true });
  }

  const columns = [
    {
      key: 'name',
      header: 'Product',
      priority: 1,
      render: (product) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 p-1',
              !product.isActive && 'opacity-45',
            )}
          >
            <PartVisual product={product} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-ink-900">{product.name}</span>
              {!product.isActive && (
                <Badge tone="neutral" size="sm">
                  Hidden
                </Badge>
              )}
            </span>
            <span className="block font-mono text-2xs text-ink-300">
              {product.sku} · {product.grade}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'model',
      header: 'Model',
      priority: 3,
      render: (product) => (
        <span className="text-sm text-ink-500">
          {product.brandName} {product.modelName}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Quantity',
      priority: 1,
      align: 'right',
      className: 'tnum',
      render: (product) => (
        <>
          <span
            className={cn(
              'text-sm font-medium',
              product.stockStatus === 'out'
                ? 'text-danger'
                : product.stockStatus === 'low'
                  ? 'text-warn'
                  : 'text-ink-700',
            )}
          >
            {formatCount(product.stock)}
          </span>
          {/* A reorder point of zero means "not set", which reads as never low
              rather than always low — so the fallback threshold is named. */}
          <span className="block text-2xs text-ink-400">
            min {product.minStock > 0 ? product.minStock : LOW_STOCK_THRESHOLD}
          </span>
        </>
      ),
    },
    {
      key: 'stockStatus',
      header: 'Status',
      priority: 2,
      render: (product) => (
        <Badge tone={STOCK_TONES[product.stockStatus]} size="sm">
          {STOCK_LABELS[product.stockStatus]}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: 'Unit price',
      priority: 2,
      align: 'right',
      className: 'tnum font-display font-bold text-ink-900',
      render: (product) => money(product.price),
    },
    {
      key: 'cost',
      header: 'Cost',
      priority: 3,
      align: 'right',
      className: 'tnum',
      render: (product) =>
        product.cost > 0 ? (
          <>
            <span className="text-sm text-ink-500">{money(product.cost)}</span>
            <span className="block text-2xs text-ink-400">
              {Math.round(((product.price - product.cost) / product.price) * 100)}% margin
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'totalValue',
      header: 'Total value',
      priority: 3,
      align: 'right',
      className: 'tnum',
      render: (product) => (
        <span className="text-sm text-ink-500">{money(product.totalValue)}</span>
      ),
    },
  ];

  const rowMenu = [
    {
      key: 'view',
      label: 'Open product',
      icon: Boxes,
      onSelect: (product) => navigate(`/admin/inventory/${product.id}`),
    },
    { key: 'edit', label: 'Edit product', icon: Pencil, onSelect: setEditing },
    {
      key: 'ops',
      label: 'Reorder point & cost',
      icon: SlidersHorizontal,
      onSelect: setEditingOps,
    },
    { key: 'adjust', label: 'Adjust stock', icon: Boxes, onSelect: setAdjusting },
    {
      key: 'toggle',
      label: (product) => (product.isActive ? 'Hide from storefront' : 'List on storefront'),
      icon: Eye,
      onSelect: (product) => toggleProduct.mutate(product.id),
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
              to="/admin/purchase-orders"
              className={cn(pressable, 'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2')}
            >
              <Truck className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Purchase orders
            </Link>
            <Button icon={Plus} onClick={() => setEditing('new')}>
              New product
            </Button>
          </>
        }
      />

      {/* Every tile describes the whole catalogue, not the filtered set — a
          figure that moved with the pills would contradict the pills. */}
      <KpiRow
        tiles={[
          {
            key: 'total',
            label: 'Total items',
            value: formatCount(totals.items ?? 0),
            hint: 'Across the whole catalogue',
            tone: 'brand',
            icon: Boxes,
          },
          {
            key: 'units',
            label: 'Total stock',
            value: formatCount(totals.stock ?? 0),
            hint: 'Units on hand, every product',
            tone: 'info',
            icon: Boxes,
          },
          {
            key: 'low',
            label: 'Low stock',
            value: formatCount(totals.lowStock ?? 0),
            hint: 'At or under their reorder point',
            tone: (totals.lowStock ?? 0) > 0 ? 'warn' : 'ok',
            icon: AlertCircle,
          },
          {
            key: 'out',
            label: 'Out of stock',
            value: formatCount(totals.outOfStock ?? 0),
            hint: 'Shown as out of stock to buyers',
            tone: (totals.outOfStock ?? 0) > 0 ? 'danger' : 'ok',
            icon: EyeOff,
          },
          {
            key: 'value',
            label: 'Total value',
            // Valued at cost, not retail — inventory is worth what it cost to
            // acquire, and valuing it at price books a profit that has not
            // happened yet.
            value: money(totals.value ?? 0),
            hint: 'Quantity × cost, falling back to price',
            tone: 'ok',
            icon: Wallet,
          },
        ]}
      />

      <Panel flush>
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Name, SKU or barcode…"
          pills={STOCK_FILTERS.map((pill) => ({ ...pill, count: counts[pill.value] }))}
          activePill={stock}
          onPillChange={setStock}
          onExport={(format) => downloadExport('inventory', format, { q: query || undefined, stock: stock === 'all' ? undefined : stock })}
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={counts.all ?? 0}
            shown={products.length}
            noun={(counts.all ?? 0) === 1 ? 'product' : 'products'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={products}
          rowMenu={rowMenu}
          onRowClick={(product) => navigate(`/admin/inventory/${product.id}`)}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          loading={isLoading}
          defaultSort={{ key: 'name', direction: 'asc' }}
          empty={
            <PanelEmpty
              icon={Boxes}
              title="No products match"
              body="Try a different search or filter."
            />
          }
        />
      </Panel>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New product' : 'Edit product'}
        size="lg"
        align="top"
      >
        {editing && (
          <ProductForm
            product={editing === 'new' ? null : editing}
            tree={tree}
            isPending={isPending}
            error={error}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => {
              if (editing === 'new') {
                createProduct.mutate(values, {
                  onSuccess: (payload) => {
                    setEditing(null);
                    // A new product needs a reorder point and a cost before it
                    // is much use, and both live on its detail page — so that is
                    // where creating one lands. An edit stays put: the operator
                    // was already looking at the list they wanted.
                    if (payload?.product?.id) navigate(`/admin/inventory/${payload.product.id}`);
                  },
                });
              } else {
                updateProduct.mutate(
                  { id: editing.id, ...values },
                  { onSuccess: () => setEditing(null) },
                );
              }
            }}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(editingOps)}
        onClose={() => setEditingOps(null)}
        title="Reorder point and cost"
        size="md"
        align="top"
      >
        {editingOps && (
          <OpsForm
            product={editingOps}
            suppliers={suppliers}
            isPending={updateInventoryOps.isPending}
            error={updateInventoryOps.error?.message}
            onCancel={() => setEditingOps(null)}
            onSubmit={(values) =>
              updateInventoryOps.mutate(
                {
                  id: editingOps.id,
                  minStock: Number(values.minStock) || 0,
                  cost: Math.round(Number(values.costDollars || 0) * 100),
                  location: values.location || undefined,
                  supplier: values.supplier || undefined,
                  barcode: values.barcode || undefined,
                },
                { onSuccess: () => setEditingOps(null) },
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title="Adjust stock"
        size="md"
        align="top"
      >
        {adjusting && (
          <AdjustForm
            product={adjusting}
            isPending={adjustStock.isPending}
            error={adjustStock.error?.message}
            onCancel={() => setAdjusting(null)}
            onSubmit={(values) =>
              adjustStock.mutate(
                {
                  id: adjusting.id,
                  qtyChange: Number(values.qtyChange),
                  type: values.type,
                  note: values.note,
                },
                { onSuccess: () => setAdjusting(null) },
              )
            }
          />
        )}
      </Modal>
    </>
  );
}

export default AdminProductsPage;
