import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  Ban,
  CalendarClock,
  Coins,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Wrench,
} from 'lucide-react';
import { SUPPLIER_BILLING_CYCLES } from '@shared/schemas/admin';
import cn from '@/lib/cn';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import useCreateParam from '@/hooks/useCreateParam';
import {
  useSupplierServices,
  useAdminSuppliers,
  useAdminExpenseCategories,
  useAdminMutations,
} from '@/hooks/useAdmin';

/**
 * Two screens over one collection (Purchase § Service Products, § Subscription
 * Plans), told apart by `kind`.
 *
 * They differ only in whether the charge repeats, so forking the page would
 * mean two copies of the same table drifting apart. What each one *says*
 * differs — a subscription has a renewal date and an annual cost, a service has
 * neither — and that is driven by the `MODE` table below rather than by
 * scattered conditionals.
 *
 * **Neither is the customer catalogue.** `Product` is what Cellvix sells — an
 * iPhone 15 battery, with stock and a grade. Nothing here has stock or reaches
 * the storefront; these are costs, and they land in the P&L as real `Expense`
 * rows.
 */

const MODE = {
  subscription: {
    route: '/admin/supplier-subscriptions',
    icon: 'CalendarClock',
    noun: 'plan',
    plural: 'plans',
    createLabel: 'New plan',
    createTitle: 'Add a subscription plan',
    // A plan that repeats needs a start; a one-off does not.
    defaultBilling: 'monthly',
    emptyTitle: 'No plans yet',
    emptyBody: 'Recurring supplier costs — a licence, a courier account, a service contract.',
  },
  service: {
    route: '/admin/supplier-services',
    icon: 'Wrench',
    noun: 'service',
    plural: 'services',
    createLabel: 'New service',
    createTitle: 'Add a service product',
    defaultBilling: 'one_off',
    emptyTitle: 'No services yet',
    emptyBody: 'Things bought in that are not stock — outsourced repair, freight, disposal.',
  },
};

const BILLING_LABEL = Object.fromEntries(
  SUPPLIER_BILLING_CYCLES.map((cycle) => [cycle.value, cycle.label]),
);

const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'due', label: 'Due soon' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** The create/edit form. `mode` only changes which billing cycles are offered. */
function ServiceForm({ mode, suppliers, categories, row, onSubmit, onCancel, isPending, error }) {
  const editing = Boolean(row);

  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: {
      name: row?.name ?? '',
      code: row?.code ?? '',
      supplier: row?.supplier?.id ?? suppliers[0]?.id ?? '',
      category: row?.category?.id ?? categories[0]?.id ?? '',
      amountDollars: row ? (row.amount / 100).toFixed(2) : '',
      billing: row?.billing ?? MODE[mode].defaultBilling,
      startedAt: row?.startedAt ? new Date(row.startedAt).toISOString().slice(0, 10) : '',
      nextRenewalAt: row?.nextRenewalAt
        ? new Date(row.nextRenewalAt).toISOString().slice(0, 10)
        : '',
      reference: row?.reference ?? '',
      notes: row?.notes ?? '',
    },
  });

  const billing = watch('billing');
  const recurring = billing !== 'one_off';

  // A subscription screen offers only repeating cycles, and a service screen
  // only the one-off — picking the other kind here would file the row under a
  // tab it does not appear on, which reads as the save having failed.
  const cycles =
    mode === 'subscription'
      ? SUPPLIER_BILLING_CYCLES.filter((cycle) => cycle.value !== 'one_off')
      : SUPPLIER_BILLING_CYCLES.filter((cycle) => cycle.value === 'one_off');

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          name: values.name,
          code: values.code || undefined,
          supplier: values.supplier,
          category: values.category,
          amount: Math.round(Number(values.amountDollars || 0) * 100),
          billing: values.billing,
          startedAt: recurring ? values.startedAt || undefined : undefined,
          nextRenewalAt: recurring ? values.nextRenewalAt || undefined : undefined,
          reference: values.reference || undefined,
          notes: values.notes || undefined,
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

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Input
          label="Name"
          placeholder={mode === 'subscription' ? 'Warehouse WMS licence' : 'Pallet disposal'}
          {...register('name')}
        />
        <Input label="Code" placeholder="WMS-01" {...register('code')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          control={control}
          name="supplier"
          label="Supplier"
          options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
        />
        <SelectField
          control={control}
          name="category"
          label="Expense category"
          hint="Where the cost lands in the P&L."
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={recurring ? 'Cost per cycle' : 'Cost'}
          inputMode="decimal"
          suffix="CAD"
          {...register('amountDollars')}
        />
        <SelectField control={control} name="billing" label="Billing" options={cycles} />
      </div>

      {recurring && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Started" type="date" {...register('startedAt')} />
          <Input
            label="Next renewal"
            type="date"
            hint="Blank works it out from the start date."
            {...register('nextRenewalAt')}
          />
        </div>
      )}

      <Input label="Reference" placeholder="Account or contract number" {...register('reference')} />
      <Textarea label="Notes" rows={2} {...register('notes')} />

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-500">
        This is a cost, not something Cellvix sells — it has no stock and never reaches the
        storefront. Recording a charge against it writes a real expense, so it shows up in the P&amp;L
        like any other.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {editing ? 'Save' : MODE[mode].createLabel}
        </Button>
      </div>
    </form>
  );
}

