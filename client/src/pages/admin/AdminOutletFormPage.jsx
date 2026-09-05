import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Building2, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { outletSchema, OUTLET_COLOR_TOKENS } from '@shared/schemas/admin';
import AddressFields from '@/components/admin/AddressFields';
import Panel from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import PhoneField from '@/components/ui/PhoneField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminOutlet, useNextOutletCode, useAdminMutations } from '@/hooks/useAdmin';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';

/**
 * Add / edit an outlet (§6.14) — form on the left, **live preview card** on the
 * right showing exactly how it will appear in the list.
 *
 * The preview is the reason the colour picker is worth having: a token name
 * means nothing until you see the card it produces, and the operator is
 * choosing an identity they will navigate by, not a decoration.
 */
const COLOR_BORDER = {
  brand: 'border-t-brand',
  info: 'border-t-info',
  success: 'border-t-ok',
  warn: 'border-t-warn',
  danger: 'border-t-danger',
  ink: 'border-t-ink-300',
};

const COLOR_WASH = {
  brand: 'bg-brand-50 text-brand',
  info: 'bg-info-50 text-info',
  success: 'bg-ok-50 text-ok',
  warn: 'bg-warn-50 text-warn',
  danger: 'bg-danger-50 text-danger',
  ink: 'bg-surface-2 text-ink-500',
};

const COLOR_DOT = {
  brand: 'bg-brand',
  info: 'bg-info',
  success: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  ink: 'bg-ink-300',
};

const COLOR_LABEL = {
  brand: 'Brand',
  info: 'Info',
  success: 'Positive',
  warn: 'Warning',
  danger: 'Critical',
  ink: 'Neutral',
};

const STATUS_TONE = { active: 'ok', inactive: 'neutral', maintenance: 'warn' };
const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', maintenance: 'Maintenance' };

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

