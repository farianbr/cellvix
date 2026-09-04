import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { businessInfoSchema } from '@shared/schemas/admin';
import { PROVINCES } from '@shared/schemas/checkout';
import Panel from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import PageHeader from '@/components/admin/PageHeader';
import { SettingsFormActions, PlaceholderNotice } from '@/components/admin/settings/SettingsForm';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminSettings, useAdminMutations } from '@/hooks/useAdmin';

/**
 * Business Info (§6.15, category 1) — who Cellvix is on an invoice, an email
 * and the storefront footer.
 *
 * This screen is the answer to open question 1 on the PROGRESS board: the
 * `BUSINESS_INFO` placeholder constants in `lib/constants.js` were always meant
 * to become editable data, and this is where they become it.
 *
 * The values ship seeded and **the seeds are placeholders**, which is why the
 * notice is not optional (§6b, rule 5). A GST/HST number is the field most
 * likely to be believed simply because it is filled in, and it is also the one
 * that ends up printed on every invoice.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/settings/business-info'], icon: adminIcon('Building2') };

const EMPTY = {
  name: '',
  tagline: '',
  phone: '',
  email: '',
  website: '',
  taxNumber: '',
  address: { line1: '', line2: '', city: '', region: 'ON', postal: '', country: 'CA' },
};

export function AdminBusinessInfoPage() {
  const { data, isLoading } = useAdminSettings();
  const { saveBusinessInfo } = useAdminMutations();
  const [saved, setSaved] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ resolver: zodResolver(businessInfoSchema), defaultValues: EMPTY });

  // The server is the source of truth, and a refetch must never overwrite an
  // edit in progress — so this syncs only while the form is untouched.
  useEffect(() => {
    if (!data?.business || isDirty) return;
    reset({ ...EMPTY, ...data.business, address: { ...EMPTY.address, ...data.business.address } });
  }, [data, isDirty, reset]);

  async function onSubmit(values) {
    setSaved(false);
    try {
      const next = await saveBusinessInfo.mutateAsync(values);
      // Reset *to the server's answer*, not to what was typed: it is what the
      // document now holds, and it is what makes the form clean again.
      reset({ ...EMPTY, ...next.business, address: { ...EMPTY.address, ...next.business.address } });
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

      <PlaceholderNotice>
        These details ship with placeholder values and are printed on invoices, transactional email
        and the storefront footer. Replace them with the real ones — the GST/HST number especially,
        which is a stand-in and is not a valid registration.
      </PlaceholderNotice>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-form space-y-4">
        <Panel title="Identity" description="The name and line that appear above every document.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Business name" error={errors.name?.message} {...register('name')} />
            <Input
              label="Tagline"
              hint="One line, under the name."
              error={errors.tagline?.message}
              {...register('tagline')}
            />
          </div>
        </Panel>

        <Panel title="Contact" description="How a customer reaches Cellvix from a document or the footer.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
            <Input
              label="Website"
              hint="Include https://"
              error={errors.website?.message}
              {...register('website')}
            />
            <Input
              label="GST/HST number"
              hint="Printed on every invoice. Required for input tax credits."
              error={errors.taxNumber?.message}
              {...register('taxNumber')}
            />
          </div>
        </Panel>

        <Panel title="Address" description="The registered address, as it appears on an invoice.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Street address"
              containerClassName="sm:col-span-2"
              error={errors.address?.line1?.message}
              {...register('address.line1')}
            />
            <Input
              label="Unit / suite"
              containerClassName="sm:col-span-2"
              error={errors.address?.line2?.message}
              {...register('address.line2')}
            />
            <Input label="City" error={errors.address?.city?.message} {...register('address.city')} />
            <SelectField
              control={control}
              name="address.region"
              label="Province"
              options={PROVINCES}
              error={errors.address?.region?.message}
            />
            <Input
              label="Postal code"
              placeholder="A1A 1A1"
              error={errors.address?.postal?.message}
              {...register('address.postal')}
            />
          </div>
        </Panel>

        <SettingsFormActions
          dirty={isDirty}
          saving={isSubmitting || saveBusinessInfo.isPending}
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

export default AdminBusinessInfoPage;
