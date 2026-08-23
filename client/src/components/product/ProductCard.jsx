import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Loader2, Lock, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import cn from '@/lib/cn';
import { money } from '@/lib/format';
import GradeBadge from './GradeBadge';
import QtyStepper from './QtyStepper';
import PartIllustration from './PartIllustration';
import { useCart } from '@/hooks/useCart';
import useUiStore from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';

/**
 * The product card (brief §6).
 *
 * Add to Cart is deliberately isolated: it mutates only this card's local state
 * and the cart store. Nothing re-queries, nothing else on the page re-renders,
 * and the quantity badge moves on the same frame as the click.
 */
export function ProductCard({ product }) {
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const { addItem, isAdding, items } = useCart();
  const inCartQty = items.find((item) => item.productId === product.id)?.qty ?? 0;
  const openCartAfterAdd = useUiStore((s) => s.openCartAfterAdd);
  const openAccount = useUiStore((s) => s.openAccount);
  const { isAuthenticated } = useAuth();

  const outOfStock = !product.inStock;
  const gated = !product.priceVisible;

  function handleAdd() {
    if (outOfStock || isAdding) return;
    addItem(product, qty);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
    // Desktop only — see openCartAfterAdd.
    openCartAfterAdd();
  }

  return (
    // @container so the card adapts to its own width, not the viewport's — the
    // same card sits in a 2-, 3- and 4-column grid.
    <article
      aria-busy={isAdding || undefined}
      className="group relative @container flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-card"
    >
      {/* The whole card goes busy, not just the button: the stepper, the price
          and the in-cart pill are all about to change, and a spinner on one
          control implies the rest are still live. */}
      {isAdding && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-[14px] bg-surface/65 backdrop-blur-[1px]"
          aria-hidden="true"
        >
          <Loader2 className="size-6 animate-spin text-brand" strokeWidth={2} />
        </div>
      )}

      {/* ---- image ---------------------------------------------------- */}
      <div className="relative aspect-4/3 shrink-0 overflow-hidden bg-surface-2">
        <Link
          to={`/product/${product.slug}`}
          className="block size-full p-4 transition-transform duration-300 group-hover:scale-[1.03] @min-[200px]:p-6"
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.image ? (
            <img
              src={product.image}
              alt=""
              loading="lazy"
              className="size-full object-contain"
            />
          ) : (
            <PartIllustration partType={product.partType} label={product.partTypeLabel} />
          )}
        </Link>

        <GradeBadge grade={product.grade} className="absolute left-2 top-2 @min-[200px]:left-3 @min-[200px]:top-3" />

        {outOfStock && (
          <span className="eyebrow absolute right-2 top-2 rounded-full bg-ink-900/85 px-1.5 py-1 text-white @min-[200px]:right-3 @min-[200px]:top-3 @min-[200px]:px-2">
            Out of stock
          </span>
        )}

        {/* A bare number in a coloured circle here read as a second grade stamp —
            same shape, same corner of the same image. This is a labelled pill on
            a light ground instead: different shape, different weight, and it
            says what the number counts. */}
        {inCartQty > 0 && (
          <motion.span
            key={inCartQty}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full border border-brand/25 bg-surface/95 py-1 pl-1.5 pr-2 text-[11px] font-semibold text-brand-700 shadow-card backdrop-blur-[2px] @min-[200px]:bottom-3 @min-[200px]:right-3"
          >
            <ShoppingCart className="size-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <span className="tnum">{inCartQty} in cart</span>
          </motion.span>
        )}
      </div>

      {/* ---- body ------------------------------------------------------ */}
      {/* Every size below is driven by the CARD's width (@container), never the
          viewport's: the same card sits in a 2-, 3- and 4-column grid, and on a
          375px phone the 2-up card is ~169px wide. */}
      <div className="flex flex-1 flex-col gap-2 p-3 @min-[200px]:gap-2.5 @min-[200px]:p-4">
        <div className="min-h-0 flex-1">
          <p className="eyebrow mb-1 text-ink-300 @min-[200px]:mb-1.5">{product.partTypeLabel}</p>

          {/* Two lines of space whether the name needs them or not: a one-line
              name would otherwise pull the price, stock line and button up and
              leave the row of cards ragged. 2.75em = two lines at leading-snug,
              and em tracks the card's own responsive font size. */}
          <h3 className="min-h-[2.75em] text-[13px] font-semibold leading-snug @min-[200px]:text-[14.5px]">
            <Link
              to={`/product/${product.slug}`}
              className="line-clamp-2 transition-colors hover:text-brand"
            >
              {product.name}
            </Link>
          </h3>

          <p className="mt-1 truncate font-mono text-[11px] text-ink-300">{product.sku}</p>
        </div>

        {/* Availability, as a boolean. The on-hand count used to sit here; it is
            warehouse data that moves hourly, and a buyer planning a build around
            "37 in stock" was planning against a number we could not honour. */}
        <div className="flex items-center gap-1.5 text-[12px] @min-[200px]:text-[12.5px]">
          <span
            className={cn('size-1.5 shrink-0 rounded-full', outOfStock ? 'bg-ink-300' : 'bg-ok')}
            aria-hidden="true"
          />
          <span className={outOfStock ? 'text-ink-400' : 'text-ok'}>
            {outOfStock ? 'Out of stock' : 'In stock'}
          </span>
        </div>

        {/* price, gated */}
        <div className="relative">
          <div className={cn(gated && 'price-gated', 'space-y-1')} aria-hidden={gated || undefined}>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[17px] font-bold tracking-tight text-ink-900 tnum @min-[200px]:text-[19px] @min-[260px]:text-[21px]">
                {gated ? '$000.00' : money(product.price)}
              </span>
              {!gated && product.compareAtPrice && (
                <span className="tnum text-[12.5px] text-ink-300 line-through">
                  {money(product.compareAtPrice)}
                </span>
              )}
            </div>
          </div>

          {gated && (
            <button
              type="button"
              onClick={() => openAccount('signin')}
              className="absolute inset-0 -m-1 flex items-center justify-center rounded-lg bg-surface/45 backdrop-blur-[1px] transition-colors hover:bg-surface/25"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 shadow-card">
                <Lock className="size-3" strokeWidth={2.25} aria-hidden="true" />
                {isAuthenticated ? 'Pending approval' : 'Login to view price'}
              </span>
            </button>
          )}
        </div>

        {/* Add to cart. One row at every card width — the stepper narrows with
            the card (QtyStepper size="card") instead of dropping onto a second
            line, which is what made the two-up phone card 80px taller than it
            needed to be. Under 200px the button's word goes and the trolley
            carries it; the accessible name is on aria-label either way. */}
        <div className="mt-0.5 flex items-center gap-1.5 @min-[200px]:gap-2">
          <QtyStepper
            value={qty}
            onChange={setQty}
            size="card"
            disabled={outOfStock}
            className="shrink-0"
          />

          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || isAdding}
            aria-label={`Add ${product.name} to cart`}
            className={cn(
              'flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[8px] font-display text-[13px] font-semibold transition-[background,color,filter] duration-[120ms]',
              outOfStock
                ? 'cursor-not-allowed bg-surface-3 text-ink-300'
                : justAdded
                  ? 'bg-ok text-white'
                  : 'bg-brand-gradient text-white hover:brightness-110 active:brightness-95',
            )}
          >
            {justAdded ? (
              <>
                <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                <span className="hidden @min-[200px]:inline">Added</span>
              </>
            ) : (
              <>
                <ShoppingCart className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="hidden @min-[200px]:inline">Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
