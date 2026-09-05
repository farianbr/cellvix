import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  MailWarning,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import cn from '@/lib/cn';
import Panel from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import InventoryPicker from '@/components/admin/InventoryPicker';
import ComponentTypePicker from '@/components/admin/ComponentTypePicker';
import { useTableClasses } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminMutations, useSuppliersForComponentTypes } from '@/hooks/useAdmin';
import { toast } from '@/store/toastStore';
import { pressable } from '@/lib/motion';

/**
 * Raise a request for quote (§6.8a).
 *
 * **Component types first, suppliers second.** That order is the feature: a
 * purchasing clerk knows they are buying batteries, not which of forty
 * suppliers stock them, so ticking a component type is what produces the list
 * of people who can be asked. Nothing about that list is typed or remembered —
 * it comes from `Supplier.componentTypes`, and a supplier who was never tagged
 * simply does not appear, which is why the supplier form says so.
 *
 * A page rather than a modal, for the reason the purchase-order form is one: a
 * request runs to a dozen searched lines with a supplier list beside them, and
 * a dialog gives that a scroll container inside a scroll container and loses
 * the draft the moment it is dismissed.
 *
 * **No prices anywhere on this page.** A request asks a question; a number in
 * it would be an anchor nobody meant to set. Costs arrive from suppliers, in
 * the portal.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/rfqs'], icon: adminIcon('Send') };

/** A blank line. `product` holds the whole inventory row once one is chosen. */
const emptyLine = () => ({ product: null, qty: 1 });

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day westward. */
function isoDay(offsetDays = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function AdminRfqCreatePage() {
  const navigate = useNavigate();
  const t = useTableClasses();

  const [componentTypes, setComponentTypes] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(null);

  const { data: supplierData, isFetching } = useSuppliersForComponentTypes(componentTypes);
  const suppliers = supplierData?.suppliers ?? [];

  const { createRfq, sendRfq } = useAdminMutations();

  const { register, handleSubmit, control, watch, setValue } = useForm({
    defaultValues: {
      title: '',
      // A week out. A date somebody can correct beats an empty field they have
      // to fill in on every request.
      closesAt: isoDay(7),
      notes: '',
      items: [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  /**
   * Untick a component type and any supplier that was only there because of it
   * goes with it.
   *
   * Otherwise a clerk who corrects a mistaken tick keeps a supplier who no
   * longer matches anything on the request — invited, on paper, for a component
   * type nobody is buying.
   */
  function changeComponentTypes(next) {
    setComponentTypes(next);
    if (!next.length) {
      setSelected([]);
      return;
    }
    setSelected((current) =>
      current.filter((id) => {
        const supplier = suppliers.find((candidate) => candidate.id === id);
        // Unknown here means "from a list we no longer hold" — keep it, and let
        // the refreshed list settle it. Dropping it would silently uninvite
        // somebody mid-edit.
        if (!supplier) return true;
        return supplier.componentTypes.some((type) => next.includes(type));
      }),
    );
  }

  function toggleSupplier(id) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function submit(values, andSend) {
    setError(null);

    const lines = values.items.filter((line) => line.product?.id);
    if (!lines.length) {
      setError('Add at least one part to the request.');
      return;
    }
    if (andSend && !selected.length) {
      setError('Pick at least one supplier to ask, or save this as a draft.');
      return;
    }

    createRfq.mutate(
      {
        title: values.title || undefined,
        componentTypes,
        closesAt: values.closesAt || undefined,
        notes: values.notes || undefined,
        suppliers: selected,
        items: lines.map((line) => ({ product: line.product.id, qty: Number(line.qty) })),
      },
      {
        onSuccess: (payload) => {
          const id = payload?.rfq?.id;
          if (!andSend) {
            navigate(id ? `/admin/rfqs/${id}` : '/admin/rfqs');
            return;
          }

          // Create then send, rather than one endpoint doing both: sending is
          // its own decision with its own partial-failure answer, and folding
          // it into the create would hide which suppliers were not reached.
          sendRfq.mutate(
            { id },
            {
              onSuccess: (result) => {
                if (result.failed.length) {
                  toast.error(
                    `${result.failed.length} supplier(s) were not reached`,
                    `${result.failed.map((entry) => entry.supplier).join(', ')} — check their email address. The others have it.`,
                  );
                } else {
                  toast.ok(
                    `${payload.rfq.rfqNumber} is out for quote`,
                    `${result.sent.length} supplier(s) have been asked.`,
                  );
                }
                navigate(`/admin/rfqs/${id}`);
              },
              onError: (err) => {
                toast.error('Saved, but nothing was sent', err.message);
                navigate(`/admin/rfqs/${id}`);
              },
            },
          );
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  const isPending = createRfq.isPending || sendRfq.isPending;

  return (
    <form onSubmit={handleSubmit((values) => submit(values, false))}>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title="New request for quote"
        description="Pick what you are buying, choose who to ask, and list the parts you need priced."
        action={
          <Link
            to="/admin/rfqs"
            className={cn(
              pressable,
              'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2',
            )}
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

      <Panel title="What are you buying?" className="mb-3">
        <p className="mb-3 text-sm leading-relaxed text-ink-500">
          Tick the component types this request covers. Every active supplier tagged with one of
          them appears below, ready to be asked.
        </p>
        <ComponentTypePicker value={componentTypes} onChange={changeComponentTypes} />
      </Panel>

      <Panel title="Who should we ask?" className="mb-3">
        {!componentTypes.length ? (
          <p className="text-sm text-ink-400">
            Pick a component type above and the suppliers who carry it appear here.
          </p>
        ) : isFetching && !suppliers.length ? (
          <p className="text-sm text-ink-400">Finding suppliers…</p>
        ) : !suppliers.length ? (
          <p className="flex items-start gap-2 rounded-md bg-warn-50 px-3 py-2.5 text-sm text-warn">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            No active supplier is tagged with{' '}
            {componentTypes.length === 1 ? 'that component type' : 'those component types'}. Tag one
            on the{' '}
            <Link to="/admin/suppliers" className="font-semibold underline">
              Suppliers
            </Link>{' '}
            screen and they will show up here.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(suppliers.map((supplier) => supplier.id))}
                className={cn(
                  pressable,
                  'rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-700 hover:border-ink-300 hover:bg-surface-2',
                )}
              >
                Select all {suppliers.length}
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className={cn(
                    pressable,
                    'rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-500 hover:border-ink-300 hover:bg-surface-2',
                  )}
                >
                  Clear
                </button>
              )}
              <span className="text-sm text-ink-400">
                {selected.length} of {suppliers.length} selected
              </span>
            </div>

            <ul className="grid gap-2 sm:grid-cols-2">
              {suppliers.map((supplier) => {
                const on = selected.includes(supplier.id);
                return (
                  <li key={supplier.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSupplier(supplier.id)}
                      className={cn(
                        pressable,
                        'flex w-full items-start gap-2.5 rounded-md border p-3 text-left',
                        on
                          ? 'border-ok/40 bg-ok-50'
                          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                          on ? 'border-ok bg-ok text-white' : 'border-line-strong',
                        )}
                        aria-hidden="true"
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-semibold text-ink-900">
                          {supplier.name}
                        </span>
                        <span className="block truncate text-xs text-ink-400">
                          {supplier.email ?? 'No email on file'}
                        </span>

                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {/* Which of the ticked types this supplier actually
                              covers. A partial match is worth asking and worth
                              seeing as partial. */}
                          {supplier.matched.map((type) => (
                            <Badge key={type} tone="neutral" size="sm">
                              {type}
                            </Badge>
                          ))}
                          {/* A supplier with no portal access can still be
                              asked — the email carries the line list — but they
                              have nowhere to type a price, so the screen says
                              so rather than letting somebody wait for a quote
                              that cannot arrive. */}
                          {!supplier.hasPortal && (
                            <span className="inline-flex items-center gap-1 text-2xs text-warn">
                              <MailWarning className="size-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                              No portal access yet
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Request details" className="mb-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Title"
            placeholder="e.g. October battery restock"
            {...register('title')}
          />
          <Input
            label="Answers close"
            type="date"
            hint="Suppliers cannot quote after this date."
            {...register('closesAt')}
          />
        </div>

        <Textarea
          label="Notes for the supplier"
          rows={3}
          placeholder="Delivery expectations, packaging, anything they should know…"
          containerClassName="mt-3"
          {...register('notes')}
        />
      </Panel>

      <Panel title="What do you need priced?" flush className="mb-3">
        <p className="border-b border-line px-4 py-3 text-sm leading-relaxed text-ink-500">
          Search by <strong className="font-semibold text-ink-700">name, SKU or barcode</strong> —
          out-of-stock items are included, since restocking is the usual reason to ask.{' '}
          <strong className="font-semibold text-ink-700">No prices here</strong>: the suppliers send
          those back.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-150 text-left">
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.headCell()}>
                  Item / part
                </th>
                <th scope="col" className={t.headCell()}>
                  SKU
                </th>
                <th scope="col" className={cn(t.headCell('right'), 'w-24')}>
                  Qty
                </th>
                <th scope="col" className={cn(t.headCell('right'), 'w-12')}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {fields.map((field, index) => {
                const line = items?.[index];
                return (
                  <tr key={field.id} className={t.row}>
                    <td className={t.cell()}>
                      <InventoryPicker
                        value={line?.product ?? null}
                        onChange={(product) =>
                          setValue(`items.${index}.product`, product, { shouldDirty: true })
                        }
                        autoFocus={index === 0 && !line?.product}
                      />
                    </td>
                    <td className={cn(t.cell(), 'font-mono text-xs text-ink-500')}>
                      {line?.product?.sku ?? <span className="text-ink-300">—</span>}
                    </td>
                    <td className={t.cell('right')}>
                      <Input
                        type="number"
                        min="1"
                        aria-label={`Quantity for line ${index + 1}`}
                        {...register(`items.${index}.qty`)}
                      />
                    </td>
                    <td className={t.cell('right')}>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label={`Remove line ${index + 1}`}
                        className={cn(
                          pressable,
                          'flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-400 hover:border-danger/30 hover:bg-danger-50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40',
                        )}
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
            className={cn(
              pressable,
              'flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-brand/40 bg-brand-50/40 py-2.5 font-display text-sm font-semibold text-brand hover:border-brand/60 hover:bg-brand-50',
            )}
          >
            <Plus className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            Add part
          </button>
        </div>
      </Panel>

      {/* Two commits, because they are genuinely different decisions: a draft
          is a request still being assembled, and sending it is the moment
          suppliers are emailed and the clock starts. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          icon={Send}
          loading={isPending}
          onClick={handleSubmit((values) => submit(values, true))}
        >
          Save and send to {selected.length || 'no'} supplier{selected.length === 1 ? '' : 's'}
        </Button>
        <Button type="submit" variant="outline" icon={Save} loading={isPending}>
          Save as draft
        </Button>
        <Link
          to="/admin/rfqs"
          className={cn(
            pressable,
            'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2',
          )}
        >
          <X className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default AdminRfqCreatePage;
