import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, ShieldCheck } from 'lucide-react';
import { date } from '@/lib/format';
import { profileSchema, changePasswordSchema } from '@shared/schemas/account';
import Panel, { CollapsiblePanel } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useAccountMutations } from '@/hooks/useAccount';

function ProfileForm() {
  const { user } = useAuth();
  const { updateProfile } = useAccountMutations();
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      businessName: user?.businessName ?? '',
      contactName: user?.contactName ?? '',
      phone: user?.phone ?? '',
      website: user?.website ?? '',
      businessType: user?.businessType ?? '',
      taxId: user?.taxId ?? '',
      resellerCert: user?.resellerCert ?? '',
    },
  });

  function onSubmit(values) {
    updateProfile.mutate(values, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2600);
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Business name" error={errors.businessName?.message} {...register('businessName')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Primary contact" error={errors.contactName?.message} {...register('contactName')} />
        <Input label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Business type" placeholder="Repair shop" {...register('businessType')} />
        <Input label="Website" placeholder="yourbusiness.ca" {...register('website')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Tax / GST number" {...register('taxId')} />
        <Input label="Reseller certificate" {...register('resellerCert')} />
      </div>

      {/* Email is the login identifier, so it is not editable here. */}
      <Input
        label="Account email"
        value={user?.email ?? ''}
        disabled
        hint="Your sign-in address. Contact your rep to change it."
        readOnly
      />

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" loading={updateProfile.isPending} disabled={!isDirty}>
          Save changes
        </Button>

        {saved && (
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-ok">
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

function PasswordForm() {
  const { changePassword } = useAccountMutations();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(changePasswordSchema) });

  function onSubmit(values) {
    setServerError(null);
    changePassword.mutate(values, {
      onSuccess: () => {
        setDone(true);
        reset();
        setTimeout(() => setDone(false), 3000);
      },
      onError: (error) => setServerError(error.fields?.currentPassword ?? error.message),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {serverError}
        </p>
      )}

      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="outline" loading={changePassword.isPending}>
          Change password
        </Button>

        {done && (
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-ok">
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            Password updated
          </span>
        )}
      </div>
    </form>
  );
}

export function AccountCompanyPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <Panel
        title="Company details"
        action={
          <div className="flex items-center gap-2">
            <Badge tone="ok" icon={ShieldCheck}>
              Approved
            </Badge>
            {user?.approvedAt && (
              <span className="text-[12px] text-ink-400">{date(user.approvedAt)}</span>
            )}
          </div>
        }
      >
        <ProfileForm />
      </Panel>

      {/* Collapsed: a password form open by default is a form nobody came to
          fill in, sitting under the details they did come for.

          No `summary` — the account carries no `passwordChangedAt`, and the
          only line available would restate the title. The description says what
          opening it offers, which is what a summary would have had to do. */}
      <CollapsiblePanel title="Security" description="Change your password.">
        <PasswordForm />
      </CollapsiblePanel>
    </div>
  );
}

export default AccountCompanyPage;
