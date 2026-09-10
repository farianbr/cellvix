import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  Building2,
  Check,
  Layers,
  Lock,
  Plus,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import { money, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import SelectMenu from '@/components/ui/SelectMenu';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import { toast } from '@/store/toastStore';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';
import {
  useTenants,
  usePlans,
  useBusinessFeatures,
  useSuperAdminMutations,
} from '@/hooks/useSuperAdmin';

/**
 * Tenants, the businesses they own, and what each business may do.
 *
 * **The three things a super admin actually does** (§4.5): create a tenant,
 * grant it slots, and toggle features per business. Everything else the console
 * could show — revenue, usage, a tenant's own records — is deliberately absent:
 * an operator who can read every tenant's books is a breach waiting for one
 * stolen laptop, and the server returns none of it.
 */

const TYPE_TONES = { product: 'info', service: 'brand', both: 'ok' };
const STATUS_TONES = { active: 'ok', suspended: 'warn', cancelled: 'danger' };

const BUSINESS_TYPES = [
  { value: 'product', label: 'Product — sells goods' },
  { value: 'service', label: 'Service — sells work' },
  { value: 'both', label: 'Both — goods and work' },
];

/**
 * The feature grid for one business.
 *
 * **`source` is what makes this honest.** A key that is on because the business
 * type says so reads differently from one somebody switched on, and a grid
 * showing only the effective value would make an override indistinguishable
 * from a default — so an operator could not tell what they had changed.
 *
 * A locked key renders as locked rather than being hidden: "this cannot be
 * switched off" is information, and omitting it would leave somebody hunting
 * for a row that is not there.
 */
function FeatureGrid({ businessId, onClose }) {
  const { data, isLoading } = useBusinessFeatures(businessId);
  const { setFeature } = useSuperAdminMutations();
  const [error, setError] = useState(null);

  if (isLoading) return <Skeleton className="h-64" rounded="lg" />;
  if (!data) return null;

  const byArea = data.features.reduce((acc, feature) => {
    (acc[feature.area] ??= []).push(feature);
    return acc;
  }, {});

  function toggle(feature) {
    setError(null);
    setFeature.mutate(
      {
        id: businessId,
        key: feature.key,
        // Switching a key that is already an override back to its default is a
        // third state, reachable from the Reset control rather than the toggle.
        enabled: !feature.enabled,
      },
      { onError: (err) => setError(err.message) },
    );
  }

  function reset(feature) {
    setError(null);
    setFeature.mutate(
      { id: businessId, key: feature.key, enabled: null },
      { onError: (err) => setError(err.message) },
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-ink-500">
        {data.business.name} is a{' '}
        <strong className="font-semibold text-ink-700">{data.business.businessType}</strong>{' '}
        business
        {data.business.plan ? ` on the ${data.business.plan.name} plan` : ''}. The type sets the
        starting point; anything switched here overrides it.
      </p>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="space-y-4">
        {Object.entries(byArea).map(([area, features]) => (
          <section key={area}>
            <h3 className="eyebrow mb-1.5 text-ink-400">{area}</h3>
            <ul className="divide-y divide-line rounded-md border border-line">
              {features.map((feature) => (
                <li key={feature.key} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-900">
                      {feature.label}
                      {feature.locked && (
                        <Badge tone="neutral" size="sm" icon={Lock}>
                          always on
                        </Badge>
                      )}
                      {feature.source === 'override' && (
                        <Badge tone="brand" size="sm">
                          overridden
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-ink-400">{feature.description}</p>
                  </div>

                  {feature.source === 'override' && (
                    <button
                      type="button"
                      onClick={() => reset(feature)}
                      className={cn(
                        pressable,
                        'shrink-0 self-center text-xs font-medium text-ink-400 hover:text-ink-900',
                      )}
                    >
                      Reset
                    </button>
                  )}

                  {/* A switch, not a checkbox: this is a setting that takes
                      effect immediately, not one field of a form somebody is
                      about to submit. */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={feature.enabled}
                    aria-label={`${feature.label} for ${data.business.name}`}
                    disabled={feature.locked || setFeature.isPending}
                    onClick={() => toggle(feature)}
                    className={cn(
                      pressable,
                      'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-snap',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      feature.enabled ? 'bg-ok' : 'bg-ink-200',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-snap',
                        feature.enabled ? 'left-[18px]' : 'left-0.5',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}

/** Create a tenant, or add a business to one. Both spend nothing until saved. */
function TenantForm({ onSubmit, onCancel, isPending, error, plans }) {
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { name: '', contactName: '', contactEmail: '', slots: 1, plan: '' },
  });
  const [plan, setPlan] = useState('');

  return (
    <form onSubmit={handleSubmit((values) => onSubmit({ ...values, plan }))}>
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Input
        label="Tenant name"
        required
        placeholder="Northline Group"
        {...register('name', { required: 'Give the tenant a name.' })}
        error={formState.errors.name?.message}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input label="Contact name" placeholder="Dana Whitfield" {...register('contactName')} />
        <Input
          label="Contact email"
          type="email"
          placeholder="dana@northline.ca"
          {...register('contactEmail')}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input
          label="Business slots"
          type="number"
          min="0"
          required
          hint="How many businesses this tenant may run."
          {...register('slots')}
        />
        <div>
          <p className="eyebrow mb-1.5 text-ink-400">Plan</p>
          <SelectMenu
            srLabel="Plan"
            value={plan}
            onChange={setPlan}
            options={[
              { value: '', label: 'No plan' },
              ...plans.map((row) => ({ value: row.id, label: row.name })),
            ]}
            containerClassName="w-full"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Plus} loading={isPending}>
          Create tenant
        </Button>
      </div>
    </form>
  );
}

function BusinessForm({ tenant, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, formState } = useForm({ defaultValues: { name: '' } });
  const [businessType, setBusinessType] = useState('product');

  return (
    <form onSubmit={handleSubmit((values) => onSubmit({ ...values, businessType }))}>
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <p className="mb-3 text-sm text-ink-500">
        {tenant.name} has {formatCount(tenant.slotsFree)} slot
        {tenant.slotsFree === 1 ? '' : 's'} left. Creating a business spends one.
      </p>

      <Input
        label="Business name"
        required
        placeholder="Northline Repairs"
        {...register('name', { required: 'Give the business a name.' })}
        error={formState.errors.name?.message}
      />

      <div className="mt-3">
        <p className="eyebrow mb-1.5 text-ink-400">Business type</p>
        <SelectMenu
          srLabel="Business type"
          value={businessType}
          onChange={setBusinessType}
          options={BUSINESS_TYPES}
          containerClassName="w-full"
        />
        {/* The type is what decides which sections the panel renders, so it is
            worth saying rather than leaving to be discovered. */}
        <p className="mt-1.5 text-xs text-ink-400">
          A product business gets Orders and Returns; a service business gets Tickets and Quotes.
          Either can be changed afterwards, one feature at a time.
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Plus} loading={isPending}>
          Create business
        </Button>
      </div>
    </form>
  );
}

/**
 * Grant or revoke slots.
 *
 * States the floor rather than only enforcing it: the server refuses fewer
 * slots than the tenant already uses, and an operator should learn that before
 * the click rather than from an error afterwards.
 */
function SlotsForm({ tenant, onSubmit, onCancel, isPending, error }) {
  const [slots, setSlots] = useState(String(tenant.slots));
  const value = Number(slots);
  const tooFew = Number.isFinite(value) && value < tenant.slotsUsed;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!tooFew) onSubmit(value);
      }}
    >
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Input
        label="Business slots"
        type="number"
        min={tenant.slotsUsed}
        required
        value={slots}
        onChange={(event) => setSlots(event.target.value)}
        hint={`${tenant.name} runs ${formatCount(tenant.slotsUsed)} business${tenant.slotsUsed === 1 ? '' : 'es'} today.`}
        error={tooFew ? `Cannot go below ${tenant.slotsUsed} — that is what is already running.` : undefined}
      />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Check} loading={isPending} disabled={tooFew}>
          Update slots
        </Button>
      </div>
    </form>
  );
}

export function SuperAdminTenantsPage() {
  const { data, isLoading } = useTenants();
  const { data: planData } = usePlans();
  const { createTenant, createBusiness, setSlots } = useSuperAdminMutations();

  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [featuresFor, setFeaturesFor] = useState(null);
  // A modal rather than `window.prompt`: the panel already ruled that out once
  // for the rejection reason, on the grounds that it was the one control on the
  // page that did not look like the rest of the app.
  const [slotsFor, setSlotsFor] = useState(null);
  const [error, setError] = useState(null);

  const tenants = data?.tenants ?? [];
  const unassigned = data?.unassigned ?? [];
  const plans = planData?.plans ?? [];

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-40 w-full" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={Layers}
        title="Tenants"
        description="Who runs on the platform, what they may run, and what each business can do."
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New tenant
          </Button>
        }
      />

      {!tenants.length ? (
        <Panel>
          <PanelEmpty
            icon={Layers}
            title="No tenants yet"
            body="A tenant is an account that owns one or more businesses. Create one to get started."
            action={
              <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                New tenant
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <Panel
              key={tenant.id}
              icon={Layers}
              title={tenant.name}
              description={
                [
                  tenant.plan?.name ?? 'No plan',
                  `${formatCount(tenant.slotsUsed)} of ${formatCount(tenant.slots)} slots used`,
                  tenant.contactEmail,
                ]
                  .filter(Boolean)
                  .join(' · ')
              }
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONES[tenant.status] ?? 'neutral'} size="sm">
                    {tenant.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={SlidersHorizontal}
                    onClick={() => setSlotsFor(tenant)}
                  >
                    Slots
                  </Button>
                  <Button
                    size="sm"
                    icon={Plus}
                    disabled={tenant.slotsFree <= 0}
                    onClick={() => setAddingTo(tenant)}
                  >
                    Add business
                  </Button>
                </div>
              }
            >
              {!tenant.businesses.length ? (
                <p className="text-sm text-ink-500">
                  No businesses yet. This tenant has {formatCount(tenant.slotsFree)} slot
                  {tenant.slotsFree === 1 ? '' : 's'} to spend.
                </p>
              ) : (
                <ul className="space-y-2">
                  {tenant.businesses.map((business) => (
                    <li
                      key={business.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2.5"
                    >
                      <Building2
                        className="size-4 shrink-0 text-ink-300"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">
                          {business.name}
                        </span>
                        <span className="block font-mono text-xs text-ink-400">
                          {business.code}
                        </span>
                      </span>

                      <Badge tone={TYPE_TONES[business.businessType] ?? 'neutral'} size="sm">
                        {business.businessType}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Settings2}
                        onClick={() => setFeaturesFor(business)}
                      >
                        Features
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      )}

      {/* A business owned by nobody is a real state somebody has to resolve, and
          hiding it would make the slot arithmetic disagree with the database. */}
      {unassigned.length > 0 && (
        <Panel
          icon={AlertCircle}
          title="Not assigned to a tenant"
          description="These businesses predate tenants. Assign them so their slots are counted."
          className="mt-3"
        >
          <ul className="space-y-2">
            {unassigned.map((business) => (
              <li
                key={business.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-warn/30 bg-warn-50 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">
                  {business.name}
                </span>
                <Badge tone={TYPE_TONES[business.businessType] ?? 'neutral'} size="sm">
                  {business.businessType}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New tenant" size="md" align="top">
        <TenantForm
          plans={plans}
          isPending={createTenant.isPending}
          error={createTenant.error?.message}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            createTenant.mutate(values, {
              onSuccess: () => {
                setCreating(false);
                toast.ok('Tenant created', `${values.name} is on the platform.`);
              },
            })
          }
        />
      </Modal>

      <Modal
        open={Boolean(addingTo)}
        onClose={() => setAddingTo(null)}
        title={`Add a business to ${addingTo?.name ?? ''}`}
        size="md"
        align="top"
      >
        {addingTo && (
          <BusinessForm
            tenant={addingTo}
            isPending={createBusiness.isPending}
            error={createBusiness.error?.message}
            onCancel={() => setAddingTo(null)}
            onSubmit={(values) =>
              createBusiness.mutate(
                { id: addingTo.id, ...values },
                {
                  onSuccess: () => {
                    setAddingTo(null);
                    toast.ok('Business created', `${values.name} is ready to configure.`);
                  },
                },
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(slotsFor)}
        onClose={() => setSlotsFor(null)}
        title={`Business slots — ${slotsFor?.name ?? ''}`}
        size="sm"
        align="top"
      >
        {slotsFor && (
          <SlotsForm
            tenant={slotsFor}
            isPending={setSlots.isPending}
            error={setSlots.error?.message}
            onCancel={() => setSlotsFor(null)}
            onSubmit={(slots) =>
              setSlots.mutate(
                { id: slotsFor.id, slots },
                {
                  onSuccess: () => {
                    setSlotsFor(null);
                    toast.ok('Slots updated', `${slotsFor.name} now has ${slots}.`);
                  },
                },
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(featuresFor)}
        onClose={() => setFeaturesFor(null)}
        title={`Features — ${featuresFor?.name ?? ''}`}
        size="lg"
        align="top"
      >
        {featuresFor && (
          <FeatureGrid businessId={featuresFor.id} onClose={() => setFeaturesFor(null)} />
        )}
      </Modal>
    </>
  );
}

export default SuperAdminTenantsPage;
