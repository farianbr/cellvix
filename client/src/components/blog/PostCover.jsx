import cn from '@/lib/cn';

/**
 * Cover art for a post that has no photograph.
 *
 * The blog ships before Cellvix has supplied any photography, and an index of
 * grey rectangles is worse than no index. Each category gets a technical motif
 * drawn on design tokens, and the diagonal hatch behind it is seeded from the
 * slug so two posts in the same category still read as different.
 *
 * The hatch is CSS and the motif is capped in pixels rather than scaled with the
 * box: the same component fills a 64px thumbnail and a 680px featured panel, and
 * an SVG stretched across the second one turns a 2px stroke into a 14px one.
 *
 * `coverImage` on the post always wins — the moment real art exists this
 * component is never reached for that post.
 */

const MOTIFS = {
  'repair-guides': (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="26" y="12" width="44" height="76" rx="7" />
      <rect x="33" y="21" width="30" height="58" rx="3" opacity="0.35" />
      <path d="M72 40l18 8-18 8" opacity="0.75" />
      <path d="M98 34v32" opacity="0.45" />
    </g>
  ),
  'industry-news': (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="14" y="22" width="72" height="56" rx="6" />
      <path d="M86 34h12a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H26" opacity="0.45" />
      <path d="M24 36h34M24 46h34M24 56h22M24 66h28" opacity="0.55" />
      <rect x="64" y="36" width="14" height="20" rx="2" opacity="0.35" />
    </g>
  ),
  'product-updates': (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 38 56 22l40 16v34L56 88 16 72z" />
      <path d="M16 38 56 54l40-16M56 54v34" opacity="0.5" />
      <circle cx="92" cy="28" r="10" />
      <path d="M87.5 28l3 3 6-6" />
    </g>
  ),
  'business-tips': (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 80h88" />
      <rect x="22" y="56" width="16" height="24" rx="2" opacity="0.45" />
      <rect x="48" y="42" width="16" height="38" rx="2" opacity="0.65" />
      <rect x="74" y="26" width="16" height="54" rx="2" />
      <path d="M20 34l14-8 14 10 22-18" opacity="0.45" />
    </g>
  ),
};

/** Deterministic small integer from a slug — same post, same hatch, every time. */
function hash(value = '') {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) % 9973;
  }
  return total;
}

export function PostCover({ post, className, ratio = 'aspect-16/10' }) {
  if (post?.coverImage) {
    return (
      <div className={cn('overflow-hidden bg-surface-2', ratio, className)}>
        <img
          src={post.coverImage}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
    );
  }

  const seed = hash(post?.slug ?? '');
  const angle = 20 + (seed % 5) * 14;
  const motif = MOTIFS[post?.category] ?? MOTIFS['industry-news'];

  return (
    <div className={cn('relative overflow-hidden bg-surface-2', ratio, className)}>
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: `repeating-linear-gradient(${angle}deg, var(--color-line) 0 1px, transparent 1px 11px)`,
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-2">
        <span className="flex aspect-square w-[62%] max-w-[150px] items-center justify-center rounded-full bg-surface/90">
          <svg viewBox="0 0 120 100" className="w-[66%] text-brand" aria-hidden="true">
            {motif}
          </svg>
        </span>
      </div>
    </div>
  );
}

export default PostCover;
