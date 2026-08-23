import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Mail,
  MapPin,
  MessageCircleQuestion,
  Package,
  Phone,
  Send,
  Truck,
} from 'lucide-react';
import cn from '@/lib/cn';
import api from '@/lib/api';
import { BUSINESS_INFO } from '@/lib/constants';
import { contactSchema, CONTACT_TOPICS } from '@shared/schemas/contact';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Slab, { EyebrowPill, SectionHeader } from '@/components/ui/Slab';
import Reveal from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';

const CHANNELS = [
  {
    icon: Phone,
    label: 'Trade desk',
    value: BUSINESS_INFO.phone,
    hint: 'Stock, sourcing and credit',
    href: `tel:${BUSINESS_INFO.phone.replace(/[^\d+]/g, '')}`,
  },
  {
    icon: Mail,
    label: 'Sales',
    value: BUSINESS_INFO.email,
    hint: 'Accounts, pricing and quotes',
    href: `mailto:${BUSINESS_INFO.email}`,
  },
  {
    icon: Mail,
    label: 'Support',
    value: BUSINESS_INFO.supportEmail,
    hint: 'Orders, returns and warranty',
    href: `mailto:${BUSINESS_INFO.supportEmail}`,
  },
];

const PROMISES = [
  {
    value: '1',
    unit: 'business day',
    label: 'Every message answered',
    hint: 'Usually the same afternoon, by the person who handles your account',
  },
  {
    value: '2',
    unit: 'PM ET',
    label: 'Same-day dispatch cutoff',
    hint: 'A stock question before it still leaves you time to order today',
  },
  {
    value: '2',
    unit: 'hours',
    label: 'Warehouse pickup ready',
    hint: 'Approved accounts, during business hours',
  },
];

/**
 * A drawn map card rather than an embedded tile service.
 *
 * An iframe map would need a third-party key, would leak a request to that
 * provider on every page view, and cannot be styled to the palette. The
 * micro-interaction the brief asks for is the pin, which lifts on hover.
 */
function MapCard({ className }) {
  return (
    <div className={cn('group overflow-hidden rounded-xl border border-line bg-surface', className)}>
      <svg
        viewBox="0 0 400 260"
        className="h-auto w-full"
        role="img"
        aria-label={`Map showing the ${BUSINESS_INFO.address.city} warehouse`}
      >
        {/* street grid */}
        <g stroke="var(--color-line-strong)" strokeWidth="1.6" fill="none">
          <path d="M0 70h400M0 130h400M0 196h400" />
          <path d="M74 0v260M168 0v260M262 0v260M336 0v260" />
        </g>
        <g stroke="var(--color-surface-3)" strokeWidth="8" fill="none">
          <path d="M0 130h400" />
          <path d="M168 0v260" />
        </g>

        {/* blocks */}
        <g fill="var(--color-surface-3)" stroke="var(--color-line-strong)" strokeWidth="1">
          <rect x="12" y="14" width="54" height="46" rx="2" />
          <rect x="84" y="14" width="74" height="46" rx="2" />
          <rect x="272" y="80" width="56" height="42" rx="2" />
          <rect x="12" y="140" width="54" height="46" rx="2" />
          <rect x="272" y="140" width="56" height="46" rx="2" />
          <rect x="346" y="206" width="44" height="42" rx="2" />
        </g>

        {/* the warehouse block, highlighted */}
        <rect
          x="180"
          y="80"
          width="72"
          height="42"
          rx="3"
          fill="var(--color-brand-50)"
          stroke="var(--color-brand)"
          strokeWidth="1.4"
        />

        {/* pin — the micro-interaction */}
        <g className="transition-transform duration-300 ease-[var(--ease-entrance)] group-hover:-translate-y-1.5">
          <path
            d="M216 74c-8.8 0-16 7-16 15.6 0 11.7 16 25.4 16 25.4s16-13.7 16-25.4C232 81 224.8 74 216 74z"
            fill="var(--color-brand)"
          />
          <circle cx="216" cy="89.5" r="5.4" fill="var(--color-surface)" />
        </g>
        <ellipse
          cx="216"
          cy="118"
          rx="9"
          ry="2.5"
          fill="var(--color-ink-900)"
          opacity="0.14"
          className="transition-all duration-300 group-hover:opacity-20"
        />
      </svg>
    </div>
  );
}

/**
 * Reads a question that was started somewhere else.
 *
 * The product page links here carrying the SKU it was on, so a buyer asking
 * about a part does not have to go back and find the part number. Only the two
 * parameters below are honoured, and the message is composed here rather than
 * taken from the URL — a link that can type into a form somebody else submits
 * is not a link worth accepting.
 */
function usePrefill() {
  const [params] = useSearchParams();
  const sku = (params.get('sku') ?? '').trim().slice(0, 40);
  const requested = params.get('topic') ?? '';
  const topic = CONTACT_TOPICS.some((option) => option.value === requested) ? requested : 'other';

  return {
    topic,
    message: sku ? `I have a question about ${sku}:\n\n` : '',
  };
}

