import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Clock,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import cn from '@/lib/cn';
import api from '@/lib/api';
import { BUSINESS_INFO } from '@/lib/constants';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import FormSection from '@/components/ui/FormSection';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import useUiStore from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, registerSchema, supplierApplicationSchema } from '@shared/schemas/auth';

const TABS = [
  { key: 'signin', label: 'Sign In' },
  { key: 'signup', label: 'Sign Up' },
  { key: 'contact', label: 'Contact' },
];

/** Value proposition panel beside the forms — the "side visual panel" of brief §8.1. */
function SidePanel() {
  return (
    <aside className="scroll-slim relative hidden h-full overflow-y-auto rounded-[12px] bg-brand-gradient p-6 text-white md:flex md:flex-col md:justify-between">
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

/**
 * Which side of the trade the visitor is on.
 *
 * Asked before anything else because the two paths have nothing in common: a
 * buyer gets an account, a password and an approval queue, while a supplier
 * gets an application the purchasing team reads and no login at all. Putting
 * both behind one form would mean a page of fields half of which do not apply,
 * and a "are you a supplier?" checkbox that silently changes what Create
 * account means.
 */
function AccountTypeChoice({ onPick }) {
  const OPTIONS = [
    {
      key: 'buyer',
      icon: ShoppingBag,
      title: 'I want to buy parts',
      body: 'Open a wholesale account. Trade pricing and ordering unlock once our team approves your business.',
      cta: 'Open a buying account',
    },
    {
      key: 'supplier',
      icon: Building2,
      title: 'I want to supply Cellvix',
      body: 'Tell us what you stock. Our purchasing team reviews every application and gets in touch to agree terms.',
      cta: 'Apply as a supplier',
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[13.5px] leading-relaxed text-ink-500">
        Which of these is you?
      </p>

      {OPTIONS.map(({ key, icon: Icon, title, body, cta }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          className="group flex w-full items-start gap-3.5 rounded-[12px] border border-line bg-surface p-4 text-left transition-colors hover:border-brand hover:bg-brand-50/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-ink-500 transition-colors group-hover:bg-brand-gradient group-hover:text-white">
            <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[14.5px] font-bold text-ink-900">{title}</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-500">{body}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand">
              {cta}
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * A business applying to sell to Cellvix.
 *
 * No password and no account: this posts an application the purchasing team
 * reviews on the suppliers screen. The four required fields deliberately match
 * the buyer form's, so a sign-up asks for the same things whichever side of the
 * trade you are on.
 */
function SupplierApplyForm({ onBack }) {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(supplierApplicationSchema),
    defaultValues: {
      businessName: '',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      supplies: '',
      address: { line1: '', line2: '', city: '', region: '', postal: '' },
    },
  });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await api.post('/auth/supplier-application', values);
      setSubmitted(true);
    } catch (error) {
      setFormError(error.message);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-ok-50 text-ok">
          <ShieldCheck className="size-7" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-[18px]">Application received</h3>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-500">
            Our purchasing team reviews every application and will be in touch to agree terms. No
            account has been created, so there is nothing to sign in to yet.
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back
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

      <FormSection title="Your business" icon={Building2} collapsible={false}>
        <div className="space-y-3">
          <Input
            label="Business name"
            required
            placeholder="Pacific Parts Supply"
            error={errors.businessName?.message}
            data-autofocus
            {...register('businessName')}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Contact name"
              required
              placeholder="Dana Whitfield"
              error={errors.contactName?.message}
              {...register('contactName')}
            />
            <Input
              label="Phone"
              type="tel"
              required
              placeholder="(416) 555-0142"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>

          <Input
            label="Work email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourbusiness.ca"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>
      </FormSection>

      <FormSection title="What you supply" hint="optional" icon={PackageSearch}>
        <div className="space-y-3">
          <Input label="Website" placeholder="pacificparts.ca" {...register('website')} />
          <Textarea
            label="What do you supply?"
            rows={3}
            placeholder="OEM and aftermarket screens for Samsung and Apple, batteries, charging flexes."
            {...register('supplies')}
          />
        </div>
      </FormSection>

      <FormSection title="Address" hint="optional" icon={MapPin}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Input label="Unit / suite" placeholder="101" {...register('address.line2')} />
            <Input label="Street" placeholder="123 Main Street" {...register('address.line1')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="City" placeholder="Toronto" {...register('address.city')} />
            <Input label="Province" placeholder="ON" maxLength={2} {...register('address.region')} />
            <Input label="Postal code" placeholder="A1A 1A1" {...register('address.postal')} />
          </div>
        </div>
      </FormSection>

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-500">
        This is an application, not an account. Nothing is created to sign in with, and our
        purchasing team gets in touch to agree terms.
      </p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Send application
        </Button>
      </div>
    </form>
  );
}

function SignUpTab({ onSwitch }) {
  const { signUp } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState(null);
  // Which side of the trade, chosen before any form is shown. Null means the
  // question has not been answered yet.
  const [accountType, setAccountType] = useState(null);

  /**
   * A referral link carries the referrer's code as `?ref=`, so somebody who
   * followed one does not have to be told a code over the phone and type it
   * correctly. It stays an ordinary editable field: attribution is set once at
   * registration and cannot be added later, so the person signing up has to be
   * able to see and correct what the link put there — which is also why its
   * section starts open when a code is present.
   *
   * Read once on mount rather than on every render, so a re-render cannot
   * reset a code the visitor has edited.
   */
  const [referredCode] = useState(
    () => new URLSearchParams(window.location.search).get('ref') ?? '',
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { referralCode: referredCode },
  });

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

  // The question comes before either form, because the two paths share nothing
  // beyond the four identity fields.
  if (!accountType) return <AccountTypeChoice onPick={setAccountType} />;
  if (accountType === 'supplier') {
    return <SupplierApplyForm onBack={() => setAccountType(null)} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {formError}
        </p>
      )}

      {/* Same shape as the admin's new-customer form: the required fields in
          their own slab, then optional groups below it. The two forms open the
          same kind of account and should not look like different products. */}
      <FormSection title="Your business" icon={Building2} collapsible={false}>
        <div className="space-y-3">
          <Input
            label="Business name"
            required
            placeholder="Northline Device Repair"
            error={errors.businessName?.message}
            data-autofocus
            {...register('businessName')}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Contact name"
              required
              placeholder="Dana Whitfield"
              error={errors.contactName?.message}
              {...register('contactName')}
            />
            <Input
              label="Phone"
              type="tel"
              required
              placeholder="(416) 555-0142"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>

          <Input
            label="Work email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourbusiness.ca"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={errors.password?.message}
            {...register('password')}
          />
        </div>
      </FormSection>

      {/* Everything below is optional and collapsed. It used to sit open, which
          made a five-field sign-up look like an eight-field one. */}
      <FormSection
        title="Business details"
        hint="optional"
        icon={Building2}
        // Somebody who followed a referral link arrives with a code already in
        // the form. Collapsed, they would never see it, could not correct it,
        // and would have no idea attribution was being recorded.
        defaultOpen={Boolean(referredCode)}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Business type"
              placeholder="Repair shop"
              error={errors.businessType?.message}
              {...register('businessType')}
            />
            <Input
              label="Tax / reseller ID"
              placeholder="RT0001-88213"
              hint="Speeds up approval."
              error={errors.taxId?.message}
              {...register('taxId')}
            />
          </div>

          {/* Referral code (§6.13). Set once: it cannot be added or changed
              after the account exists, because a referrer that can be edited
              later is a way to redirect money already earned. A code that is
              not recognised is refused rather than quietly dropped, so nobody
              is told they were referred when they were not. */}
          <Input
            label="Referral code"
            placeholder="ABCD2345"
            hint="If another Cellvix business referred you, enter their code. It cannot be added later."
            autoCapitalize="characters"
            error={errors.referralCode?.message}
            {...register('referralCode')}
          />
        </div>
      </FormSection>

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
    // Sized to its content rather than to a breakpoint: a form column wide
    // enough for a two-up field row without the inputs going stubby, beside a
    // fixed-width panel. It was 700/380, which fit sign-in but made the longer
    // sign-up form scroll almost immediately.
    <Modal
      open={open}
      onClose={close}
      size="lg"
      className="max-w-[860px]"
      align="top"
      showClose
      bodyClassName="p-0 md:p-0"
    >
      {/* One fixed height for all three tabs.
          The dialog used to size to whatever was inside it, so switching from
          Sign In to Sign Up grew it by a couple of hundred pixels and the side
          panel grew with it: the panel is the constant thing on this dialog,
          and it visibly changed size depending on which tab you were on. The
          shell is now a fixed frame, and the form column scrolls inside it when
          a tab needs more room than the frame has. `min-h-0` on the scrolling
          child is what actually lets it scroll rather than stretch the grid. */}
      {/* 80vh, not more: the panel starts at 8vh (align="top") and Modal caps
          it at 88vh, so a taller frame would be clipped by that cap rather than
          scrolling inside it. */}
      <div className="grid gap-6 md:h-[min(660px,80vh)] md:grid-cols-[minmax(0,1fr)_minmax(0,258px)] md:gap-8">
        <div className="scroll-slim mx-auto w-full min-w-0 max-w-[480px] overflow-y-auto px-5 pb-6 pt-5 md:mx-0 md:min-h-0 md:max-w-none md:pl-6 md:pr-0">
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

        {/* `min-h-0` so the panel fills the fixed frame rather than being sized
            by its own content, which is what kept it a constant size. */}
        <div className="hidden min-h-0 p-5 pl-0 md:block">
          <SidePanel />
        </div>
      </div>
    </Modal>
  );
}

export default AccountPopup;
