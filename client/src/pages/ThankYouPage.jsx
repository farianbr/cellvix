import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Check,
  FileText,
  HelpCircle,
  Newspaper,
  Package,
  Tag,
  Truck,
} from 'lucide-react';
import api from '@/lib/api';
import { money, date } from '@/lib/format';
import Skeleton from '@/components/ui/Skeleton';
import { PartVisual } from '@/components/product/PartFrame';
import BrandScene from '@/components/ui/BrandScene';
import { ease } from '@/lib/motion';

/**
 * Post-checkout confirmation (brief §9).
 *
 * The success animation is the one place in the app allowed to run past 600ms:
 * a ring drawing itself, then the check stroking in. It plays once, and collapses
 * to a static mark under `prefers-reduced-motion`.
 */
function SuccessMark() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <span className="flex size-20 items-center justify-center rounded-full bg-ok text-white">
        <Check className="size-10" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="relative flex size-20 items-center justify-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 size-full" aria-hidden="true">
        <motion.circle
          cx="40"
          cy="40"
          r="37"
          fill="none"
          stroke="var(--color-ok)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, rotate: -90 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: ease.entrance }}
          style={{ transformOrigin: '50% 50%', rotate: -90 }}
        />
        <motion.path
          d="M25 41.5 L35.5 52 L56 31"
          fill="none"
          stroke="var(--color-ok)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.5, ease: ease.entrance }}
        />
      </svg>
    </span>
  );
}

const ELSEWHERE = [
  {
    icon: Tag,
    to: '/offers',
    title: 'Offers & combo deals',
    body: 'Bundle pricing on the parts that come through the door together.',
  },
  {
    icon: HelpCircle,
    to: '/faq',
    title: 'Shipping & warranty FAQ',
    body: 'Cut-offs, tracking, claims and what each grade means.',
  },
  {
    icon: Newspaper,
    to: '/blog',
    title: 'Bench notes',
    body: 'Grading, diagnostics and catalogue changes from the warehouse.',
  },
];

const NEXT_STEPS = [
  {
    icon: Package,
    title: 'We pick and test',
    body: 'Every part is quality-checked at the Toronto warehouse before it is boxed.',
  },
  {
    icon: Truck,
    title: 'You get tracking',
    body: 'A carrier and tracking number land in your inbox as soon as the order ships.',
  },
  {
    icon: FileText,
    title: 'Invoice follows',
    body: 'Your invoice is in Account → Invoices, with the due date for your terms.',
  },
];

export function ThankYouPage() {
  const { orderNumber } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', orderNumber],
    queryFn: () => api.get(`/orders/${orderNumber}`),
    select: (payload) => payload.order,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Skeleton className="mx-auto mb-6 size-20" rounded="full" />
        <Skeleton className="mx-auto mb-3 h-8 w-72" />
        <Skeleton className="mx-auto h-4 w-96" />
        <Skeleton className="mt-10 h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl">We could not find that order</h1>
        <p className="mt-3 text-md text-ink-500">{error.message}</p>
        <Link
          to="/account/orders"
          className="mt-6 inline-flex items-center gap-1.5 text-md font-semibold text-brand hover:text-brand-700"
        >
          View your order history
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const eta = new Date(
    Date.now() + (data.deliveryMethod?.etaDays ?? 3) * 86_400_000,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:py-16">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: ease.entrance }}
        className="flex flex-col items-center text-center"
      >
        <SuccessMark />

        <h1 className="mt-6 text-3xl sm:text-d-sm">Order confirmed</h1>
        <p className="mt-3 max-w-md text-md leading-relaxed text-ink-500">
          Thanks — we have your order and the warehouse is on it. A confirmation is on its way to
          your inbox.
        </p>

        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2">
          <span className="eyebrow text-ink-400">Order</span>
          <span className="font-mono text-md font-medium text-ink-900">
            {data.orderNumber}
          </span>
        </p>

        {/* The drawn scene arrives after the check has finished stroking in, so
            the eye lands on the confirmation first and the illustration second
            rather than the two competing on the same frame. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.55, ease: ease.entrance }}
          className="mt-9 flex w-full justify-center"
        >
          <BrandScene variant="success" className="max-w-[380px]" />
        </motion.div>
      </motion.div>

      {/* ---- order summary ------------------------------------------------ */}
      <div className="mt-10 overflow-hidden rounded-lg border border-line bg-surface">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold">Summary</h2>
          <p className="text-sm text-ink-500">
            Estimated delivery <span className="font-medium text-ink-900">{date(eta)}</span>
          </p>
        </header>

        <ul className="divide-y divide-line">
          {data.items.map((item) => (
            <li key={item.sku} className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 p-1.5">
                <PartVisual product={item} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-md font-medium text-ink-900">
                  {item.name}
                </span>
                <span className="tnum block font-mono text-2xs text-ink-300">
                  {item.sku} · ×{item.qty}
                </span>
              </span>
              <span className="tnum shrink-0 font-display text-md font-bold">
                {money(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-line bg-surface-2 px-5 py-4 text-md">
          <div className="flex justify-between">
            <dt className="text-ink-500">Subtotal</dt>
            <dd className="tnum font-medium text-ink-900">{money(data.subtotal)}</dd>
          </div>

          {data.bundleDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-ok">Bundle pricing</dt>
              <dd className="tnum font-medium text-ok">−{money(data.bundleDiscount)}</dd>
            </div>
          )}
          {data.promoDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-ok">
                {data.promo?.code ? (
                  <span className="font-mono text-sm">{data.promo.code}</span>
                ) : (
                  'Offer applied'
                )}
              </dt>
              <dd className="tnum font-medium text-ok">−{money(data.promoDiscount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-500">{data.deliveryMethod?.label ?? 'Shipping'}</dt>
            <dd className="tnum font-medium text-ink-900">
              {data.shipping === 0 ? 'Free' : money(data.shipping)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">HST</dt>
            <dd className="tnum font-medium text-ink-900">{money(data.tax)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-2.5">
            <dt className="font-display text-md font-bold text-ink-900">Total</dt>
            <dd className="tnum font-display text-xl font-bold text-ink-900">
              {money(data.total)}
            </dd>
          </div>
        </dl>
      </div>

      {/* ---- what happens next -------------------------------------------- */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {NEXT_STEPS.map(({ icon: Icon, title, body }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + index * 0.08, ease: ease.entrance }}
            className="rounded-lg border border-line bg-surface p-4"
          >
            <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-surface-2 text-ink-500">
              <Icon className="size-4.5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3 className="text-md">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">{body}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-gradient px-6 font-display text-md font-semibold text-white transition-[filter] hover:brightness-110"
        >
          Keep shopping
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Link>
        <Link
          to={`/account/orders/${data.orderNumber}`}
          className="inline-flex h-12 items-center rounded-lg border border-line-strong bg-surface px-6 font-display text-md font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
        >
          Track this order
        </Link>
      </div>

      {/* ---- while the warehouse picks it ----------------------------------- */}
      <div className="mt-10 border-t border-line pt-8">
        <p className="eyebrow mb-4 text-center text-ink-400">While you are here</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {ELSEWHERE.map(({ icon: Icon, to, title, body }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition-[border-color] duration-snap ease-entrance hover:border-ink-200"
              >
                <span className="mb-2.5 flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="font-display text-md font-bold text-ink-900 group-hover:text-brand">
                  {title}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-ink-500">{body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ThankYouPage;
