import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { AlertCircle, Building2, MapPin, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import AddressFields from '@/components/admin/AddressFields';
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY } from '@shared/countries';
import Input from '@/components/ui/Input';
import PhoneField from '@/components/ui/PhoneField';
import SelectField from '@/components/ui/SelectField';
import ConsentChannels, { EMPTY_CONSENT } from '@/components/ui/ConsentChannels';
import Button from '@/components/ui/Button';

/**
 * Splits a stored `contactName` back into the two fields the form asks for.
 *
 * The model stores one name — it is what the welcome mail, the approvals queue
 * and every admin screen read — so the halves are a form affordance on both
 * sides: composed on submit, split on load. Everything after the first space is
 * the last name, which keeps `van der Berg` and `Diaz Ramirez` intact rather
 * than dropping whatever did not fit in two slots.
 */
function splitName(full) {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

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
  const { firstName, lastName } = splitName(user.contactName);

  /**
   * Consent is held apart from the rest of the form because it is written by a
   * different endpoint.
   *
   * `PATCH /admin/users/:id/consent` stamps who recorded the answer and when —
   * `clientUpdateSchema` does not carry the field at all, and folding it into
   * the profile payload would either lose that provenance or restamp it every
   * time somebody corrected a postal code. So the section is on this form,
   * where an operator expects to find it, and saving sends two requests: the
   * profile, then the consent, and only when the ticks actually changed.
   */
  const [consent, setConsent] = useState(user.consent?.channels ?? EMPTY_CONSENT);
  const consentDirty = Object.keys(EMPTY_CONSENT).some(
    (key) => Boolean(consent[key]) !== Boolean(user.consent?.channels?.[key]),
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      firstName,
      lastName,
      businessName: user.businessName ?? '',
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
        country: existing.country ?? DEFAULT_COUNTRY,
      },
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          contactName: `${values.firstName} ${values.lastName}`.trim(),
          // Sent even when empty: an empty string is how the operator clears a
          // company name recorded against what turned out to be a private
          // customer, and the server reads it as a deletion.
          businessName: values.businessName,
          email: values.email,
          phone: values.phone,
          businessType: values.businessType,
          website: values.website,
          taxId: values.taxId,
          // A half-typed address is still not sent — the schema requires a
          // complete one, so an empty street line means "no address".
          address: values.address.line1 ? values.address : undefined,
          // Only when it changed: an unchanged tick must not restamp the
          // consent date, which is the record of when the customer answered.
          contactConsent: consentDirty ? consent : undefined,
        }),
      )}
      className="space-y-5"
    >
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="eyebrow mb-3 flex items-center gap-1.5 border-b border-line pb-2 text-ink-400">
            <UserRound className="size-3.5 text-brand" strokeWidth={2.25} aria-hidden="true" />
            Personal information
          </h2>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                autoComplete="given-name"
                error={errors.firstName?.message}
                {...register('firstName', {
                  required: 'Enter a first name.',
                })}
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>

            <Input
              label="Email"
              type="email"
              hint="This is the account's sign-in address."
              error={errors.email?.message}
              {...register('email', { required: 'Enter an email address.' })}
            />

            <Controller
              name="phone"
              control={control}
              rules={{ required: 'Enter a phone number.' }}
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
          </div>

          {/* The company name is optional and lives under its own heading: an
              account is identified by the person (§0), and a private customer
              has no company to name. */}
          <h2 className="eyebrow mb-3 mt-5 flex items-center gap-1.5 border-b border-line pb-2 text-ink-400">
            <Building2 className="size-3.5 text-brand" strokeWidth={2.25} aria-hidden="true" />
            Business details <span className="font-normal normal-case text-ink-300">— optional</span>
          </h2>

          <div className="space-y-3">
            <Input
              label="Business name"
              placeholder="Northline Device Repair"
              error={errors.businessName?.message}
              {...register('businessName')}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Business type"
                placeholder="Repair shop"
                {...register('businessType')}
              />
              <Input label="Tax ID" {...register('taxId')} />
            </div>

            <Input label="Website" placeholder="example.ca" {...register('website')} />
          </div>
        </section>

        <section>
          <h2 className="eyebrow mb-3 flex items-center gap-1.5 border-b border-line pb-2 text-ink-400">
            <MapPin className="size-3.5 text-brand" strokeWidth={2.25} aria-hidden="true" />
            Address <span className="font-normal normal-case text-ink-300">— optional</span>
          </h2>

          <div className="space-y-3">
            <AddressFields control={control} register={register} setValue={setValue}>
              <div className="mb-3 space-y-3">
                <Input label="Street" {...register('address.line1')} />
                <Input label="Unit / suite" {...register('address.line2')} />
              </div>
            </AddressFields>

            <p className="text-xs leading-snug text-ink-400">
              The default shipping and billing address. Leave the street blank to record no address —
              a partly filled one is not saved.
            </p>
          </div>

          {/* CASL (§6.13). Present on the edit form as well as the profile
              panel: an operator correcting a customer's details is exactly who
              has just been told on the phone which channels are welcome, and
              sending them to a different screen to record it is how the answer
              gets lost. Both write through the same endpoint. */}
          <h2 className="eyebrow mb-3 mt-5 flex items-center gap-1.5 border-b border-line pb-2 text-ink-400">
            <ShieldCheck className="size-3.5 text-brand" strokeWidth={2.25} aria-hidden="true" />
            Communication consent
          </h2>

          <ConsentChannels value={consent} onChange={setConsent} />
          <p className="mt-3 text-xs leading-snug text-ink-400">
            {user.consent?.recorded
              ? 'Only change these when the customer has told you something different — the record is dated.'
              : 'Nothing recorded yet — nobody has asked this customer. Leave them clear until somebody has.'}
          </p>
        </section>
      </div>

      <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm text-ink-500">
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
