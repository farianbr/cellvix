import { useForm } from 'react-hook-form';
import { AlertCircle, MapPin, Save, User, X } from 'lucide-react';
import { PROVINCES } from '@shared/schemas/checkout';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';

/**
 * The customer profile form, shared by the edit screen and anything else that
 * needs to change who an account *is*.
 *
 * **Status, credit limit and terms are deliberately absent**, and the note at
 * the foot says where they live. Each is set by an endpoint that does more than
 * write the field — approving stamps who approved it and mints a referral code,
 * rejecting requires a reason, the credit limit is the line of credit — so a
 * form that also wrote them would be a second, quieter version of those
 * decisions. `clientUpdateSchema` strips them server-side regardless, so this
 * is the UI agreeing with a rule that is already enforced.
 *
 * **Two columns, contact and address**, matching the shape the client asked
 * for: the fields somebody reads out over the phone on one side, the ones they
 * copy off a delivery note on the other.
 */
export function CustomerForm({ user, onSubmit, onCancel, isPending, error }) {
  const existing = user.addresses?.find((address) => address.isDefaultShipping) ?? {};

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      businessName: user.businessName ?? '',
      contactName: user.contactName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      businessType: user.businessType ?? '',
      website: user.website ?? '',
      taxId: user.taxId ?? '',
      address: {
        line1: existing.line1 ?? '',
        line2: existing.line2 ?? '',
        city: existing.city ?? '',
        region: existing.region ?? 'ON',
        postal: existing.postal ?? '',
      },
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          businessName: values.businessName,
          contactName: values.contactName,
          email: values.email,
          phone: values.phone,
          // Sent even when empty: an empty string is how the operator clears a
          // descriptor, and the server reads it as a deletion.
          businessType: values.businessType,
          website: values.website,
          taxId: values.taxId,
          // A half-typed address is still not sent — the schema requires a
          // complete one, so an empty street line means "no address".
          address: values.address.line1 ? values.address : undefined,
        }),
      )}
      className="space-y-5"
    >
      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="eyebrow mb-3 flex items-center gap-1.5 border-b border-line pb-2 text-ink-400">
            <User className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Contact details
          </h2>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Business name"
                error={errors.businessName?.message}
                {...register('businessName', {
                  required: 'Enter a business name.',
                  minLength: { value: 2, message: 'Enter a business name.' },
                })}
              />
              <Input
                label="Contact name"
                error={errors.contactName?.message}
                {...register('contactName', {
                  required: 'Enter a contact name.',
                  minLength: { value: 2, message: 'Enter a contact name.' },
                })}
              />
            </div>

            <Input
              label="Email"
              type="email"
              hint="This is the account's sign-in address."
              error={errors.email?.message}
              {...register('email', { required: 'Enter an email address.' })}
            />

            <Input
              label="Phone"
              type="tel"
              error={errors.phone?.message}
              {...register('phone', {
                required: 'Enter a phone number.',
                minLength: { value: 7, message: 'Enter a phone number.' },
              })}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Business type"
                placeholder="Repair shop"
                hint="Shown as the customer's tag."
                {...register('businessType')}
              />
              <Input label="Tax ID" {...register('taxId')} />
            </div>

            <Input label="Website" placeholder="example.ca" {...register('website')} />
          </div>
        </section>

        <section>
          <h2 className="eyebrow mb-3 flex items-center gap-1.5 border-b border-line pb-2 text-ink-400">
            <MapPin className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Address <span className="font-normal normal-case text-ink-300">— optional</span>
          </h2>

          <div className="space-y-3">
            <Input label="Street" {...register('address.line1')} />
            <Input label="Unit / suite" {...register('address.line2')} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="City" {...register('address.city')} />
              <SelectField
                control={control}
                name="address.region"
                label="Province"
                options={PROVINCES}
              />
            </div>

            <Input label="Postal code" placeholder="A1A 1A1" {...register('address.postal')} />

            <p className="text-[12px] leading-snug text-ink-400">
              The default shipping and billing address. Leave the street blank to record no address —
              a partly filled one is not saved.
            </p>
          </div>
        </section>
      </div>

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-500">
        Account status, credit limit and payment terms are not edited here — they are set from the
        customer&rsquo;s profile, where approving an account and deciding what credit to extend it
        stay one decision.
      </p>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="outline" icon={X} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={isPending}>
          Update customer
        </Button>
      </div>
    </form>
  );
}

export default CustomerForm;
