import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Copy,
  Lock,
  Plus,
  ShoppingCart,
  Tag,
  Timer,
  Users,
  Zap,
} from 'lucide-react';
import cn from '@/lib/cn';
import api from '@/lib/api';
import { money, date, relativeDays } from '@/lib/format';
import { GRADES } from '@/lib/constants';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import { PartVisual } from '@/components/product/PartFrame';
import { useOffers } from '@/hooks/useContent';
import { useAuth } from '@/hooks/useAuth';
import useUiStore from '@/store/uiStore';
import { useFilterStore } from '@/store/filterStore';
import { pressable } from '@/lib/motion';

/**
 * Offers and combo deals.
 *
 * Two shapes, drawn as two different objects rather than as one card component
 * with different text in it:
 *
 *   - a **deal** is a coupon — a stub with a perforation and a code on it;
 *   - a **combo** is an equation — the parts, a plus between them, and one
 *     price on the other side of the equals.
 *
 * Both say the same thing a wholesale buyer wants first: what do I get, what
 * does it cost, and what do I have to do to get it. The rules behind them live
 * in `pricingService` — offers never stack, a code never reaches inside a
 * bundle, and eligibility is enforced server-side, not by hiding a button.
 */

/** "20% off" / "$40 off" / "Free shipping" — the offer in three words or fewer. */
function headline(offer) {
  if (offer.discountType === 'free-shipping') return 'Free shipping';
  if (offer.discountType === 'amount') return `${money(offer.discountAmount)} off`;
  return `${offer.discountPercent}% off`;
}

/** Plain English for which parts a deal covers. */
function targetLabel(target) {
  const parts = [];
  if (target.grade) parts.push(GRADES[target.grade]?.label ?? target.grade);
  if (target.partType) parts.push(target.partType.replace(/-/g, ' '));
  if (target.brandSlug) parts.push(target.brandSlug);
  if (target.deviceTypeSlug) parts.push(`${target.deviceTypeSlug.replace(/-/g, ' ')} parts`);

  // Slugs need title-casing; the catch-all sentence does not, and running
  // `capitalize` over it produced "Anything In The Catalogue".
  return {
    text: parts.length ? parts.join(' · ') : 'Anything in the catalogue',
    fromSlugs: parts.length > 0,
  };
}

function conditions(offer) {
  const out = [];
  if (offer.minQty > 0) out.push(`${offer.minQty}+ qualifying units`);
  if (offer.minSpend > 0) out.push(`orders over ${money(offer.minSpend)}`);
  if (offer.redemption === 'single') out.push('one use per account');
  return out;
}

/**
 * The notch that makes a rectangle read as a torn ticket.
 *
 * Two half-circles in the PAGE's background colour, straddling the perforation.
 * It is the whole reason these cards do not look like every other card on the
 * site — so the colour has to track the page, not the card.
 */
function Perforation({ responsive = false }) {
  // Placed on the stub itself, straddling the border that IS the perforation:
  // one notch at each end of that border. On the featured ticket the border
  // moves from the top edge to the left edge at md, so the notches move with it.
  // The card clips at its own edge, so only the inner half of each circle is
  // ever visible — a semicircular bite with a hairline edge, which is what makes
  // it read as punched rather than as a dot sitting on top.
  const base =
    'pointer-events-none absolute size-4 rounded-full border border-line bg-surface-2';

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          base,
          responsive ? '-left-2 -top-2 md:-top-2' : '-left-2 -top-2',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          base,
          responsive ? '-right-2 -top-2 md:left-auto md:-left-2 md:-bottom-2 md:top-auto' : '-bottom-2 -left-2',
        )}
      />
    </>
  );
}

/**
 * The promo code, copyable.
 *
 * Falls back silently where the clipboard API is unavailable (an insecure
 * origin, or a browser that refuses permission) — the code is on screen and
 * typeable either way, which is the actual requirement.
 */
