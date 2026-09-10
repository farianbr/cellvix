import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, LogIn } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useSuperAdminMutations } from '@/hooks/useSuperAdmin';

/**
 * Signing in to the platform console.
 *
 * **Deliberately austere, and deliberately unbranded as Cellvix.** This is not
 * a tenant's login — it reaches every tenant — so it carries no business name,
 * no storefront chrome and no "forgot password" self-service path. An account
 * that can reconfigure the platform is issued and reset by another operator,
 * not recovered by email.
 *
 * One error message for a bad email and a bad password, as every other sign-in
 * here uses: telling them apart is an account-enumeration oracle, and it
 * matters more on this door than on any other.
 */
export function SuperAdminLoginPage() {
  const { signIn } = useSuperAdminMutations();
  const [error, setError] = useState(null);

  const { register, handleSubmit, formState } = useForm({
    defaultValues: { email: '', password: '' },
  });

  function submit(values) {
    setError(null);
    signIn.mutate(values, { onError: (err) => setError(err.message) });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-deep px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-gradient-compact font-display text-md font-bold text-white">
            P
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-none text-white">
              Platform
            </span>
            <span className="eyebrow mt-1 block text-ink-200">Operator console</span>
          </span>
        </div>

        <div className="rounded-lg bg-surface p-5">
          <h1 className="font-display text-lg font-bold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">
            This console reaches every tenant on the platform.
          </p>

          {error && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit(submit)} className="mt-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              required
              {...register('email', { required: 'Enter your email.' })}
              error={formState.errors.email?.message}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              containerClassName="mt-3"
              {...register('password', { required: 'Enter your password.' })}
              error={formState.errors.password?.message}
            />

            <Button type="submit" icon={LogIn} className="mt-4 w-full" loading={signIn.isPending}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-200">
          Accounts are issued by another operator. There is no self-service reset.
        </p>
      </div>
    </div>
  );
}

export default SuperAdminLoginPage;
