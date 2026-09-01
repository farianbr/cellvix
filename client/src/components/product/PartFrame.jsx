import cn from '@/lib/cn';
import { productTitle } from '@/lib/format';
import { productPhoto } from '@/lib/partPhoto';
import PartIllustration from './PartIllustration';

/**
 * The product visual: the part name and model set INSIDE the top of the image
 * area, with the drawing (or the photograph) sat below them.
 *
 * The caption is inside the frame rather than stacked above it, because above
 * the frame it would cost a row of height the grid does not have. Inside, it
 * uses space the drawing was never using — and the drawing is inset from the
 * top by exactly the caption's height, so the two never overlap and no part of
 * the product is hidden.
 *
 * One component for the card and the detail page: the caption's type scales
 * with the FRAME's width (@container), so a two-up phone card and a 600px
 * detail panel get the same layout at different sizes, and a change to one is
 * a change to both.
 *
 * `caption={false}` for the many small placements — cart lines, search rows,
 * order items — where the frame is ~40px and any text in it would be noise.
 *
 * `titleAs` decides whether the caption is THE heading for the product or a
 * decorative echo of one that lives elsewhere. On the card it is the heading
 * (the body no longer repeats it); on the detail page the <h1> beside the
 * image owns that job, so there the caption is aria-hidden.
 */
/**
 * A product's picture: its own photograph, else the brand stock photo for its
 * part type, else the line drawing.
 *
 * The fallback chain lives here rather than at each call site because there are
 * a dozen of them — cards, cart lines, search rows, order items — and a chain
 * copied a dozen times is a chain that drifts.
 *
 * `alt=""` throughout: every placement already names the product in text beside
 * the image, so the picture is decorative and announcing it repeats the name.
 */
export function PartVisual({ product, className }) {
  const photo = productPhoto(product);

  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        className={cn('size-full object-contain', className)}
      />
    );
  }

  return (
    <PartIllustration
      partType={product?.partType}
      label={product?.partTypeLabel}
      className={cn('size-full', className)}
    />
  );
}

export function PartFrame({
  product,
  caption = true,
  decorative = false,
  className,
  aspect = 'aspect-4/3',
  captionSlot,
  children,
}) {
  const model = productTitle(product.name, product.partTypeLabel);
  const showCaption = caption && Boolean(product.partTypeLabel || model);

  return (
    <div className={cn('relative @container overflow-hidden', aspect, className)}>
      {showCaption && (
        // The side padding clears the grade badge in the top-left corner, so
        // the centred model name never runs under it.
        <div
          className="absolute inset-x-0 top-0 z-1 px-12 pt-2.5 text-center @min-[200px]:px-14 @min-[200px]:pt-3 @min-[420px]:px-24 @min-[420px]:pt-5"
          aria-hidden={decorative || undefined}
        >
          {/* Below 200px the part-type line goes. It truncated to "FRONT…" at
              that width — a label that costs a line of the drawing's height and
              does not finish a word — and the card body still names the part
              type in full further down. */}
          <p className="hidden truncate text-[9.5px] font-semibold uppercase leading-none tracking-widest text-ink-300 @min-[200px]:block @min-[420px]:text-[11px]">
            {product.partTypeLabel}
          </p>

          {/* Two lines of room whether the model needs them or not, so the
              drawing below starts at the same y on every card in a row.
              2.4em = two lines at leading-tight. */}
          <div className="line-clamp-2 min-h-[2.4em] font-display text-[12px] font-bold leading-tight tracking-tight text-ink-800 @min-[200px]:mt-1.5 @min-[200px]:text-[14px] @min-[420px]:text-[20px]">
            {captionSlot ?? model}
          </div>
        </div>
      )}

      {/* The drawing is pushed clear of the caption rather than sat under it.
          The top padding tracks the caption's own height at each step. */}
      <div
        className={cn(
          'size-full',
          showCaption
            ? 'px-3 pb-2 pt-13 @min-[200px]:px-4 @min-[200px]:pb-3 @min-[200px]:pt-16 @min-[420px]:px-8 @min-[420px]:pb-6 @min-[420px]:pt-24'
            : 'p-4 @min-[200px]:p-6',
        )}
      >
        {children ?? <PartVisual product={product} />}
      </div>
    </div>
  );
}

export default PartFrame;