/**
 * Contact Us (brief §9): functional-first, checkout-style fields, minimal
 * friction — laid out as the same slab stack the About page uses, so the two
 * editorial pages read as one site rather than as two templates.
 */
export function ContactPage() {
  const { user } = useAuth();
  const prefill = usePrefill();
  const [sent, setSent] = useState(null);
  const reduce = useReducedMotion();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(contactSchema),
    // Autofill from the account when there is one — same courtesy as checkout.
    values: {
      name: user?.contactName ?? '',
      business: user?.businessName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      topic: prefill.topic,
      orderNumber: '',
      message: prefill.message,
    },
  });

  const topic = watch('topic');

  const submit = useMutation({
    mutationFn: (payload) => api.post('/contact', payload),
    onSuccess: (response) => {
      setSent(response.message);
      reset({ ...watch(), message: '', orderNumber: '' });
    },
  });

  const headerMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 20, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
      };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
      {/* ---- opening + the three ways to reach a person -------------------- */}
      <Slab aria-labelledby="contact-heading">
        <motion.div
          {...headerMotion}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <EyebrowPill>Contact</EyebrowPill>

          <h1
            id="contact-heading"
            className="mt-6 text-[34px] leading-[1.04] tracking-[-0.035em] sm:text-[48px] lg:text-[56px]"
          >
            Talk to the trade desk
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-400">
            Account questions, stock checks, warranty claims or a problem with an order — answered
            by a person who can see your account, within one business day.
          </p>
        </motion.div>

        <ul className="mt-10 grid gap-2 sm:grid-cols-3 lg:mt-14">
          {CHANNELS.map(({ icon: Icon, label, value, hint, href }, index) => (
            <Reveal key={label} delay={index * 0.08} as="li">
              {/* The same two-element pill the FAQ rows use: a 2px edge that
                  becomes the brand gradient on hover, around a face that does
                  not move. */}
              <a
                href={href}
                className="group block h-full rounded-[24px] bg-line p-[2px] transition-[background-color,background-image] duration-200 hover:bg-brand-gradient"
              >
                <span className="flex h-full flex-col rounded-[22px] bg-surface p-5 transition-shadow duration-200 group-hover:shadow-card">
                  <span
                    className="mb-4 flex size-11 items-center justify-center rounded-[12px] bg-surface-2 text-ink-500 transition-colors group-hover:bg-brand group-hover:text-white"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>

                  <span className="eyebrow text-ink-400">{label}</span>
                  <span className="mt-2 block truncate font-display text-[16px] font-bold text-ink-900">
                    {value}
                  </span>
                  <span className="mt-1.5 text-[13px] leading-relaxed text-ink-400">{hint}</span>
                </span>
              </a>
            </Reveal>
          ))}
        </ul>
      </Slab>

      {/* ---- the form, with the hours beside it ---------------------------- */}
      <Slab aria-labelledby="message-heading">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0">
            <Reveal>
              <EyebrowPill>Send a message</EyebrowPill>
              <h2
                id="message-heading"
                className="mt-5 text-[26px] leading-[1.06] tracking-[-0.03em] sm:text-[34px]"
              >
                Tell us which part and which model
              </h2>
              <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-ink-400">
                The more of the device you name, the fewer round trips it takes. A SKU, a model or a
                photograph of the board is usually enough.
              </p>
            </Reveal>

            <Reveal delay={0.08}>
              <form
                onSubmit={handleSubmit((values) => submit.mutate(values))}
                className="mt-8 rounded-[24px] border border-line bg-surface-2 p-5 sm:p-7"
              >
                {sent && (
                  <p className="mb-5 flex items-start gap-2.5 rounded-[14px] bg-ok-50 px-4 py-3 text-[13.5px] text-ok">
                    <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    {sent}
                  </p>
                )}

                {submit.isError && (
                  <p className="mb-5 flex items-start gap-2.5 rounded-[14px] bg-danger-50 px-4 py-3 text-[13.5px] text-danger">
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {submit.error.message}
                  </p>
                )}

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Your name" error={errors.name?.message} {...register('name')} />
                    <Input label="Business" placeholder="Optional" {...register('business')} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Email"
                      type="email"
                      autoComplete="email"
                      error={errors.email?.message}
                      {...register('email')}
                    />
                    <Input label="Phone" type="tel" placeholder="Optional" {...register('phone')} />
                  </div>

                  <Select
                    label="What is this about?"
                    options={CONTACT_TOPICS}
                    {...register('topic')}
                  />

                  {/* Only asked for when it is actually relevant. */}
                  {topic === 'order' && (
                    <Input
                      label="Order number"
                      placeholder="CVX-2026-10042"
                      className="font-mono"
                      {...register('orderNumber')}
                    />
                  )}

                  <Textarea
                    // Stable id rather than the generated one: the screenshot
                    // runner waits on this field to know the form has painted.
                    id="contact-message"
                    label="Message"
                    rows={6}
                    placeholder="Which part, which model, and what you need…"
                    error={errors.message?.message}
                    {...register('message')}
                  />

                  <Button type="submit" size="lg" icon={Send} loading={submit.isPending} fullWidth>
                    Send message
                  </Button>
                </div>
              </form>
            </Reveal>
          </div>

          {/* ---- hours and pickup ------------------------------------------ */}
          <div className="space-y-3 lg:pt-2">
            <Reveal delay={0.12}>
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 sm:p-6">
                <p className="eyebrow mb-4 flex items-center gap-1.5 text-ink-400">
                  <Clock className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  Hours
                </p>
                <ul className="space-y-2.5">
                  {BUSINESS_INFO.hours.map((row) => (
                    <li
                      key={row.days}
                      className="flex justify-between gap-4 border-b border-line pb-2.5 text-[13.5px] last:border-0 last:pb-0"
                    >
                      <span className="text-ink-500">{row.days}</span>
                      <span className="font-medium text-ink-900">{row.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 sm:p-6">
                <span
                  className="mb-4 flex size-11 items-center justify-center rounded-[12px] bg-brand text-white"
                  aria-hidden="true"
                >
                  <Package className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-[16px]">Warehouse pickup</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
                  Available to approved accounts during business hours. Select “Warehouse pickup” at
                  checkout and we will have your order ready in two hours.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.28}>
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 sm:p-6">
                <span
                  className="mb-4 flex size-11 items-center justify-center rounded-[12px] bg-brand-50 text-brand"
                  aria-hidden="true"
                >
                  <Truck className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-[16px]">Ordering, not asking?</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
                  Stock, grades and lead times are on every product page — no need to write in for a
                  number the catalogue already shows.
                </p>
                <Link
                  to="/"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand transition-colors hover:text-brand-700"
                >
                  Browse the catalogue
                  <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </Slab>

      {/* ---- what happens after you send: the dark panel -------------------- */}
      <Slab tone="dark" aria-labelledby="promise-heading">
        <Reveal className="max-w-3xl">
          <p className="eyebrow mb-5 text-white/55">What happens next</p>
          <h2
            id="promise-heading"
            className="text-[26px] leading-[1.08] tracking-[-0.03em] text-white sm:text-[38px] lg:text-[44px]"
          >
            Your message reaches the desk, not a queue.
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/65">
            Every approved account has a named rep. Sourcing an unlisted part, raising a credit
            limit or chasing a warranty claim is one message to the same person each time.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
          {PROMISES.map(({ value, unit, label, hint }, index) => (
            <Reveal key={label} delay={index * 0.08}>
              <p className="tnum font-display text-[44px] font-bold leading-none tracking-[-0.03em] text-white lg:text-[54px]">
                {value}
                <span className="ml-1.5 text-[20px] font-semibold lg:text-[24px]">{unit}</span>
              </p>
              <p className="mt-4 font-display text-[14px] font-bold text-white">{label}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{hint}</p>
            </Reveal>
          ))}
        </div>
      </Slab>

      {/* ---- where we are -------------------------------------------------- */}
      <Slab aria-labelledby="warehouse-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal>
            <EyebrowPill>Find us</EyebrowPill>
            <h2
              id="warehouse-heading"
              className="mt-5 text-[26px] leading-[1.06] tracking-[-0.03em] sm:text-[36px] lg:text-[42px]"
            >
              One warehouse, in {BUSINESS_INFO.address.city}
            </h2>

            <address className="mt-6 not-italic">
              <p className="flex items-start gap-3 text-[15px] leading-relaxed text-ink-700">
                <MapPin className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2} aria-hidden="true" />
                <span>
                  {BUSINESS_INFO.address.line1}
                  <br />
                  {BUSINESS_INFO.address.city}, {BUSINESS_INFO.address.region}{' '}
                  {BUSINESS_INFO.address.postal}
                  <br />
                  {BUSINESS_INFO.address.country}
                </span>
              </p>
            </address>

            <p className="mt-6 max-w-lg text-[14px] leading-relaxed text-ink-400">
              Everything in the catalogue ships from this building — Canadian stock, no customs step
              between the order and the bench.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <MapCard />
          </Reveal>
        </div>
      </Slab>

      {/* ---- the quiet close ----------------------------------------------- */}
      <Slab aria-labelledby="faq-cta-heading" innerClassName="text-center" className="py-12 sm:py-14 lg:py-16">
        <SectionHeader
          id="faq-cta-heading"
          title="Already answered?"
          lede="Approval, credit terms, grading and warranty are covered in the help centre — most questions the desk gets are already there."
          centered
        />

        <Reveal className="mt-8 flex flex-wrap justify-center gap-2.5">
          <Link
            to="/faq"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-gradient px-6 font-display text-[14px] font-semibold text-white transition-[filter] hover:brightness-110"
          >
            <MessageCircleQuestion className="size-4" strokeWidth={2} aria-hidden="true" />
            Read the FAQ
          </Link>
          <Link
            to="/about"
            className="inline-flex h-12 items-center rounded-full border border-line-strong bg-surface px-6 font-display text-[14px] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
          >
            About Cellvix
          </Link>
        </Reveal>
      </Slab>
    </div>
  );
}

export default ContactPage;
