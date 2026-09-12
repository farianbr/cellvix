import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Check, Pencil, Plus, ShieldAlert } from 'lucide-react';
import { money, count as formatCount } from '@/lib/format';
import Skeleton from '@/components/ui/Skeleton';
import {
  PlatformBadge,
  PlatformButton,
  PlatformEmpty,
  PlatformHeader,
  PlatformPanel,
  PlatformRow,
} from '@/components/superadmin/PlatformUI';
import {
  PlatformActions,
  PlatformError,
  PlatformInput,
  PlatformModal,
  PlatformNotice,
} from '@/components/superadmin/PlatformForm';
import { toast } from '@/store/toastStore';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';
import { usePlans, useSuperAdminMutations } from '@/hooks/useSuperAdmin';

/**
 * Subscription tiers.
 *
 * **A plan sets feature defaults; it does not enforce anything.** It sits in the
 * middle of the resolution chain — business-type defaults, then plan defaults,
 * then per-business overrides — so it widens or narrows what a business starts
 * with. `requireFeature` is the only thing that refuses a request at runtime,
 * and it reads the resolved set.
 *
 * **Feature defaults are editable here, and per-business overrides still beat
 * them.** The two screens are not two ways to set one thing: a plan default is
 * what every business on the tier starts with, and an override is one business
 * departing from that. The per-business grid names which of the two produced
 * each answer, so they cannot silently disagree.
 */
/**
 * Edit a plan, including the feature defaults its subscribers inherit.
 *
 * **A change here reaches every tenant on the plan immediately** —
 * `resolveFeatures` reads `featureDefaults` on each request, so there is no
 * migration and no delay. That is intended, and it is why the subscriber count
 * is stated at the top rather than left to be looked up: raising a price is a
 * billing conversation, but switching a default off is something several
 * businesses notice at once.
 */
function PlanEditor({ plan, features, onClose }) {
  const { updatePlan, setPlanFeature } = useSuperAdminMutations();
  const [error, setError] = useState(null);

  const { register, handleSubmit, formState } = useForm({
    defaultValues: {
      name: plan.name,
      description: plan.description ?? '',
      priceCents: plan.priceCents,
      includedSlots: plan.includedSlots,
    },
  });

  const defaults = plan.featureDefaults ?? {};

  return (
    <>
      {plan.tenantCount > 0 && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-plat-warn/10 px-3 py-2.5 text-sm text-plat-text">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-plat-warn" strokeWidth={2} aria-hidden="true" />
          <span>
            {formatCount(plan.tenantCount)} tenant{plan.tenantCount === 1 ? '' : 's'} on this plan.
            Feature changes take effect for all of them straight away.
          </span>
        </p>
      )}

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-plat-danger/10 px-3 py-2.5 text-sm text-plat-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit((values) => {
          setError(null);
          updatePlan.mutate(
            { id: plan.id, ...values },
            {
              onSuccess: () => toast.ok('Plan saved', `${values.name} updated.`),
              onError: (err) => setError(err.message),
            },
          );
        })}
      >
        <PlatformInput
          label="Name"
          required
          {...register('name', { required: 'Give the plan a name.' })}
          error={formState.errors.name?.message}
        />
        <div className="mt-3">
          <PlatformInput label="Description" {...register('description')} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PlatformInput
            label="Price (cents per month)"
            type="number"
            min={0}
            {...register('priceCents', { valueAsNumber: true })}
          />
          <PlatformInput
            label="Businesses included"
            type="number"
            min={0}
            {...register('includedSlots', { valueAsNumber: true })}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <PlatformButton type="submit" icon={Check} loading={updatePlan.isPending}>
            Save plan
          </PlatformButton>
        </div>
      </form>

      {/*
        Feature defaults sit under the form and save on click rather than on
        submit, because they are per-key settings rather than fields of one
        record — the same choice the per-business grid makes, for the same
        reason.
      */}
      <div className="mt-5 border-t border-plat-line-soft pt-4">
        <p className="eyebrow mb-1.5 text-plat-dim">Feature defaults</p>
        <p className="mb-3 text-xs text-plat-dim">
          What a business on this plan starts with. Anything not set here falls back to the
          business type, and a business's own override still beats both.
        </p>

        <ul className="divide-y divide-plat-line-soft rounded-md border border-plat-line-soft">
          {features
            .filter((feature) => !feature.locked)
            .map((feature) => {
              const set = Object.prototype.hasOwnProperty.call(defaults, feature.key);
              const on = defaults[feature.key];

              return (
                <li key={feature.key} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-plat-text">{feature.label}</span>
                    <span className="block text-xs text-plat-dim">
                      {set ? `Plan says ${on ? 'on' : 'off'}` : 'Falls back to the business type'}
                    </span>
                  </span>

                  <span className="flex shrink-0 gap-1">
                    {['on', 'off', 'default'].map((choice) => {
                      const active =
                        (choice === 'on' && set && on) ||
                        (choice === 'off' && set && !on) ||
                        (choice === 'default' && !set);

                      return (
                        <button
                          key={choice}
                          type="button"
                          disabled={setPlanFeature.isPending}
                          onClick={() => {
                            setError(null);
                            setPlanFeature.mutate(
                              {
                                id: plan.id,
                                key: feature.key,
                                // `null` clears the key — a third state, and the
                                // only way back to the type's own default.
                                enabled: choice === 'default' ? null : choice === 'on',
                              },
                              { onError: (err) => setError(err.message) },
                            );
                          }}
                          className={cn(
                            pressable,
                            'rounded-md px-2 py-1 text-xs font-medium',
                            active
                              ? 'bg-plat-accent text-white'
                              : 'bg-plat-raised text-plat-muted hover:text-plat-text',
                          )}
                        >
                          {choice}
                        </button>
                      );
                    })}
                  </span>
                </li>
              );
            })}
        </ul>
      </div>

      <div className="mt-4 flex justify-end">
        <PlatformButton variant="ghost" onClick={onClose}>
          Done
        </PlatformButton>
      </div>
    </>
  );
}

