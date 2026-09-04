import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import useCreateParam from '@/hooks/useCreateParam';
import {
  AlertCircle,
  ClipboardList,
  ExternalLink,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  Truck,
} from 'lucide-react';
import { money, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import FilterStrip from '@/components/admin/FilterStrip';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminSuppliers, useAdminMutations } from '@/hooks/useAdmin';
import Skeleton from '@/components/ui/Skeleton';

/**
 * Suppliers — the businesses Cellvix buys stock from (ERP rework §6.7).
 *
 * A **card grid**, not the DataTable, and deliberately so: this is the one
 * Purchase screen whose records are read as contacts rather than as rows. Five
 * across at 1440+, three at 1024, two at 768, one at 320 (§6.7).
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/suppliers'], icon: adminIcon('Truck') };

const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const TERMS = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'net15', label: 'Net 15' },
  { value: 'net30', label: 'Net 30' },
  { value: 'net60', label: 'Net 60' },
];

const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
];

/** Two letters from the business name — the card's avatar. */
function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function termsLabel(value) {
  return TERMS.find((term) => term.value === value)?.label ?? value;
}

/**
 * Add or edit a supplier.
 *
 * `paymentTerms` reads the same vocabulary as a client's line of credit, the
 * other way round: what Cellvix owes this supplier, not what it is owed.
 */
