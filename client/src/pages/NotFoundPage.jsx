import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Home, Search } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useFilterStore } from '@/store/filterStore';

/**
 * 404 — a recovery moment, not a dead end (brief §9).
 *
 * Deliberately the thinnest page in the app. A 404 is read for about two
 * seconds by someone who is already annoyed, so it offers exactly two ways
 * out — search the catalogue, or go home — and nothing else. The category
 * chips and the three cross-link cards that used to sit below the fold were
 * removed for that reason: they were a second menu on a page whose whole job
 * is to hand you back to the first one.
 *
 * The search field is the point of the page: someone who followed a broken
 * link is looking for a part, and a list of category shortcuts is a slower
 * answer than a text box. It writes the shared filter store as well as the
 * URL, because the shop hydrates from the URL once per mount and merges into
 * whatever the store still holds from an earlier visit.
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');

  function search(event) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    const store = useFilterStore.getState();
    store.resetAll();
    store.setQuery(term);
    navigate(`/?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center px-5 py-12 text-center sm:px-6 lg:py-20">
      {/* The numerals and the broken-device scene are one composite image, not
          two elements the layout has to keep in step — they were drawn as a
          single illustration and they read as one. Two crops of it ship: a wide
          arrangement from 640 up, and a stacked one below that, because the
          side-by-side version scales the numerals down to nothing on a phone.
          `picture` picks between them on a media query, so only the one that
          will actually be shown is ever fetched.

          The whole thing is decorative — the `sr-only` heading below carries
          the meaning — so it is `alt=""` and hidden from the accessibility
          tree rather than described twice. */}
      <h1 className="w-full">
        <picture>
          <source
            media="(min-width: 640px)"
            type="image/webp"
            srcSet="/brand/404-hero.webp 640w, /brand/404-hero@2x.webp 1280w"
            sizes="(min-width: 1024px) 560px, 460px"
          />
          <source
            media="(min-width: 640px)"
            srcSet="/brand/404-hero.png 640w, /brand/404-hero@2x.png 1280w"
            sizes="(min-width: 1024px) 560px, 460px"
          />
          <source
            type="image/webp"
            srcSet="/brand/404-hero-stacked.webp 420w, /brand/404-hero-stacked@2x.webp 840w"
            sizes="260px"
          />
          <img
            src="/brand/404-hero-stacked.png"
            srcSet="/brand/404-hero-stacked.png 420w, /brand/404-hero-stacked@2x.png 840w"
            sizes="260px"
            alt=""
            aria-hidden="true"
            draggable="false"
            width="640"
            height="353"
            decoding="async"
            className="pointer-events-none mx-auto h-auto w-[260px] max-w-full select-none sm:w-[460px] lg:w-[560px]"
          />
        </picture>
        <span className="sr-only">404 — this page came apart</span>
      </h1>

      {/* Styled as the heading it visually is, but marked up as a paragraph:
          the h1 above already owns the outline slot, and two h1s would be
          worse than one. Matches the base heading rule's tracking. */}
      <p className="mt-6 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink-900 sm:mt-8 sm:text-[32px]">
        This page came apart
      </p>

      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-500">
        Nothing here answers to{' '}
        <span className="break-all font-mono text-[13.5px] text-ink-700">{pathname}</span>. Search
        the catalogue instead.
      </p>

      {/* The field and its button stack at 320 rather than squeezing onto one
          row: `flex-1` on a `min-w` basis wide enough to type into cannot fit
          beside a button at that width without one of them overflowing. */}
      <form
        onSubmit={search}
        className="mt-7 flex w-full max-w-md flex-col gap-2.5 sm:flex-row sm:items-center"
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Part name, model or SKU…"
          icon={Search}
          aria-label="Search the catalogue"
          containerClassName="w-full sm:flex-1 sm:min-w-0"
        />
        <Button type="submit" size="md" iconRight={ArrowRight} className="w-full sm:w-auto">
          Search
        </Button>
      </form>

      {/* The gradient belongs on the CTA, and this is the CTA (§2.2). Styled
          inline the way every other button-shaped Link in the app is, because
          `Button` renders a real <button> and this has to be an anchor. */}
      <Link
        to="/"
        className="mt-4 inline-flex h-11 w-full max-w-md items-center justify-center gap-2 rounded-[10px] bg-brand-gradient px-6 font-display text-[14px] font-semibold text-white transition-[filter] duration-[120ms] hover:brightness-110 active:brightness-95 sm:mt-6 sm:w-auto"
      >
        <Home className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Go to home
      </Link>
    </div>
  );
}

export default NotFoundPage;