export function SuperAdminPlansPage() {
  const { data, isLoading } = usePlans();
  const { createPlan } = useSuperAdminMutations();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const plans = data?.plans ?? [];

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: { name: '', description: '', priceCents: 0, includedSlots: 1 },
  });


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
      <PlatformHeader
        title="Plans"
        description="The tiers a tenant subscribes to, and how many businesses each includes."
        action={
          <PlatformButton variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New plan
          </PlatformButton>
        }
      />

      {/*
        Rows rather than a `DataTable`.

        The admin panel's table is a Cellvix component with its light surface
        baked in, and three plans do not need sorting, density control or column
        management — the controls would outnumber the data. A row per plan reads
        at a glance and carries the console's own palette.
      */}
      <PlatformPanel>
        {!plans.length ? (
          <PlatformEmpty
            icon={ShieldAlert}
            title="No plans yet"
            body="A plan sets what a tenant pays and how many businesses they may run."
            action={
              <PlatformButton variant="primary" size="sm" icon={Plus} onClick={() => setCreating(true)}>
                New plan
              </PlatformButton>
            }
          />
        ) : (
          <ul className="space-y-2">
            {plans.map((plan) => (
              <li key={plan.id}>
                <PlatformRow>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-plat-text">{plan.name}</span>
                      <PlatformBadge tone={plan.isActive ? 'ok' : 'neutral'}>
                        {plan.isActive ? 'offered' : 'retired'}
                      </PlatformBadge>
                    </span>
                    {plan.description && (
                      <span className="mt-0.5 block truncate text-xs text-plat-muted">
                        {plan.description}
                      </span>
                    )}
                  </span>

                  {/* Figures are right-aligned and tabular so the column reads
                      as a column rather than as ragged text. */}
                  <span className="tnum shrink-0 text-right">
                    <span className="block text-sm font-semibold text-plat-text">
                      {money(plan.priceCents)}
                    </span>
                    <span className="block text-xs text-plat-dim">per month</span>
                  </span>

                  <span className="tnum w-24 shrink-0 text-right text-xs text-plat-muted">
                    <span className="block">{formatCount(plan.includedSlots)} businesses</span>
                    <span className="block text-plat-dim">
                      {formatCount(plan.tenantCount ?? 0)} on this plan
                    </span>
                  </span>

                  <PlatformButton size="sm" icon={Pencil} onClick={() => setEditing(plan)}>
                    Edit
                  </PlatformButton>
                </PlatformRow>
              </li>
            ))}
          </ul>
        )}
      </PlatformPanel>

      <PlatformModal
        open={creating}
        onClose={() => setCreating(false)}
        title="New plan"
        size="md"
        align="top"
      >
        <form
          onSubmit={handleSubmit((values) =>
            createPlan.mutate(
              {
                ...values,
                // Typed in dollars, sent in cents — the boundary every money
                // field in this app crosses here rather than server-side.
                priceCents: Math.round(Number(values.priceCents || 0) * 100),
              },
              {
                onSuccess: () => {
                  setCreating(false);
                  reset();
                  toast.ok('Plan created', `${values.name} can now be assigned to a tenant.`);
                },
              },
            ),
          )}
        >
          {createPlan.error && (
            <p className="mb-3 flex items-start gap-2 rounded-md bg-plat-danger/10 px-3 py-2.5 text-sm text-plat-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {createPlan.error.message}
            </p>
          )}

          <PlatformInput
            label="Plan name"
            required
            placeholder="Growth"
            {...register('name', { required: 'Give the plan a name.' })}
            error={formState.errors.name?.message}
          />

          <PlatformInput
            label="Description"
            rows={2}
            placeholder="Up to three businesses, with marketing and reporting."
            containerClassName="mt-3"
            {...register('description')}
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PlatformInput
              label="Price"
              inputMode="decimal"
              suffix="$"
              placeholder="149.00"
              hint="Per month."
              {...register('priceCents')}
            />
            <PlatformInput
              label="Businesses included"
              type="number"
              min="0"
              required
              {...register('includedSlots')}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <PlatformButton variant="ghost" type="button" onClick={() => setCreating(false)}>
              Cancel
            </PlatformButton>
            <PlatformButton type="submit" icon={Plus} loading={createPlan.isPending}>
              Create plan
            </PlatformButton>
          </div>
        </form>
      </PlatformModal>

      <PlatformModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? ''}`}
        size="lg"
        align="top"
      >
        {editing && (
          <PlanEditor
            // Re-read from the list so the editor shows the saved state after a
            // feature toggle, rather than the snapshot taken when it opened.
            plan={plans.find((row) => row.id === editing.id) ?? editing}
            features={data?.features ?? []}
            onClose={() => setEditing(null)}
          />
        )}
      </PlatformModal>
    </>
  );
}

export default SuperAdminPlansPage;
