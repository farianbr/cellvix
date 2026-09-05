import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useFieldArray, useForm } from 'react-hook-form';
import { AlertCircle, ArrowLeft, ClipboardList, Plus, Save, Trash2, Truck, X } from 'lucide-react';
import cn from '@/lib/cn';
import { money } from '@/lib/format';
import Panel from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/admin/PageHeader';
import InventoryPicker from '@/components/admin/InventoryPicker';
import { useTableClasses } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminSuppliers, useAdminMutations } from '@/hooks/useAdmin';
import { pressable } from '@/lib/motion';

/**
 * Raise a purchase order (ERP rework §6.8).
 *
 * **A page, not a modal.** This was a dialog on the list screen, which is the
 * wrong shape for the work: a PO can run to a dozen lines, each one searched or
 * scanned, with a running total beside them — and a dialog gives that a scroll
 * container inside a scroll container and loses the draft the moment it is
 * dismissed. A page also has a URL, so "the order I was part-way through" is
 * something an operator can come back to.
 *
 * `?supplier=<id>` preselects, which is how the supplier profile's **New PO**
 * button arrives here.
 *
 * **Nothing this page computes is trusted.** The totals below are a preview;
 * `purchaseService` recomputes every one of them from the lines on write
 * (§8, invariant 8). What the client does send is `unitCost` — a purchase price
 * is negotiated per order and has no catalogue value to read it from.
 */