function CodeStub({ code, className }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — nothing to recover from.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy promo code ${code}`}
      className={cn(
        pressable,
        'group inline-flex items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface px-3 py-2 hover:border-brand',
        className,
      )}
    >
      <span className="font-mono text-sm font-semibold tracking-wide text-ink-900">{code}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-ok" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Copy
          className="size-3.5 shrink-0 text-ink-300 transition-colors group-hover:text-brand"
          strokeWidth={2.25}
          aria-hidden="true"
        />
      )}
      <span className="sr-only" role="status">
        {copied ? 'Code copied' : ''}
      </span>
    </button>
  );
}

function EndsIn({ endsAt, className }) {
  if (!endsAt) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-400', className)}>
      <Timer className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      Ends {relativeDays(endsAt)} · {date(endsAt)}
    </span>
  );
}

/** Automatic or code-required — two different promises, said out loud. */
function HowItApplies({ offer, className }) {
  if (offer.requiresCode) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-500', className)}>
        <Tag className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
        Enter the code in your cart
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ok', className)}>
      <Zap className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      Applied automatically at checkout
    </span>
  );
}

// ---- deal: a coupon ---------------------------------------------------------

function DealCoupon({ offer, onShop }) {
  const rules = conditions(offer);
  const applies = targetLabel(offer.target);

  return (
    <article className="relative flex overflow-hidden rounded-lg border border-line bg-surface transition-[border-color] duration-snap ease-entrance hover:border-ink-200">
      {/* ---- body -------------------------------------------------------- */}
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {offer.badge && (
            <span className="eyebrow rounded-full border border-line bg-surface-2 px-2 py-1 text-ink-500">
              {offer.badge}
            </span>
          )}
          {offer.restricted && (
            <span className="eyebrow inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-1 text-ink-500">
              <Users className="size-3" strokeWidth={2.5} aria-hidden="true" />
              Your account
            </span>
          )}
        </div>

        <p className="font-display text-3xl font-extrabold leading-none tracking-tight text-ink-900">
          {headline(offer)}
        </p>
        <h3 className="mt-2 text-lg leading-snug">{offer.title}</h3>
        {offer.subtitle && <p className="mt-1 text-sm text-ink-400">{offer.subtitle}</p>}

        <dl className="mt-3.5 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-400">On</dt>
            <dd className={cn('min-w-0 flex-1 text-ink-700', applies.fromSlugs && 'capitalize')}>
              {applies.text}
            </dd>
          </div>
          {rules.length > 0 && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-400">If</dt>
              <dd className="min-w-0 flex-1 text-ink-700">{rules.join(' · ')}</dd>
            </div>
          )}
        </dl>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
          <HowItApplies offer={offer} />
          <button
            type="button"
            onClick={() => onShop(offer)}
            className={cn(pressable, 'inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700')}
          >
            Shop these parts
            <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ---- the stub ---------------------------------------------------- */}
      {/* The stub is the same white as the body on purpose: the tear line and
          the two notches do the separating, and a tinted stub would swallow the
          notches, which are the page's own colour. */}
      <div className="relative flex w-[124px] shrink-0 flex-col items-center justify-center gap-2 border-l border-dashed border-line-strong bg-surface p-3 text-center sm:w-[144px]">
        <Perforation />

        {offer.code ? (
          <>
            <span className="eyebrow text-ink-400">Code</span>
            <CodeStub code={offer.code} />
          </>
        ) : (
          <>
            <span className="flex size-9 items-center justify-center rounded-full bg-ok-50 text-ok">
              <Zap className="size-4.5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="text-xs font-medium leading-tight text-ink-500">
              No code
              <br />
              needed
            </span>
          </>
        )}

        <EndsIn endsAt={offer.endsAt} className="mt-1 flex-col gap-0 text-2xs leading-tight" />
      </div>
    </article>
  );
}

// ---- combo: an equation -----------------------------------------------------

function ComboPart({ line, gated }) {
  return (
    // A div, not an li: this sits inside the equation's own <li>, alongside the
    // plus sign, and a nested listitem with no list around it is a real a11y
    // failure rather than a lint opinion.
    <div className="flex w-[92px] shrink-0 flex-col items-center text-center">
      <Link
        to={`/product/${line.slug}`}
        className={cn(pressable, 'flex size-[68px] items-center justify-center rounded-lg border border-line bg-surface p-2 hover:border-brand')}
      >
        <PartVisual product={line} />
      </Link>
      <span className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-ink-700">
        {line.partTypeLabel}
      </span>
      <span className="tnum mt-0.5 text-2xs text-ink-400">
        ×{line.qty}
        {!gated && ` · ${money(line.price)}`}
      </span>
      {!line.inStock && <span className="mt-0.5 text-2xs text-warn">Out of stock</span>}
    </div>
  );
}

function ComboCard({ offer, onAdd, addState }) {
  const gated = !offer.priceVisible;
  const openAccount = useUiStore((s) => s.openAccount);
  const { isAuthenticated, isApproved } = useAuth();

  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="eyebrow rounded-full border border-line bg-surface-2 px-2 py-1 text-ink-500">
              {offer.badge || 'Combo'}
            </span>
            {offer.restricted && (
              <span className="eyebrow inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-1 text-ink-500">
                <Users className="size-3" strokeWidth={2.5} aria-hidden="true" />
                Your account
              </span>
            )}
          </div>
          <h3 className="text-lg leading-snug">{offer.title}</h3>
          {offer.subtitle && <p className="mt-1 text-sm text-ink-400">{offer.subtitle}</p>}
        </div>

        {/* Deliberately NOT the gradient: the gradient on this card belongs to
            the "Add bundle" CTA in the footer, and a second gradient block up
            here made the badge read as a button you could press. A tinted
            outline pill states the same number and stays a label. */}
        {!gated && offer.savingsPercent > 0 && (
          <span className="inline-flex shrink-0 items-baseline gap-1 rounded-full border border-brand-100 bg-brand-50 py-1.5 pl-2.5 pr-3 text-brand-700">
            <span className="tnum font-display text-lg font-extrabold leading-none tracking-tight">
              −{offer.savingsPercent}%
            </span>
            {/* Full-strength brand-700, not a faded one: at 11px an opacity of
                0.7 over `brand-50` drops under 4.5:1 and fails the audit. The
                11px uppercase against the 15px figure is difference enough. */}
            <span className="eyebrow leading-none">off</span>
          </span>
        )}
      </header>

      {/* ---- the equation -------------------------------------------------
          Parts, plus, parts, equals one price — a stacked list would say the
          same thing and none of it at a glance.

          The row is centred rather than left-aligned: a two-part combo beside a
          three-part one used to line up against the left edge with a ragged
          gap on the right, and the equation is a composition, not a column.

          On a phone it stops being one row. Three 92px parts plus the operators
          cannot fit 320px, and the price is the one thing in the card that must
          never be the part scrolled off the edge — so below `sm` the parts wrap
          and the price sits under them behind a rule, with the `=` dropped
          because a stacked equals sign reads as a mistake. From `sm` the single
          row returns; if a long combo still outruns it there, the row scrolls
          and `w-max` with auto margins keeps the first part reachable at the
          left edge (a `justify-center` on the scroller would strand it). */}
      <div className="scroll-slim border-y border-line bg-surface-2 px-4 py-4 sm:overflow-x-auto sm:px-5">
        <div className="flex flex-col items-center gap-3 sm:mx-auto sm:w-max sm:flex-row sm:items-start sm:gap-2">
          <ul className="flex flex-wrap items-start justify-center gap-2 sm:flex-nowrap">
            {(offer.products ?? []).map((line, index) => (
              <li key={line.id} className="flex items-start gap-2">
                {index > 0 && (
                  <span className="mt-7 shrink-0 text-ink-300" aria-hidden="true">
                    <Plus className="size-4" strokeWidth={2} />
                  </span>
                )}
                <ComboPart line={line} gated={gated} />
              </li>
            ))}
          </ul>

          <span
            className="mt-7 hidden shrink-0 font-display text-xl font-bold text-ink-300 sm:block"
            aria-hidden="true"
          >
            =
          </span>

          <div className="w-full shrink-0 border-t border-line pt-3 text-center sm:mt-4 sm:w-auto sm:border-0 sm:pl-1 sm:pt-0">
            {gated ? (
              <button
                type="button"
                onClick={() => openAccount('signin')}
                className={cn(pressable, 'inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-left hover:border-brand')}
              >
                <Lock className="size-4 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
                <span className="text-sm font-semibold leading-tight text-ink-700">
                  {isAuthenticated ? 'Pending approval' : 'Sign in for'}
                  <br />
                  bundle pricing
                </span>
              </button>
            ) : (
              <>
                <span className="tnum block font-display text-3xl font-extrabold leading-none tracking-tight text-ink-900">
                  {money(offer.bundlePrice)}
                </span>
                <span className="tnum mt-1 block text-xs text-ink-300 line-through">
                  {money(offer.regularTotal)}
                </span>
                <span className="tnum mt-0.5 block text-xs font-semibold text-ok">
                  Save {money(offer.savings)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- action ------------------------------------------------------- */}
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <EndsIn endsAt={offer.endsAt} />
          {offer.terms && <p className="text-xs text-ink-300">{offer.terms}</p>}
        </div>

        {!gated && (
          <div className="shrink-0">
            {isApproved ? (
              <Button
                size="md"
                icon={addState === 'added' ? Check : ShoppingCart}
                variant={addState === 'added' ? 'solid' : 'primary'}
                loading={addState === 'adding'}
                disabled={!offer.available}
                onClick={() => onAdd(offer)}
              >
                {addState === 'added'
                  ? 'In your cart'
                  : offer.available
                    ? 'Add bundle'
                    : 'Unavailable'}
              </Button>
            ) : (
              <p className="text-sm text-ink-500">Ordering unlocks once approved.</p>
            )}
          </div>
        )}
      </footer>

      {!gated && !offer.available && (
        <p className="border-t border-line bg-warn-50 px-4 py-2.5 text-xs text-warn sm:px-5">
          A part in this bundle is out of stock. Your rep can substitute it.
        </p>
      )}
    </article>
  );
}

// ---- featured: one ticket, the page's single gradient block -----------------

function FeaturedTicket({ offer, onAdd, onShop, addState }) {
  const gated = offer.kind === 'combo' && !offer.priceVisible;
  const applies = targetLabel(offer.target);
  const { isApproved, isAuthenticated } = useAuth();
  const openAccount = useUiStore((s) => s.openAccount);

  return (
    <section
      aria-label="Featured offer"
      className="relative mb-10 overflow-hidden rounded-lg bg-brand-gradient md:flex"
    >
      {/* A diagonal hatch over the gradient — it stops the block reading as a
          flat coloured rectangle without adding a second colour. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(58deg, #fff 0 1px, transparent 1px 13px)',
        }}
      />

      <div className="relative min-w-0 flex-1 p-5 text-white sm:p-7 lg:p-9">
        <span className="eyebrow inline-flex h-6 items-center rounded-full bg-white/15 px-2.5">
          {offer.badge || 'Featured'}
        </span>

        <h2 className="mt-3 text-3xl leading-tight text-white sm:text-d-sm">{offer.title}</h2>
        {offer.subtitle && <p className="mt-2 text-lg text-white/80">{offer.subtitle}</p>}
        {offer.description && (
          <p className="mt-3 max-w-xl text-md leading-relaxed text-white/75">
            {offer.description}
          </p>
        )}

        {offer.kind === 'combo' && offer.products?.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/85">
            {offer.products.map((line) => (
              <li key={line.id} className="inline-flex items-center gap-1.5">
                <span className="tnum text-white/55">×{line.qty}</span>
                {line.name}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
          {offer.endsAt && (
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              Ends {relativeDays(offer.endsAt)}
            </span>
          )}
          {offer.terms && <span className="max-w-md">{offer.terms}</span>}
        </div>
      </div>

      {/* ---- the stub ----------------------------------------------------- */}
      <div className="relative flex w-full shrink-0 flex-col justify-center gap-3 border-t border-dashed border-white/30 bg-white/10 p-5 backdrop-blur-[2px] md:w-[290px] md:border-l md:border-t-0 lg:p-7">
        <Perforation responsive />

        {offer.kind === 'combo' ? (
          gated ? (
            <button
              type="button"
              onClick={() => openAccount('signin')}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left"
            >
              <span className="font-display text-md font-bold text-ink-900">
                {isAuthenticated ? 'Pending approval' : 'Sign in for bundle pricing'}
              </span>
              <Lock className="size-4 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <>
              <span>
                <span className="eyebrow block text-white/60">Bundle price</span>
                <span className="tnum mt-1 block font-display text-d-sm font-extrabold leading-none text-white">
                  {money(offer.bundlePrice)}
                </span>
                <span className="tnum mt-1.5 block text-sm text-white/60">
                  <span className="line-through">{money(offer.regularTotal)}</span> · save{' '}
                  {money(offer.savings)}
                </span>
              </span>

              {isApproved ? (
                <button
                  type="button"
                  disabled={!offer.available || addState === 'adding'}
                  onClick={() => onAdd(offer)}
                  className={cn(
                    pressable,
                    'inline-flex h-12 items-center justify-center gap-2 rounded-lg font-display text-md font-semibold',
                    addState === 'added'
                      ? 'bg-ok text-white'
                      : 'bg-surface text-ink-900 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {addState === 'added' ? (
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <ShoppingCart className="size-4" strokeWidth={2} aria-hidden="true" />
                  )}
                  {addState === 'added'
                    ? 'In your cart'
                    : offer.available
                      ? 'Add bundle to cart'
                      : 'Unavailable'}
                </button>
              ) : (
                <p className="text-sm text-white/75">Ordering unlocks once approved.</p>
              )}
            </>
          )
        ) : (
          <>
            <span>
              <span className="eyebrow block text-white/60">This offer</span>
              <span className="mt-1 block font-display text-d-sm font-extrabold leading-none text-white">
                {headline(offer)}
              </span>
              <span
                className={cn(
                  'mt-1.5 block text-sm text-white/60',
                  applies.fromSlugs && 'capitalize',
                )}
              >
                {applies.text}
              </span>
            </span>

            {offer.code ? (
              <CodeStub code={offer.code} className="justify-center border-white/40 bg-white/95" />
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white/15 px-3 py-2 text-sm font-medium text-white">
                <Zap className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                No code needed
              </span>
            )}

            <button
              type="button"
              onClick={() => onShop(offer)}
              className={cn(pressable, 'inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-surface font-display text-md font-semibold text-ink-900 hover:bg-surface-2')}
            >
              Shop these parts
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ---- page -------------------------------------------------------------------

export function OffersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isApproved } = useAuth();
  const [addedId, setAddedId] = useState(null);

  const { data, isLoading } = useOffers(isApproved);

  /**
   * Adds a combo as ONE cart line, not as loose products.
   *
   * `/cart/bundles` keeps the offer reference, so the bundle is priced as a unit
   * and stays sealed against promo codes. Posting its SKUs into `/cart/items`
   * would have added them at list price and quietly lost the discount.
   */
  const addBundle = useMutation({
    mutationFn: (offer) => api.post('/cart/bundles', { offer: offer.slug, qty: 1 }),
    onSuccess: (_result, offer) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setAddedId(offer.id);
      setTimeout(() => setAddedId((current) => (current === offer.id ? null : current)), 2400);
    },
  });

  /**
   * Sends a deal's target into the shared filter store, then lands on the shop.
   *
   * Writing the store as well as the query string matters: the shop hydrates
   * from the URL once per mount and merges into whatever the store still holds,
   * so a stale device type from an earlier visit would otherwise survive and
   * silently narrow the deal's results.
   */
  function shopTarget(offer) {
    const store = useFilterStore.getState();
    store.resetAll();

    const { deviceTypeSlug, brandSlug, partType, grade } = offer.target;
    if (deviceTypeSlug || brandSlug) {
      store.setPath({ deviceType: deviceTypeSlug || null, brand: brandSlug || null });
    }
    if (partType) store.setFacet('partType', [partType]);
    if (grade) store.setFacet('grade', [grade]);

    const params = new URLSearchParams();
    if (deviceTypeSlug) params.set('deviceType', deviceTypeSlug);
    if (brandSlug) params.set('brand', brandSlug);
    if (partType) params.set('partType', partType);
    if (grade) params.set('grade', grade);

    navigate(params.toString() ? `/?${params}` : '/');
  }

  const addState = (offer) =>
    addedId === offer.id
      ? 'added'
      : addBundle.isPending && addBundle.variables?.id === offer.id
        ? 'adding'
        : 'idle';

  const featured = data?.featured ?? null;
  const combos = (data?.combos ?? []).filter((offer) => offer.id !== featured?.id);
  const deals = (data?.deals ?? []).filter((offer) => offer.id !== featured?.id);
  const nothingRunning = !isLoading && (data?.total ?? 0) === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 sm:px-4 lg:px-6 lg:py-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-xl">
          <p className="eyebrow mb-2 text-brand">Running now</p>
          <h1 className="text-3xl sm:text-d-sm">Offers &amp; combo deals</h1>
          <p className="mt-3 text-md leading-relaxed text-ink-500">
            Bundle pricing on the parts that come through the door together, and discounts across
            the catalogue. Prices are visible to approved businesses.
          </p>
        </div>

        {/* The rules, said once, where they cannot be missed — rather than in
            small print under nine cards. */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-400">
          <li className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-ok" strokeWidth={3} aria-hidden="true" />
            One offer per order
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-ok" strokeWidth={3} aria-hidden="true" />
            Codes do not stack
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-ok" strokeWidth={3} aria-hidden="true" />
            Bundles are already discounted
          </li>
        </ul>
      </header>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 lg:col-span-2" rounded="lg" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-56" rounded="lg" />
          ))}
        </div>
      ) : nothingRunning ? (
        <div className="flex flex-col items-center rounded-lg border border-line bg-surface py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-300">
            <Tag className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2 className="text-lg">No offers running right now</h2>
          <p className="mx-auto mt-2 max-w-sm text-md text-ink-500">
            Promotions are posted here as they start. Your account rep can quote volume pricing on
            any model family in the meantime.
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-flex h-11 items-center rounded-md bg-brand-gradient px-5 font-display text-md font-semibold text-white transition-[filter] hover:brightness-110"
          >
            Talk to the sales desk
          </Link>
        </div>
      ) : (
        <>
          {featured && (
            <FeaturedTicket
              offer={featured}
              onAdd={addBundle.mutate}
              onShop={shopTarget}
              addState={addState(featured)}
            />
          )}

          {combos.length > 0 && (
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl">Combo deals</h2>
                <p className="text-sm text-ink-400">
                  Priced as a unit. One line on the invoice, one shipping charge.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {combos.map((offer) => (
                  <ComboCard
                    key={offer.id}
                    offer={offer}
                    onAdd={addBundle.mutate}
                    addState={addState(offer)}
                  />
                ))}
              </div>

              {addBundle.isError && (
                <p className="mt-3 text-sm text-danger">{addBundle.error.message}</p>
              )}
            </section>
          )}

          {deals.length > 0 && (
            <section>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl">Catalogue discounts</h2>
                <p className="text-sm text-ink-400">
                  Applied to your order total at checkout.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {deals.map((offer) => (
                  <DealCoupon key={offer.id} offer={offer} onShop={shopTarget} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default OffersPage;
