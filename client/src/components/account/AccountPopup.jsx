import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import cn from '@/lib/cn';
import { BUSINESS_INFO } from '@/lib/constants';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import useUiStore from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, registerSchema } from '@shared/schemas/auth';

const TABS = [
  { key: 'signin', label: 'Sign In' },
  { key: 'signup', label: 'Sign Up' },
  { key: 'contact', label: 'Contact' },
];

/** Value proposition panel beside the forms — the "side visual panel" of brief §8.1. */
function SidePanel() {
  return (
    <aside className="relative hidden h-full overflow-hidden rounded-[12px] bg-brand-gradient p-6 text-white md:flex md:flex-col md:justify-between">
      <div>
        <p className="eyebrow mb-2 opacity-70">Cellvix trade portal</p>
        <h3 className="text-[22px] leading-tight text-white">
          Wholesale pricing for verified repair businesses
        </h3>
        <p className="mt-3 text-[13.5px] leading-relaxed text-white/75">
          Accounts are reviewed by our team before trade pricing unlocks. It usually takes one
          business day.
        </p>
      </div>

      <ul className="mt-8 space-y-3 text-[13px] text-white/85">
        {[
          '400+ SKUs across phones, tablets, laptops and consoles',
          'Graded pulls tested before dispatch',
          'Net 15 / 30 / 60 terms once approved',
          'Same-day dispatch from Ontario',
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SignInTab({ onDone }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);
  const [pendingNotice, setPendingNotice] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { remember: true } });

  async function onSubmit(values) {
    setFormError(null);
    setPendingNotice(false);
    try {
      const user = await signIn(values);
      // A pending account signs in successfully on purpose — we tell them where
      // they stand instead of failing the credentials (brief §8.2).
      if (user.status === 'pending') {
        setPendingNotice(true);
        return;
      }
      onDone?.();
      // Staff belong in the admin console, not the shop's buyer dashboard.
      if (user.role === 'admin') navigate('/admin');
    } catch (error) {
      setFormError(error.message);
    }
  }

  if (pendingNotice) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warn-50 text-warn">
          <Clock className="size-7" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-[18px]">Your account is still under review</h3>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-500">
            You are signed in, but trade pricing and ordering stay locked until our team verifies
            your business. We will email you the moment it is approved — usually within one business
            day.
          </p>
        </div>
        <Button variant="outline" onClick={onDone}>
          Continue browsing
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {formError}
        </p>
      )}

      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@yourbusiness.ca"
        error={errors.email?.message}
        data-autofocus
        {...register('email')}
      />

      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex items-center justify-between gap-3">
        <Checkbox label="Remember me" className="-ml-2" {...register('remember')} />
        <button
          type="button"
          className="text-[12.5px] font-medium text-brand transition-colors hover:text-brand-700"
        >
          Forgot password?
        </button>
      </div>

      <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

function SignUpTab({ onSwitch }) {
  const { signUp } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await signUp(values);
      setSubmitted(true);
    } catch (error) {
      setFormError(error.message);
    }
  }

  // Brief §8.1: sign-up does not grant access. Say so plainly.
  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-ok-50 text-ok">
          <ShieldCheck className="size-7" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-[18px]">Thanks for signing up</h3>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-500">
            Your account is pending admin approval. We will email you once your business is
            verified — usually within one business day.
          </p>
        </div>
        <Button variant="outline" onClick={() => onSwitch('signin')}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {formError}
        </p>
      )}

      <Input
        label="Business name"
        placeholder="Northline Device Repair"
        error={errors.businessName?.message}
        data-autofocus
        {...register('businessName')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Contact name"
          placeholder="Dana Whitfield"
          error={errors.contactName?.message}
          {...register('contactName')}
        />
        <Input
          label="Phone"
          type="tel"
          placeholder="(416) 555-0142"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      <Input
        label="Work email"
        type="email"
        autoComplete="email"
        placeholder="you@yourbusiness.ca"
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Business type"
          placeholder="Repair shop"
          error={errors.businessType?.message}
          {...register('businessType')}
        />
        <Input
          label="Tax / reseller ID"
          placeholder="RT0001-88213"
          hint="Optional — speeds up approval."
          error={errors.taxId?.message}
          {...register('taxId')}
        />
      </div>

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-500">
        Cellvix is a wholesale-only platform. New accounts are reviewed by our team before trade
        pricing and ordering unlock.
      </p>

      <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}

function ContactTab() {
  return (
    <div className="space-y-5">
      <p className="text-[13.5px] leading-relaxed text-ink-500">
        Our trade desk answers account, pricing and stock questions during business hours.
      </p>

      <ul className="space-y-3">
        {[
          { icon: Phone, label: 'Phone', value: BUSINESS_INFO.phone },
          { icon: Mail, label: 'Email', value: BUSINESS_INFO.email },
          {
            icon: MapPin,
            label: 'Warehouse',
            value: `${BUSINESS_INFO.address.line1}, ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.region} ${BUSINESS_INFO.address.postal}`,
          },
        ].map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-start gap-3 rounded-[10px] border border-line p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-500" aria-hidden="true">
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <span>
              <span className="eyebrow block text-ink-300">{label}</span>
              <span className="mt-0.5 block text-[13.5px] font-medium text-ink-900">{value}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="rounded-[10px] border border-line p-3">
        <span className="eyebrow mb-2 block text-ink-300">Hours</span>
        <ul className="space-y-1">
          {BUSINESS_INFO.hours.map((row) => (
            <li key={row.days} className="flex justify-between gap-4 text-[13px]">
              <span className="text-ink-500">{row.days}</span>
              <span className="font-medium text-ink-900">{row.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Sign In / Sign Up / Contact popup, triggered from the header account button. */
export function AccountPopup() {
  const open = useUiStore((s) => s.accountPopupOpen);
  const close = useUiStore((s) => s.closeAccount);
  const tab = useUiStore((s) => s.accountPopupTab);
  const setTab = useUiStore((s) => s.setAccountTab);

  return (
    // Was `xl` (1024px): the form column ran past 600px, so a single email field
    // stretched most of a laptop screen. The dialog is sized to its content now
    // — a 380px form column, which is the width a login form actually wants,
    // beside the 260px panel — rather than to a breakpoint.
    <Modal
      open={open}
      onClose={close}
      size="lg"
      className="max-w-[700px]"
      align="top"
      showClose
      bodyClassName="p-0 md:p-0"
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,380px)_minmax(0,260px)] md:gap-8">
        <div className="mx-auto w-full min-w-0 max-w-[380px] px-5 pb-6 pt-5 md:mx-0 md:pl-6 md:pr-0">
          <div
            role="tablist"
            aria-label="Account"
            className="mb-5 flex gap-1 rounded-[10px] bg-surface-2 p-1"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                role="tab"
                type="button"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  'flex-1 rounded-[8px] py-2 font-display text-[13px] font-semibold transition-[background,color,box-shadow] duration-[120ms]',
                  tab === item.key
                    ? 'bg-surface text-ink-900 shadow-card'
                    : 'text-ink-400 hover:text-ink-700',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'signin' && <SignInTab onDone={close} />}
          {tab === 'signup' && <SignUpTab onSwitch={setTab} />}
          {tab === 'contact' && <ContactTab />}
        </div>

        <div className="hidden p-5 pl-0 md:block">
          <SidePanel />
        </div>
      </div>
    </Modal>
  );
}

export default AccountPopup;