function PreviewCard({ values, code }) {
  const token = values.colorToken ?? 'brand';
  const address = [values.address?.street, values.address?.city, values.address?.region, values.address?.postal]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      className={cn(
        'rounded-lg border border-line border-t-[3px] bg-surface p-4',
        COLOR_BORDER[token] ?? COLOR_BORDER.ink,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            COLOR_WASH[token] ?? COLOR_WASH.ink,
          )}
        >
          <Building2 className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-medium text-ink-900">
            {values.name || 'Outlet name'}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-ink-400">{code || '#000000'}</p>
        </div>
        <Badge tone={STATUS_TONE[values.status] ?? 'neutral'} size="sm">
          {STATUS_LABEL[values.status] ?? 'Active'}
        </Badge>
      </div>

      <dl className="mt-4 flex flex-col gap-1.5 text-sm text-ink-500">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <dd className="min-w-0">{address || 'No address yet'}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <dd>{values.phone || 'No phone'}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <dd className="truncate">{values.email || 'No email'}</dd>
        </div>
        <div className="flex items-center gap-2">
          <UserRound className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <dd>{values.manager || 'No manager set'}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminOutletFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const { data: existing, isLoading } = useAdminOutlet(id);
  // Only asked for on the Add form — an existing outlet already owns its code.
  const { data: codeData } = useNextOutletCode(!editing);
  const { createOutlet, updateOutlet } = useAdminMutations();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(outletSchema),
    defaultValues: {
      name: '',
      status: 'active',
      colorToken: 'brand',
      address: { street: '', line2: '', city: '', region: 'ON', postal: '', country: 'Canada' },
      phone: '',
      email: '',
      manager: '',
      notes: '',
      hours: DAYS.map((day) => ({ day: day.key, open: '09:00', close: '17:00', closed: day.key === 'sun' })),
    },
  });

  useEffect(() => {
    if (!existing) return;
    reset({
      name: existing.name ?? '',
      status: existing.status ?? 'active',
      colorToken: existing.colorToken ?? 'brand',
      address: {
        street: existing.address?.street ?? '',
        line2: existing.address?.line2 ?? '',
        city: existing.address?.city ?? '',
        region: existing.address?.region ?? 'ON',
        postal: existing.address?.postal ?? '',
        country: existing.address?.country ?? 'Canada',
      },
      phone: existing.phone ?? '',
      email: existing.email ?? '',
      manager: existing.manager ?? '',
      notes: existing.notes ?? '',
      hours: existing.hours?.length
        ? existing.hours
        : DAYS.map((day) => ({ day: day.key, open: '09:00', close: '17:00', closed: day.key === 'sun' })),
    });
  }, [existing, reset]);

  const values = watch();

  async function onSubmit(payload) {
    try {
      if (editing) {
        await updateOutlet.mutateAsync({ id, ...payload });
        navigate(`/admin/outlets/${id}`);
      } else {
        const created = await createOutlet.mutateAsync(payload);
        navigate(`/admin/outlets/${created.id}`);
      }
    } catch (err) {
      setError('root', { message: err.message });
    }
  }

  const page = ADMIN_ROUTES[editing ? '/admin/outlets/:id' : '/admin/outlets/add'];

  if (editing && isLoading) {
    return <p className="text-sm text-ink-500">Loading outlet…</p>;
  }

  return (
    <>
      <PageHeader
        icon={adminIcon(editing ? 'Store' : 'PlusCircle')}
        title={editing ? `Edit ${existing?.name ?? 'outlet'}` : 'Add outlet'}
        description={page?.description}
        action={
          <Link
            to={editing ? `/admin/outlets/${id}` : '/admin/outlets'}
            className={cn(pressable, 'inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-ink-600 hover:border-line-strong hover:text-ink-900')}
          >
            Cancel
          </Link>
        }
      />

      {errors.root && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {errors.root.message}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Form left, preview right — and the preview drops below the form on a
            phone rather than competing with it for width. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex flex-col gap-4">
            <Panel title="Identity">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Outlet name"
                  placeholder="Cellvix Mississauga"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">Code</span>
                  <p className="flex h-10 items-center rounded-md border border-line bg-surface-2 px-3 font-mono text-sm text-ink-500">
                    {editing ? existing?.code : (codeData?.code ?? '…')}
                  </p>
                  {/* Assigned by the server so two operators adding a store at
                      the same moment cannot land on one number. */}
                  <p className="mt-1 text-xs text-ink-400">Assigned automatically.</p>
                </div>

                <SelectField
                  control={control}
                  name="status"
                  label="Status"
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ]}
                />

                <Controller
                  control={control}
                  name="colorToken"
                  render={({ field }) => (
                    <div>
                      <span className="mb-1.5 block text-sm font-medium text-ink-700">
                        Colour identity
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {OUTLET_COLOR_TOKENS.map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() => field.onChange(token)}
                            aria-pressed={field.value === token}
                            aria-label={COLOR_LABEL[token]}
                            title={COLOR_LABEL[token]}
                            className={cn(
                              pressable,
                              'flex size-8 items-center justify-center rounded-md border',
                              field.value === token
                                ? 'border-ink-900'
                                : 'border-line hover:border-line-strong',
                            )}
                          >
                            <span className={cn('size-4 rounded-full', COLOR_DOT[token])} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                />
              </div>
            </Panel>

            <Panel title="Contact & location">
              {/* Street lines first, then the country-keyed block. An outlet
                  can be anywhere the business opens one, and this form asked
                  every location for a Canadian province. */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Input label="Street" {...register('address.street')} />
                <Input label="Suite / unit" {...register('address.line2')} />
              </div>

              <AddressFields
                control={control}
                register={register}
                setValue={setValue}
                className="mb-4"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneField
                      label="Phone"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={errors.phone?.message}
                    />
                  )}
                />
                <Input label="Email" error={errors.email?.message} {...register('email')} />
              </div>
            </Panel>

            <Panel
              title="Management"
              description="Staff are assigned from the Users screen — an outlet does not own its roster."
            >
              <Input label="Manager" placeholder="Name of the person running this store" {...register('manager')} />
              <div className="mt-4">
                <Input label="Notes" {...register('notes')} />
              </div>
            </Panel>

            <Panel title="Hours">
              <div className="flex flex-col gap-2">
                {DAYS.map((day, index) => (
                  <div key={day.key} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-2">
                    <span className="text-sm text-ink-600">{day.label}</span>
                    <Input type="time" aria-label={`${day.label} open`} {...register(`hours.${index}.open`)} />
                    <Input type="time" aria-label={`${day.label} close`} {...register(`hours.${index}.close`)} />
                    <label className="flex items-center gap-1.5 text-sm text-ink-500">
                      <input type="checkbox" {...register(`hours.${index}.closed`)} />
                      Closed
                    </label>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="lg:sticky lg:top-4">
            <Panel title="Preview" description="How this store appears in the list.">
              <PreviewCard values={values} code={editing ? existing?.code : codeData?.code} />
            </Panel>

            <Button type="submit" fullWidth className="mt-3" loading={isSubmitting}>
              {editing ? 'Save changes' : 'Create outlet'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

export default AdminOutletFormPage;