function SupplierForm({ supplier, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      name: supplier?.name ?? '',
      code: supplier?.code ?? '',
      contactName: supplier?.contactName ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      website: supplier?.website ?? '',
      paymentTerms: supplier?.paymentTerms ?? 'net30',
      address: {
        line1: supplier?.address?.line1 ?? '',
        line2: supplier?.address?.line2 ?? '',
        city: supplier?.address?.city ?? '',
        region: supplier?.address?.region ?? 'ON',
        postal: supplier?.address?.postal ?? '',
        country: supplier?.address?.country ?? 'CA',
      },
      notes: supplier?.notes ?? '',
      isActive: supplier?.isActive ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Input label="Business name" {...register('name')} />
        <Input label="Code" placeholder="SKC" {...register('code')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Contact" {...register('contactName')} />
        <SelectField control={control} name="paymentTerms" label="Payment terms" options={TERMS} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Email" type="email" {...register('email')} />
        <Input label="Phone" {...register('phone')} />
      </div>

      <Input label="Website" placeholder="https://" {...register('website')} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Address" {...register('address.line1')} />
        <Input label="Unit / suite" {...register('address.line2')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="City" {...register('address.city')} />
        <SelectField
          control={control}
          name="address.region"
          label="Province"
          options={PROVINCES.map((code) => ({ value: code, label: code }))}
        />
        <Input label="Postal code" placeholder="A1A 1A1" {...register('address.postal')} />
      </div>

      <Textarea label="Notes" rows={3} {...register('notes')} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {supplier ? 'Save supplier' : 'Add supplier'}
        </Button>
      </div>
    </form>
  );
}

function SupplierCard({ supplier, onEdit, onToggle }) {
  return (
    <article
      className={`flex flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong ${
        supplier.isActive ? '' : 'opacity-70'
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 font-display text-sm font-bold text-ink-600">
          {initials(supplier.name)}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-md font-bold leading-snug text-ink-900">
            {supplier.name}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
            {supplier.code && <span className="font-mono">{supplier.code}</span>}
            <Badge tone={supplier.isActive ? 'ok' : 'neutral'} size="sm">
              {supplier.isActive ? 'active' : 'inactive'}
            </Badge>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onEdit(supplier)}
          aria-label={`Edit ${supplier.name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-300 transition-colors hover:bg-surface-2 hover:text-ink-700"
        >
          <Pencil className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      <dl className="mb-3 space-y-1 text-xs text-ink-500">
        {supplier.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="size-3 shrink-0 text-ink-300" strokeWidth={2.5} aria-hidden="true" />
            <dd className="truncate">{supplier.email}</dd>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="size-3 shrink-0 text-ink-300" strokeWidth={2.5} aria-hidden="true" />
            <dd className="truncate">{supplier.phone}</dd>
          </div>
        )}
      </dl>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-md bg-surface-2 p-2.5">
        <div>
          <p className="eyebrow text-ink-400">Orders</p>
          <p className="tnum font-display text-lg font-bold text-ink-900">
            {formatCount(supplier.ordersCount)}
          </p>
        </div>
        <div>
          <p className="eyebrow text-ink-400">Total spent</p>
          <p className="tnum font-display text-lg font-bold text-ink-900">
            {money(supplier.totalSpent)}
          </p>
        </div>
      </div>

      <p className="mb-3 text-xs text-ink-400">Terms · {termsLabel(supplier.paymentTerms)}</p>

      <div className="mt-auto flex items-center gap-2">
        {/* `Button` renders a real <button>; a navigation needs an anchor, so
            the link carries the button's own classes rather than being wrapped
            in one. */}
        <Link
          to={`/admin/suppliers/${supplier.id}`}
          className="inline-flex h-9 flex-1 select-none items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 font-display text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
        >
          View profile
        </Link>

        {supplier.website && (
          <a
            href={supplier.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${supplier.name} website`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-400 transition-colors hover:border-line-strong hover:text-ink-700"
          >
            <ExternalLink className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          </a>
        )}

        <button
          type="button"
          onClick={() => onToggle(supplier)}
          aria-label={`${supplier.isActive ? 'Deactivate' : 'Reactivate'} ${supplier.name}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-400 transition-colors hover:border-danger/30 hover:bg-danger-50 hover:text-danger"
        >
          <Power className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function AdminSuppliersPage() {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  // Opened directly by `+ Create` (§7.2), which arrives with `?new=1`.
  const navigate = useNavigate();
  const [creating, setCreating] = useCreateParam();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') ?? 'all';

  const { data, isLoading } = useAdminSuppliers({ status, q: query || undefined });
  const { createSupplier, updateSupplier, toggleSupplier } = useAdminMutations();

  const suppliers = data?.suppliers ?? [];
  const counts = data?.counts ?? {};

  function setStatus(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  }

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
              className="inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
            >
              <ClipboardList className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Purchase orders
            </Link>
            <Button onClick={() => setCreating(true)} icon={Plus}>
              Add supplier
            </Button>
          </>
        }
      />

      <Panel flush>
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Name, code, contact or email…"
          pills={PILLS.map((pill) => ({ ...pill, count: counts[pill.value] }))}
          activePill={status}
          onPillChange={setStatus}
        />

        <div className="p-3 sm:p-4">
          <p className="mb-3 text-sm text-ink-500">
            {formatCount(counts.all ?? 0)} supplier{(counts.all ?? 0) === 1 ? '' : 's'} total
            {status !== 'all' && ` · ${formatCount(suppliers.length)} shown`}
          </p>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-[248px]" rounded="lg" />
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <PanelEmpty
              icon={Truck}
              title="No suppliers match"
              body="Try a different filter, or add the business you buy from."
              action={
                <Button onClick={() => setCreating(true)} icon={Plus} size="sm">
                  Add supplier
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  onEdit={setEditing}
                  onToggle={(row) => toggleSupplier.mutate(row.id)}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add a supplier"
        size="lg"
        align="top"
      >
        <SupplierForm
          isPending={createSupplier.isPending}
          error={createSupplier.error?.message}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            createSupplier.mutate(values, {
              onSuccess: (payload) => {
                setCreating(false);
                // Straight to the supplier that was just added — the next thing
                // an operator does is raise a purchase order against it.
                if (payload?.supplier?.id) navigate(`/admin/suppliers/${payload.supplier.id}`);
              },
            })
          }
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit supplier"
        size="lg"
        align="top"
      >
        {editing && (
          <SupplierForm
            supplier={editing}
            isPending={updateSupplier.isPending}
            error={updateSupplier.error?.message}
            onCancel={() => setEditing(null)}
            onSubmit={(values) =>
              updateSupplier.mutate(
                { id: editing.id, ...values },
                { onSuccess: () => setEditing(null) },
              )
            }
          />
        )}
      </Modal>
    </>
  );
}

export default AdminSuppliersPage;
