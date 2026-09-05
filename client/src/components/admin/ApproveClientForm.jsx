import { useForm, Controller } from 'react-hook-form';
import { AlertCircle, Check } from 'lucide-react';
import Input from '@/components/ui/Input';
import PhoneField from '@/components/ui/PhoneField';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';

/**
 * Approving a business account.
 *
 * Credit limit and terms are set here rather than on a later screen: deciding
 * whether to approve a business and deciding what credit to extend it are the
 * same decision, made from the same information.
 *
 * **This lives in `components/` because two screens open it** — the approvals
 * queue and the notification bell's inline `Approve` (§7.3). Forking it would
 * mean one of them eventually approves an account without setting terms, which
 * is exactly the mistake the single form exists to prevent.
 */

/** Payment terms, in the order an operator reads them. */
export const TERMS = [
  { value: 'prepaid', label: 'Prepaid — pay at checkout' },
  { value: 'net15', label: 'Net 15' },
  { value: 'net30', label: 'Net 30' },
  { value: 'net60', label: 'Net 60' },
];

export function ApproveClientForm({ user, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, watch, control } = useForm({
    defaultValues: {
      creditLimitDollars: 5000,
      terms: 'net30',
      repName: 'Marc Deveau',
      repEmail: 'marc@cellvix.ca',
      // Already in the composed shape `PhoneField` reads and writes, so the
      // field does not silently reformat its own default on first paint.
      repPhone: '+1 416 555 0110',
    },
  });

  const terms = watch('terms');

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          // The API takes integer cents; the form takes dollars, because that is
          // what the person setting a limit is thinking in.
          creditLimit: Math.round(Number(values.creditLimitDollars) * 100) || 0,
          terms: values.terms,
          accountRep: {
            name: values.repName,
            email: values.repEmail,
            phone: values.repPhone,
          },
        }),
      )}
      className="space-y-4"
    >
      <div className="rounded-md bg-surface-2 p-3.5">
        <p className="font-display text-md font-bold text-ink-900">{user.businessName}</p>
        {/* The bell opens this knowing only the account's name, so the contact
            line is joined from what is actually there — a bare "·" between two
            blanks reads as data that failed to load. */}
        {[user.contactName, user.email].filter(Boolean).length > 0 && (
          <p className="mt-0.5 text-sm text-ink-500">
            {[user.contactName, user.email].filter(Boolean).join(' · ')}
          </p>
        )}
        {user.taxId && (
          <p className="mt-1 font-mono text-xs text-ink-400">Tax ID {user.taxId}</p>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Credit limit"
          inputMode="numeric"
          suffix="CAD"
          hint={terms === 'prepaid' ? 'Not used on prepaid terms.' : 'Drawn against by terms orders.'}
          disabled={terms === 'prepaid'}
          {...register('creditLimitDollars')}
        />
        <SelectField control={control} name="terms" label="Payment terms" options={TERMS} />
      </div>

      <fieldset className="rounded-md border border-line p-3.5">
        <legend className="eyebrow px-1 text-ink-400">Account representative</legend>
        <div className="space-y-3">
          <Input label="Name" {...register('repName')} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email" type="email" {...register('repEmail')} />
            <Controller
              name="repPhone"
              control={control}
              render={({ field }) => (
                <PhoneField
                  label="Phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>
        </div>
      </fieldset>

      <p className="rounded-md bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
        Approving unlocks wholesale pricing, ordering and the account dashboard for this business.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Check} loading={isPending}>
          Approve account
        </Button>
      </div>
    </form>
  );
}

export default ApproveClientForm;
