import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Truck } from 'lucide-react';

import Panel from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/admin/PageHeader';
import { SettingsFormActions } from '@/components/admin/settings/SettingsForm';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { money } from '@/lib/format';
import { useAdminSettings, useAdminMutations } from '@/hooks/useAdmin';

/**
 * Shipping Rates (§6.15) — the slot CellShoppe gives *Services*.
 *
 * CellShoppe's per-km mileage rate is dropped: Cellvix ships parts, it does not
 * drive to jobs. What replaces it is the thing checkout actually needed and had
 * been hard-coding — a flat rate per band, a free-over threshold, and the copy
 * the buyer reads beside each one.
 *
 * **Bands cannot be added or removed here, only priced.** Checkout validates
 * `deliveryMethod` against a fixed enum in `shared/schemas/checkout.js`, so a
 * fourth band invented on this screen would be unselectable, and deleting one
 * would break every order that already names it. What an operator actually
 * needs to change is the money, and that is what this edits.
 *
 * Amounts are entered in dollars and stored in cents, like everywhere else.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/settings/shipping'], icon: adminIcon('Truck') };

const toDollars = (cents) => (cents === null || cents === undefined ? '' : String(cents / 100));
const toCents = (dollars) =>
  dollars === '' || dollars === null || dollars === undefined
    ? null
    : Math.round(Number(dollars) * 100);

export function AdminShippingSettingsPage() {
  const { data, isLoading } = useAdminSettings();
  const { saveShippingSettings } = useAdminMutations();
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    control,
    formState: { errors, isDirty, isSubmitting },
    // No resolver: the form works in dollars and the API in cents, so the
    // shared schema does not describe this shape. `shippingSettingsSchema`
    // validates the converted payload server-side, and the numeric bounds the
    // operator can hit are on the fields themselves.
  } = useForm({ defaultValues: { methods: [] } });

  const { fields } = useFieldArray({ control, name: 'methods' });
  const watched = watch('methods');

  const fromServer = (methods) => ({
    methods: methods.map((row) => ({
      code: row.code,
      label: row.label,
      detail: row.detail ?? '',
      etaDays: row.etaDays,
      cost: toDollars(row.cost),
      freeOver: toDollars(row.freeOver),
    })),
  });

  useEffect(() => {
    if (!data?.financial?.shippingMethods || isDirty) return;
    reset(fromServer(data.financial.shippingMethods));
  }, [data, isDirty, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values) {
    setSaved(false);
    try {
      const next = await saveShippingSettings.mutateAsync({
        methods: values.methods.map((row) => ({
          code: row.code,
          label: row.label,
          detail: row.detail,
          etaDays: Number(row.etaDays),
          cost: toCents(row.cost) ?? 0,
          // Empty means "never ships free". Stored as null rather than 0,
          // which would mean every order ships free.
          freeOver: toCents(row.freeOver),
        })),
      });
      reset(fromServer(next.financial.shippingMethods));
      setSaved(true);
    } catch (err) {
      setError('root', { message: err.message });
    }
  }

  if (isLoading) return <p className="text-sm text-ink-500">Loading settings…</p>;

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-form space-y-4">
        {fields.map((field, index) => {
          const row = watched?.[index] ?? {};
          const cost = toCents(row.cost) ?? 0;
          const freeOver = toCents(row.freeOver);

          return (
            <Panel
              key={field.id}
              title={
                <span className="flex items-center gap-2">
                  <Truck className="size-4 text-ink-400" strokeWidth={2} aria-hidden="true" />
                  {field.label || field.code}
                </span>
              }
              description={
                freeOver === null
                  ? `${cost === 0 ? 'Always free' : money(cost)} — never ships free on order value.`
                  : `${cost === 0 ? 'Free' : money(cost)}, free over ${money(freeOver)}.`
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Name"
                  hint="What the buyer sees at checkout."
                  {...register(`methods.${index}.label`)}
                />
                {/* The hint used to quote “2–4 business days” as its example,
                    which is the Ground band's own value. On every other band it
                    sat directly under a field reading something else — "Next
                    business day" on Express — so the hint appeared to be
                    correcting the value beside it rather than describing the
                    field. An example is only an example while it is not also
                    one of the answers on screen. */}
                <Input
                  label="Description"
                  hint="The line shown under the name at checkout."
                  {...register(`methods.${index}.detail`)}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label="Rate"
                  suffix="CAD"
                  {...register(`methods.${index}.cost`)}
                />
                <Input
                  type="number"
                  min="0"
                  max="60"
                  label="Estimated days"
                  suffix="days"
                  hint="Drives the delivery estimate on an order."
                  {...register(`methods.${index}.etaDays`)}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label="Free over"
                  suffix="CAD"
                  containerClassName="sm:col-span-2"
                  hint="Order value at which this band ships free. Leave empty for never."
                  {...register(`methods.${index}.freeOver`)}
                />
              </div>
            </Panel>
          );
        })}

        <p className="text-sm leading-relaxed text-ink-500">
          Bands cannot be added or removed here. Checkout validates the delivery method against a
          fixed set, so a new band would be unselectable and removing one would break the orders that
          already name it.
        </p>

        <SettingsFormActions
          dirty={isDirty}
          saving={isSubmitting || saveShippingSettings.isPending}
          saved={saved}
          error={errors.root?.message}
          onReset={() => {
            reset();
            setSaved(false);
          }}
        />
      </form>
    </>
  );
}

export default AdminShippingSettingsPage;
