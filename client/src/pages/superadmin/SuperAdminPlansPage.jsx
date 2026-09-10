import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Plus, ShieldAlert } from 'lucide-react';
import { money, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { toast } from '@/store/toastStore';
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
 * Deliberately thin for now: name, price, and how many businesses the tier
 * includes. Per-plan feature defaults are stored and resolved but not yet
 * editable here — the per-business grid is where an operator actually reaches
 * for a switch, and a second place to set the same thing is a second place for
 * the two to disagree.
 */
export function SuperAdminPlansPage() {
  const { data, isLoading } = usePlans();
  const { createPlan } = useSuperAdminMutations();
  const [creating, setCreating] = useState(false);

  const plans = data?.plans ?? [];

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: { name: '', description: '', priceCents: 0, includedSlots: 1 },
  });

  const columns = [
    {
      key: 'name',
      header: 'Plan',
      priority: 1,
      sortValue: (plan) => plan.name,
      render: (plan) => (
        <>
          <span className="block text-sm font-medium text-ink-900">{plan.name}</span>
          {plan.description && (
            <span className="block truncate text-xs text-ink-400">{plan.description}</span>
          )}
        </>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      priority: 1,
      align: 'right',
      className: 'tnum',
      sortValue: (plan) => plan.priceCents,
      render: (plan) => (
        <>
          <span className="text-sm font-semibold text-ink-900">{money(plan.priceCents)}</span>
          <span className="block text-2xs text-ink-400">per month</span>
        </>
      ),
    },
    {
      key: 'slots',
      header: 'Businesses',
      priority: 2,
      align: 'right',
      className: 'tnum',
      sortValue: (plan) => plan.includedSlots,
      render: (plan) => (
        <span className="text-sm text-ink-700">{formatCount(plan.includedSlots)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 2,
      render: (plan) => (
        <Badge tone={plan.isActive ? 'ok' : 'neutral'} size="sm">
          {plan.isActive ? 'offered' : 'retired'}
        </Badge>
      ),
    },
  ];

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
        icon={ShieldAlert}
        title="Plans"
        description="The tiers a tenant subscribes to, and how many businesses each includes."
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New plan
          </Button>
        }
      />

      <Panel flush>
        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine total={plans.length} noun={plans.length === 1 ? 'plan' : 'plans'} />
        </div>

        <DataTable
          columns={columns}
          rows={plans}
          rowKey={(plan) => plan.id}
          defaultSort={{ key: 'price', direction: 'asc' }}
          empty={
            <PanelEmpty
              icon={ShieldAlert}
              title="No plans yet"
              body="A plan sets what a tenant pays and how many businesses they may run."
              action={
                <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                  New plan
                </Button>
              }
            />
          }
        />
      </Panel>

      <Modal
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
            <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {createPlan.error.message}
            </p>
          )}

          <Input
            label="Plan name"
            required
            placeholder="Growth"
            {...register('name', { required: 'Give the plan a name.' })}
            error={formState.errors.name?.message}
          />

          <Textarea
            label="Description"
            rows={2}
            placeholder="Up to three businesses, with marketing and reporting."
            containerClassName="mt-3"
            {...register('description')}
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              label="Price"
              inputMode="decimal"
              suffix="$"
              placeholder="149.00"
              hint="Per month."
              {...register('priceCents')}
            />
            <Input
              label="Businesses included"
              type="number"
              min="0"
              required
              {...register('includedSlots')}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" icon={Plus} loading={createPlan.isPending}>
              Create plan
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default SuperAdminPlansPage;