/** Recording what was actually charged. Pre-filled with the agreed cost. */
function ChargeForm({ row, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      amountDollars: (row.amount / 100).toFixed(2),
      date: new Date().toISOString().slice(0, 10),
      description: '',
      reference: row.reference ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-[11px] bg-surface-2 p-3.5">
        <p className="font-display text-[14px] font-bold text-ink-900">{row.name}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-500">
          {row.supplierName} · {BILLING_LABEL[row.billing]} · {money(row.amount)}
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Amount" inputMode="decimal" suffix="CAD" {...register('amountDollars')} />
        <Input label="Charged on" type="date" {...register('date')} />
      </div>

      <Input label="Description" placeholder="Leave blank to use the name" {...register('description')} />
      <Input label="Reference" placeholder="Invoice number" {...register('reference')} />

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-500">
        This writes an expense against <strong className="font-semibold">{row.category.name}</strong>
        {row.recurring && ', and moves the renewal on by one cycle'}.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Record charge
        </Button>
      </div>
    </form>
  );
}

export function AdminSupplierServicesPage({ mode = 'service' }) {
  const meta = MODE[mode];
  const page = { ...ADMIN_ROUTES[meta.route], icon: adminIcon(meta.icon) };

  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useCreateParam();
  const [editing, setEditing] = useState(null);
  const [charging, setCharging] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const status = searchParams.get('status') ?? 'all';

  const { data, isLoading } = useSupplierServices({ kind: mode, status, q: query || undefined });
  const { data: supplierData } = useAdminSuppliers({});
  const { data: categoryData } = useAdminExpenseCategories();

  const {
    createSupplierService,
    updateSupplierService,
    recordSupplierCharge,
    cancelSupplierService,
    deleteSupplierService,
  } = useAdminMutations();

  const rows = data?.services ?? [];
  const counts = data?.counts ?? {};

  function setStatus(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  }

  const columns = [
    {
      key: 'name',
      header: mode === 'subscription' ? 'Plan' : 'Service',
      priority: 1,
      render: (row) => (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-ink-900">{row.name}</span>
            {row.cancelled && (
              <Badge tone="neutral" size="sm">
                Cancelled
              </Badge>
            )}
          </span>
          <span className="block truncate text-[12px] text-ink-500">
            {row.supplierName}
            {row.code ? ` · ${row.code}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      priority: 3,
      sortValue: (row) => row.category.name,
      render: (row) => (
        <Badge tone="neutral" size="sm">
          {row.category.name}
        </Badge>
      ),
    },
    {
      key: 'billing',
      header: 'Billing',
      priority: 2,
      render: (row) => (
        <span className="whitespace-nowrap text-[12.5px] text-ink-500">
          {BILLING_LABEL[row.billing] ?? row.billing}
        </span>
      ),
    },
    // A one-off has no renewal, so the column only exists on the plans screen
    // rather than sitting there full of dashes.
    ...(mode === 'subscription'
      ? [
          {
            key: 'nextRenewalAt',
            header: 'Next renewal',
            priority: 1,
            align: 'right',
            sortValue: (row) => (row.nextRenewalAt ? new Date(row.nextRenewalAt).getTime() : 0),
            render: (row) =>
              row.nextRenewalAt ? (
                <>
                  <span
                    className={cn(
                      'tnum whitespace-nowrap text-[12.5px]',
                      row.overdue ? 'font-medium text-danger' : 'text-ink-700',
                    )}
                  >
                    {date(row.nextRenewalAt)}
                  </span>
                  <span
                    className={cn(
                      'block text-[11px]',
                      row.overdue ? 'text-danger' : row.dueInDays <= 14 ? 'text-warn' : 'text-ink-400',
                    )}
                  >
                    {row.overdue
                      ? `${Math.abs(row.dueInDays)}d overdue`
                      : row.dueInDays === 0
                        ? 'Due today'
                        : `in ${row.dueInDays}d`}
                  </span>
                </>
              ) : (
                <span className="text-[12px] text-ink-300">—</span>
              ),
          },
        ]
      : []),
    {
      key: 'amount',
      header: mode === 'subscription' ? 'Per cycle' : 'Cost',
      priority: 1,
      align: 'right',
      className: 'tnum',
      sortValue: (row) => row.amount,
      render: (row) => (
        <span className="text-[13px] font-medium text-ink-900">{money(row.amount)}</span>
      ),
    },
  ];

  const rowMenu = [
    {
      key: 'charge',
      label: 'Record charge',
      icon: Receipt,
      hidden: (row) => row.cancelled,
      onSelect: (row) => setCharging(row),
    },
    { key: 'edit', label: 'Edit', icon: Wrench, onSelect: (row) => setEditing(row) },
    /**
     * Cancel and reactivate are two entries, not one that changes its icon.
     * `RowMenu` renders `icon` as a component and only `label` may be a
     * function, so a per-row icon would render a broken element — and two
     * entries with their own `hidden` reads more plainly anyway.
     */
    {
      key: 'cancel',
      label: 'Cancel',
      icon: Ban,
      hidden: (row) => row.cancelled,
      onSelect: (row) => setCancelling(row),
    },
    {
      key: 'reactivate',
      label: 'Reactivate',
      icon: RotateCcw,
      hidden: (row) => !row.cancelled,
      onSelect: (row) => cancelSupplierService.mutate({ id: row.id, cancelled: false }),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onSelect: (row) => setDeleting(row),
    },
  ];

  return (
    <>
      <PageHeader
        icon={page.icon}
        title={page.title}
        description={page.description}
        action={
          <Button onClick={() => setCreating(true)} icon={Plus}>
            {meta.createLabel}
          </Button>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'active',
            label: 'Active',
            value: formatCount(counts.active ?? 0),
            hint: `Live ${meta.plural}`,
            tone: 'info',
            icon: mode === 'subscription' ? CalendarClock : Wrench,
          },
          mode === 'subscription'
            ? {
                key: 'annual',
                label: 'Annual cost',
                // One-offs are excluded server-side: they are not a
                // commitment, and folding them in would make this mean two
                // things at once.
                value: money(data?.annualised ?? 0),
                hint: 'Recurring plans, annualised',
                tone: 'brand',
                icon: Coins,
              }
            : {
                key: 'total',
                label: 'Catalogue',
                value: formatCount(counts.all ?? 0),
                hint: 'Services on file',
                tone: 'brand',
                icon: Coins,
              },
          {
            key: 'due',
            label: 'Due soon',
            value: formatCount(counts.due ?? 0),
            hint: 'Renewing within 14 days',
            tone: (counts.due ?? 0) > 0 ? 'warn' : 'ok',
            icon: CalendarClock,
          },
          {
            key: 'overdue',
            label: 'Overdue',
            value: formatCount(counts.overdue ?? 0),
            hint: 'Renewal date already passed',
            tone: (counts.overdue ?? 0) > 0 ? 'danger' : 'ok',
            icon: AlertCircle,
          },
        ]}
      />

      <Panel flush>
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder={`Name, code or supplier…`}
          pills={PILLS.map((pill) => ({ ...pill, count: counts[pill.value] }))}
          activePill={status}
          onPillChange={setStatus}
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine total={rows.length} noun={rows.length === 1 ? meta.noun : meta.plural} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowMenu={rowMenu}
          loading={isLoading}
          empty={
            <PanelEmpty
              icon={mode === 'subscription' ? CalendarClock : Wrench}
              title={meta.emptyTitle}
              body={meta.emptyBody}
            />
          }
        />
      </Panel>

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : meta.createTitle}
        size="lg"
        align="top"
      >
        {(creating || editing) && (
          <ServiceForm
            mode={mode}
            row={editing}
            suppliers={supplierData?.suppliers ?? []}
            categories={categoryData?.categories ?? []}
            isPending={createSupplierService.isPending || updateSupplierService.isPending}
            error={
              createSupplierService.error?.message ?? updateSupplierService.error?.message
            }
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSubmit={(values) => {
              const done = () => {
                setCreating(false);
                setEditing(null);
              };

              if (editing) updateSupplierService.mutate({ id: editing.id, ...values }, { onSuccess: done });
              else createSupplierService.mutate(values, { onSuccess: done });
            }}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(charging)}
        onClose={() => setCharging(null)}
        title="Record a charge"
        size="md"
      >
        {charging && (
          <ChargeForm
            row={charging}
            isPending={recordSupplierCharge.isPending}
            error={recordSupplierCharge.error?.message}
            onCancel={() => setCharging(null)}
            onSubmit={(values) =>
              recordSupplierCharge.mutate(
                {
                  id: charging.id,
                  amount: Math.round(Number(values.amountDollars || 0) * 100),
                  date: values.date || undefined,
                  description: values.description || undefined,
                  reference: values.reference || undefined,
                },
                { onSuccess: () => setCharging(null) },
              )
            }
          />
        )}
      </Modal>

      {/* Cancelling stops the recurring charge but keeps the record, and
          Reactivate in the same menu puts it back, so this asks once. */}
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() =>
          cancelSupplierService.mutate(
            { id: cancelling.id, cancelled: true },
            { onSuccess: () => setCancelling(null) },
          )
        }
        title={`Cancel ${cancelling?.name ?? 'this service'}?`}
        body="It stops billing from the next cycle. Charges already recorded stay on the supplier's account, and Reactivate puts the service back."
        tone="info"
        confirmLabel="Cancel service"
        cancelLabel="Keep it running"
        loading={cancelSupplierService.isPending}
        error={cancelSupplierService.error?.message}
      />

      {/* Delete takes the service and its billing history out for good, so the
          name is retyped. Cancel is the reversible option and the dialog says
          so, because from a row menu the two entries sit next to each other. */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleteSupplierService.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        title="Delete this service?"
        body={
          deleting
            ? `${deleting.name} from ${deleting.supplierName} will be removed permanently. To stop billing without losing the record, cancel it instead.`
            : ''
        }
        consequence="Its recorded charges go with it, and the supplier's spend history changes to match."
        confirmPhrase={deleting?.name}
        confirmPhraseLabel="the service name"
        confirmLabel="Delete service"
        loading={deleteSupplierService.isPending}
        error={deleteSupplierService.error?.message}
      />
    </>
  );
}

export default AdminSupplierServicesPage;
