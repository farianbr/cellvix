import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, KeyRound, UserRound } from 'lucide-react';
import { date } from '@/lib/format';
import Panel from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { toast } from '@/store/toastStore';
import { useSupplierSession, useSupplierPortalMutations } from '@/hooks/useSupplierPortal';

/**
 * Who this supplier is to us, and the one thing they can change about it.
 *
 * **Read-only except the password.** A supplier's name, contact, terms and
 * component-type tags are what the purchasing team recorded and what the
 * supplier picker filters on — letting a supplier retag themselves would let
 * them into quoting rounds nobody asked them to. Changing any of it is a
 * conversation with the desk, and the page says so rather than offering a form
 * that would be refused.
 *
 * The password is theirs, because it is a credential rather than a record.
 */
export function SupplierProfilePage() {
  const { supplier } = useSupplierSession();
  const { changePassword } = useSupplierPortalMutations();
  const [error, setError] = useState(null);

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  function submit(values) {
    setError(null);

    if (values.newPassword !== values.confirmPassword) {
      setError('The two new passwords do not match.');
      return;
    }

    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          reset();
          toast.ok('Password changed', 'Use the new one next time you sign in.');
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <>
      <PageHeader
        icon={UserRound}
        title="Profile & access"
        description="What we hold about you, and your sign-in for this portal."
      />

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Panel
          title="Your details"
          description="Held by our purchasing team. Ask them to change anything here."
        >
          <dl className="space-y-2.5 text-sm">
            {[
              ['Business', supplier?.name],
              ['Code', supplier?.code],
              ['Contact', supplier?.contactName],
              ['Email', supplier?.email],
              ['Phone', supplier?.phone],
              ['Payment terms', supplier?.paymentTerms],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-ink-500">{label}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-ink-900">
                  {value || <span className="font-normal text-ink-300">—</span>}
                </dd>
              </div>
            ))}
          </dl>

          {/* What they are asked to price, in their own words rather than ours.
              A supplier who never gets asked about screens should be able to see
              that we have not tagged them for screens. */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="eyebrow mb-1.5 text-ink-400">What we ask you to price</p>
            {supplier?.componentTypes?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {supplier.componentTypes.map((type) => (
                  <Badge key={type} tone="neutral" size="sm">
                    {type}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">
                Nothing yet. Tell our purchasing team what you supply and they will tag you, so you
                start receiving the orders you can quote on.
              </p>
            )}
          </div>

          {supplier?.lastLoginAt && (
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-400">
              Last signed in {date(supplier.lastLoginAt)}.
            </p>
          )}
        </Panel>

        <Panel title="Change your password">
          {error && (
            <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit(submit)}>
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              {...register('currentPassword', { required: 'Enter your current password.' })}
              error={formState.errors.currentPassword?.message}
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              hint="At least 8 characters."
              containerClassName="mt-3"
              {...register('newPassword', {
                required: 'Choose a new password.',
                minLength: { value: 8, message: 'Use at least 8 characters.' },
              })}
              error={formState.errors.newPassword?.message}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              containerClassName="mt-3"
              {...register('confirmPassword', { required: 'Type the new password again.' })}
              error={formState.errors.confirmPassword?.message}
            />

            <Button
              type="submit"
              icon={KeyRound}
              className="mt-4"
              loading={changePassword.isPending}
            >
              Change password
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}

export default SupplierProfilePage;
