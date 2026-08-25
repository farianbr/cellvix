import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Boxes, Eye, EyeOff, Pencil, Plus, Search } from 'lucide-react';
import cn from '@/lib/cn';
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
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import PartIllustration from '@/components/product/PartIllustration';
import { useTaxonomy } from '@/hooks/useCatalog';
import { useAdminProducts, useAdminMutations } from '@/hooks/useAdmin';

const STOCK_FILTERS = [
  { value: 'all', label: 'All products' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'inactive', label: 'Deactivated' },
];

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
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
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
          label="Part type slug"
          placeholder="screen-assembly"
          className="font-mono"
          {...register('partType', { required: true })}
        />
        <Input
          label="Part type label"
          placeholder="Screen Assembly"
          {...register('partTypeLabel', { required: true })}
        />
      </div>

      <fieldset className="rounded-[11px] border border-line p-3.5">
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

export function AdminProductsPage() {
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // product, or 'new'

  const { data: tree } = useTaxonomy();
  const { data, isLoading } = useAdminProducts({
    q: query || undefined,
    stock: stock === 'all' ? undefined : stock,
    page,
  });
  const { createProduct, updateProduct, toggleProduct } = useAdminMutations();

  // A new filter with the old page number lands on an empty result set.
  useEffect(() => setPage(1), [query, stock]);

  const products = data?.products ?? [];
  const isPending = createProduct.isPending || updateProduct.isPending;
  const error = (createProduct.error ?? updateProduct.error)?.message;

  const stats = useMemo(
    () => ({
      low: products.filter((p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD).length,
      out: products.filter((p) => p.stock === 0).length,
    }),
    [products],
  );

  return (
    <>
      <Panel
        title="Products"
        description={
          data ? `${formatCount(data.total)} matching · ${stats.out} out of stock on this page` : ''
        }
        action={
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
            New product
          </Button>
        }
        flush
      >
        <div className="flex flex-wrap gap-2.5 border-b border-line p-4 sm:px-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, SKU or model…"
            icon={Search}
            containerClassName="min-w-[200px] flex-1"
          />
          <SelectMenu
            options={STOCK_FILTERS}
            value={stock}
            onChange={setStock}
            srLabel="Filter by stock"
            size="md"
            className="w-[170px]"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 sm:p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <PanelEmpty
            icon={Boxes}
            title="No products match"
            body="Try a different search or filter."
          />
        ) : (
          // A deactivated row is dimmed via the thumbnail and the "Hidden"
          // badge, never via row opacity — knocking the whole row back drags
          // its text under the contrast floor, making the thing an admin most
          // needs to read the hardest thing to read.
          <ul className="divide-y divide-line">
            {products.map((product) => (
              <li key={product.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 p-1.5',
                    !product.isActive && 'opacity-45',
                  )}
                >
                  <PartIllustration partType={product.partType} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13.5px] font-medium text-ink-900">{product.name}</p>
                    {!product.isActive && (
                      <Badge tone="neutral" size="sm">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-[11.5px] text-ink-300">
                    {product.sku} · {product.grade}
                  </p>
                  <p className="text-[11.5px] text-ink-400">
                    {product.brandName} {product.modelName} · updated {date(product.updatedAt)}
                  </p>
                </div>

                <div className="w-20 shrink-0 text-right">
                  <p
                    className={cn(
                      'tnum text-[13px] font-medium',
                      product.stock === 0
                        ? 'text-danger'
                        : product.stock < LOW_STOCK_THRESHOLD
                          ? 'text-warn'
                          : 'text-ink-700',
                    )}
                  >
                    {formatCount(product.stock)}
                  </p>
                  <p className="text-[11px] text-ink-400">in stock</p>
                </div>

                <p className="tnum w-20 shrink-0 text-right font-display text-[13.5px] font-bold text-ink-900">
                  {money(product.price)}
                </p>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(product)}
                    aria-label={`Edit ${product.name}`}
                    className="flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900"
                  >
                    <Pencil className="size-4" strokeWidth={1.75} />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleProduct.mutate(product.id)}
                    aria-label={`${product.isActive ? 'Hide' : 'List'} ${product.name}`}
                    title={product.isActive ? 'Hide from the storefront' : 'List on the storefront'}
                    className="flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900"
                  >
                    {product.isActive ? (
                      <Eye className="size-4" strokeWidth={1.75} />
                    ) : (
                      <EyeOff className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {data?.pages > 1 && (
          <div className="border-t border-line p-4">
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </div>
        )}
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
              const options = { onSuccess: () => setEditing(null) };
              if (editing === 'new') createProduct.mutate(values, options);
              else updateProduct.mutate({ id: editing.id, ...values }, options);
            }}
          />
        )}
      </Modal>
    </>
  );
}

export default AdminProductsPage;
