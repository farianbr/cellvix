import { Link } from 'react-router';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { money, productTitle } from '@/lib/format';
import { PartVisual } from '@/components/product/PartFrame';
import GradeBadge from '@/components/product/GradeBadge';

/**
 * One part given the room to make its case, with the rest of the shortlist
 * beside it in a scrolling column.
 *
 * WHY NOT A FOURTH GRID. The homepage already runs three grids of equal cards
 * (clearance, new stock, and the catalogue one click away). A fourth says
 * nothing new: a grid tells a reader "here are some parts", and by the third
 * one they have learned to scroll past the shape. This says "here is the part",
 * which is a different sentence, and the column beside it is what stops that
 * from being a dead end for anybody who wants a different one.
 *
 * WHY THE COLUMN SCROLLS. It is capped at the hero part's height so the block
 * stays one rectangle. Left to grow, five rows of a list next to one large
 * card makes the section taller than the card needs and the card ends up
 * floating in its own half.
 */

function Row({ product }) {
  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        pressable,
        'group flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors duration-snap hover:border-line hover:bg-surface-2',
      )}
    >
      <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-surface-2 p-1.5 group-hover:bg-surface">
        <PartVisual product={product} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm font-semibold leading-snug text-ink-900 group-hover:text-brand">
          {productTitle(product.name, product.partTypeLabel)}
        </span>
        {/* The gate is server-side; a gated card simply has no price to print,
            so the row says what it can say instead of blurring a placeholder at
            this size. */}
        {product.priceVisible ? (
          <span className="tnum mt-1 block text-sm font-bold text-ink-900">
            {money(product.price)}
          </span>
        ) : (
          <span className="mt-1 block text-xs text-ink-400">Price on approval</span>
        )}
      </span>
    </Link>
  );
}

export function FeaturedSplit({ lead, rest = [] }) {
  if (!lead) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {/* ---- the one part --------------------------------------------- */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative flex aspect-square w-full shrink-0 items-center justify-center rounded-lg bg-surface-2 p-8 sm:size-56 lg:size-64">
          <GradeBadge grade={lead.grade} className="absolute left-3 top-3" />
          <PartVisual product={lead} />
        </div>

        <div className="min-w-0">
          <p className="eyebrow text-brand">{lead.partTypeLabel}</p>
          <h3 className="mt-1.5 font-display text-xl font-bold leading-tight text-ink-900">
            <Link to={`/product/${lead.slug}`} className={cn(pressable, 'hover:text-brand')}>
              {productTitle(lead.name, lead.partTypeLabel)}
            </Link>
          </h3>

          {lead.priceVisible ? (
            <p className="mt-3 flex items-baseline gap-2">
              <span className="tnum font-display text-2xl font-bold text-ink-900">
                {money(lead.price)}
              </span>
              {lead.compareAtPrice > lead.price && (
                <span className="tnum text-sm text-ink-400 line-through">
                  {money(lead.compareAtPrice)}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-400">Pricing shows once your account is approved.</p>
          )}

          {/* In stock / out of stock, never a count - stock levels are an
              admin number (Instructions §5). */}
          <p
            className={cn(
              'mt-2 text-sm font-medium',
              lead.inStock ? 'text-ok' : 'text-ink-400',
            )}
          >
            {lead.inStock ? 'In stock' : 'Out of stock'}
          </p>

          <Link
            to={`/product/${lead.slug}`}
            className={cn(
              pressable,
              'mt-4 inline-flex h-11 items-center rounded-lg border border-line-strong px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2',
            )}
          >
            View part
          </Link>
        </div>
      </div>

      {/* ---- the shortlist -------------------------------------------- */}
      {rest.length > 0 && (
        <div className="scroll-slim max-h-[280px] divide-y divide-line overflow-y-auto border-line lg:max-h-[264px] lg:border-l lg:pl-5">
          {rest.map((product) => (
            <Row key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default FeaturedSplit;