const ADMIN_PAGE = {
  ...ADMIN_ROUTES['/admin/purchase-orders'],
  icon: adminIcon('ClipboardList'),
};

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
];

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day westward. */
function isoDay(offsetDays = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** A blank line. `product` holds the whole inventory row once one is chosen. */
const emptyLine = () => ({ product: null, qtyOrdered: 1, unitCostDollars: '0.00' });

export function AdminPurchaseOrderCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = useTableClasses();

  const { data: supplierData } = useAdminSuppliers({ status: 'active' });
  const suppliers = supplierData?.suppliers ?? [];

  const { createPurchaseOrder } = useAdminMutations();
  const [error, setError] = useState(null);

  const { register, handleSubmit, control, watch, setValue } = useForm({
    defaultValues: {
      supplier: searchParams.get('supplier') ?? '',
      orderDate: isoDay(),
      // A week out. A date an operator can correct beats an empty field they
      // have to fill in on every order.
      expectedDate: isoDay(7),
      status: 'draft',
      notes: '',
      taxDollars: '0',
      shippingDollars: '0',
      items: [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const tax = Math.round(Number(watch('taxDollars') || 0) * 100);
  const shipping = Math.round(Number(watch('shippingDollars') || 0) * 100);

  const subtotal = (items ?? []).reduce((sum, line) => {
    const qty = Number(line?.qtyOrdered ?? 0);
    const cost = Math.round(Number(line?.unitCostDollars ?? 0) * 100);
    return sum + (Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0);
  }, 0);

  /**
   * Choosing an item fills the rest of the row.
   *
   * SKU and barcode are displayed rather than typed — they identify the product
   * that was picked, and a field an operator can edit is a field that can
   * disagree with the line it belongs to. Cost is seeded from the catalogue and
   * stays editable, because what a supplier charges this time is the one number
   * on the row that is genuinely negotiable.
   */
  function chooseItem(index, product) {
    setValue(`items.${index}.product`, product, { shouldDirty: true });
    if (product) {
      setValue(`items.${index}.unitCostDollars`, ((product.cost ?? 0) / 100).toFixed(2), {
        shouldDirty: true,
      });
    }
  }

  function submit(values) {
    setError(null);

    const lines = values.items.filter((line) => line.product?.id);
    if (lines.length === 0) {
      setError('Add at least one item to the order.');
      return;
    }

    createPurchaseOrder.mutate(
      {
        supplier: values.supplier,
        orderDate: values.orderDate || undefined,
        expectedDate: values.expectedDate || undefined,
        tax,
        shipping,
        notes: values.notes || undefined,
        items: lines.map((line) => ({
          product: line.product.id,
          qtyOrdered: Number(line.qtyOrdered),
          unitCost: Math.round(Number(line.unitCostDollars || 0) * 100),
        })),
        // `sent` on create is a real choice — an order raised from a phone call
        // was already placed, and making the operator create a draft and then
        // immediately send it records a state that never existed.
        status: values.status,
      },
      {
        onSuccess: (payload) => {
          if (payload?.order?.id) navigate(`/admin/purchase-orders/${payload.order.id}`);
          else navigate('/admin/purchase-orders');
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title="New purchase order"
        description="Create a new order to send to a supplier."
        action={
          <Link
            to="/admin/purchase-orders"
            className={cn(pressable, 'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2')}
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Back
          </Link>
        }
      />

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Panel title="Supplier & order details" className="mb-3">
        <div className="mb-3">
          <SelectField
            control={control}
            name="supplier"
            label="Supplier"
            required
            rules={{ required: 'Choose the supplier this order goes to.' }}
            options={[
              { value: '', label: '— Select saved supplier —' },
              ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
            ]}
          />
          {/* The supplier list owns the add form, so this hands off to it and
              comes back — one form, one place its rules can drift. */}
          <Link
            to="/admin/suppliers?new=1"
            className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            <Plus className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            Add new supplier
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Order date" type="date" required {...register('orderDate')} />
          <Input label="Expected delivery" type="date" {...register('expectedDate')} />
          <SelectField control={control} name="status" label="Status" options={STATUSES} />
        </div>

        <Textarea
          label="Notes / instructions"
          rows={3}
          placeholder="Shipping instructions, special requests…"
          containerClassName="mt-3"
          {...register('notes')}
        />
      </Panel>

      <Panel title="Order items" flush className="mb-3">
        <p className="border-b border-line px-4 py-3 text-sm leading-relaxed text-ink-500">
          Search an inventory item by <strong className="font-semibold text-ink-700">name, SKU
          or barcode</strong> — scan straight into the box and the SKU, barcode and cost fill in
          automatically. Out-of-stock items are included, so you can restock them.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-left">
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.headCell()}>
                  Item / part
                </th>
                <th scope="col" className={t.headCell()}>
                  SKU
                </th>
                <th scope="col" className={t.headCell()}>
                  Barcode
                </th>
                <th scope="col" className={cn(t.headCell('right'), 'w-24')}>
                  Qty
                </th>
                <th scope="col" className={cn(t.headCell('right'), 'w-32')}>
                  Unit cost
                </th>
                <th scope="col" className={cn(t.headCell('right'), 'w-28')}>
                  Total
                </th>
                <th scope="col" className={cn(t.headCell('right'), 'w-12')}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {fields.map((field, index) => {
                const line = items?.[index];
                const lineTotal =
                  Number(line?.qtyOrdered ?? 0) *
                  Math.round(Number(line?.unitCostDollars ?? 0) * 100);

                return (
                  <tr key={field.id} className={t.row}>
                    <td className={t.cell()}>
                      <InventoryPicker
                        value={line?.product ?? null}
                        onChange={(product) => chooseItem(index, product)}
                        autoFocus={index === 0 && !line?.product}
                      />
                    </td>

                    {/* Read-only: these identify the product that was picked,
                        and a field somebody can edit is one that can disagree
                        with the line it belongs to. */}
                    <td className={cn(t.cell(), 'font-mono text-xs text-ink-500')}>
                      {line?.product?.sku ?? <span className="text-ink-300">—</span>}
                    </td>
                    <td className={cn(t.cell(), 'font-mono text-xs text-ink-500')}>
                      {line?.product?.barcode ?? <span className="text-ink-300">—</span>}
                    </td>

                    <td className={t.cell('right')}>
                      <Input
                        type="number"
                        min="1"
                        aria-label={`Quantity for line ${index + 1}`}
                        {...register(`items.${index}.qtyOrdered`)}
                      />
                    </td>
                    <td className={t.cell('right')}>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        aria-label={`Unit cost for line ${index + 1}`}
                        {...register(`items.${index}.unitCostDollars`)}
                      />
                    </td>
                    <td className={cn(t.cell('right'), 'tnum text-sm font-medium text-ink-900')}>
                      {money(Number.isFinite(lineTotal) ? lineTotal : 0)}
                    </td>
                    <td className={t.cell('right')}>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label={`Remove line ${index + 1}`}
                        className={cn(pressable, 'flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-400 hover:border-danger/30 hover:bg-danger-50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40')}
                      >
                        <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 sm:p-4">
          <button
            type="button"
            onClick={() => append(emptyLine())}
            className={cn(pressable, 'flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-brand/40 bg-brand-50/40 py-2.5 font-display text-sm font-semibold text-brand hover:border-brand/60 hover:bg-brand-50')}
          >
            <Plus className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            Add item
          </button>
        </div>
      </Panel>

      <div className="grid items-start gap-3 lg:grid-cols-[1fr_minmax(0,320px)]">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" icon={Save} loading={createPurchaseOrder.isPending}>
            Create purchase order
          </Button>
          <Link
            to="/admin/purchase-orders"
            className={cn(pressable, 'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2')}
          >
            <X className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Cancel
          </Link>
        </div>

        <Panel>
          <dl className="space-y-2 text-sm">
            <div className="tnum flex items-baseline justify-between gap-3">
              <dt className="text-ink-500">Subtotal</dt>
              <dd className="font-medium text-ink-900">{money(subtotal)}</dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Tax</dt>
              <dd className="w-28">
                <Input
                  inputMode="decimal"
                  suffix="$"
                  aria-label="Tax"
                  {...register('taxDollars')}
                />
              </dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Shipping</dt>
              <dd className="w-28">
                <Input
                  inputMode="decimal"
                  suffix="$"
                  aria-label="Shipping"
                  {...register('shippingDollars')}
                />
              </dd>
            </div>

            <div className="tnum flex items-baseline justify-between gap-3 border-t border-line pt-2 font-display text-lg font-bold text-ink-900">
              <dt>Total</dt>
              <dd>{money(subtotal + tax + shipping)}</dd>
            </div>
          </dl>

          <p className="mt-2.5 text-xs leading-relaxed text-ink-400">
            A preview. Every total is recomputed on the server from the lines.
          </p>
        </Panel>
      </div>
    </form>
  );
}

export default AdminPurchaseOrderCreatePage;
