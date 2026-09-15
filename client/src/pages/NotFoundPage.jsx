import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Home, Search } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import UnpluggedScene from '@/components/ui/UnpluggedScene';
import { useFilterStore } from '@/store/filterStore';

/**
 * 404 - a recovery moment, not a dead end (brief §9).
 *
 * Deliberately the thinnest page in the app. A 404 is read for about two
 * seconds by someone who is already annoyed, so it offers exactly two ways out
 * - search the catalogue, or go home - and nothing else. The category chips and
 * the three cross-link cards that used to sit below the fold were removed for
 * that reason: they were a second menu on a page whose whole job is to hand you
 * back to the first one.
 *
 * ## The layout
 *
 * A centred column under a cable that has come apart. The illustration runs the
 * full width of the viewport rather than sitting in the measure, because the
 * break only reads as a break if the two leads leave the frame: boxed in at
 * 640px it stops being a cable that was whole and becomes a picture of a plug.
 * Everything under it is centred on the same axis as the parting, so the eye
 * goes gap, numerals, sentence, action, in that order.
 *
 * The numerals are the biggest type in the app and they are `ink-900`, not the
 * brand ramp. A gradient fill on text is banned outright (§2.2), and the red is
 * already spent on the spark above and the CTA below - a third use would leave
 * the page with no single place to look.
 *
 * The search field is the point of the page: someone who followed a broken link
 * is looking for a part, and a list of category shortcuts is a slower answer
 * than a text box. It writes the shared filter store as well as the URL,
 * because the shop hydrates from the URL once per mount and merges into
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
    // Straight to the grid. `/?q=` would redirect there anyway, but going via
    // the homepage means a wasted render and a history entry nobody wanted.
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="flex flex-col items-center overflow-hidden pt-8 pb-14 lg:pt-12 lg:pb-20">
      {/* Genuinely full-bleed - `w-full` with no cap, clipped by the parent's
          `overflow-hidden` rather than by the viewport, so it never puts a
          horizontal scrollbar on the page.

          Capping it (it was `max-w-[1100px]`) centred the drawing and left the
          leads ending in mid-air a couple of hundred pixels inside each edge,
          which turns a cable that was pulled apart into a floating clip-art
          plug. The whole point is that the line continues past the frame, so
          the element has to be as wide as the frame is.

          The plugs do not drift apart as the window grows, because they are
          positioned in `viewBox` units: the SVG scales as one picture rather
          than stretching, so the gap is a fixed share of the width.

          Which is exactly why it is OVER-width on a phone. An SVG that scales
          as one picture scales its subject down with it, and at 360px the
          plugs came out about 30px across - a detail, not an illustration, with
          the numerals crowding it. Pushing the element to 180% and letting the
          sides clip keeps the plugs at a legible size and crops the slack lead
          instead, which is the part of the drawing that carries no information. */}
      <UnpluggedScene className="h-auto w-[170%] max-w-none shrink-0 sm:w-[120%] lg:w-full" />

      <div className="mx-auto -mt-2 flex w-full max-w-[640px] flex-col items-center px-5 text-center sm:px-6 sm:-mt-4">
        {/* The numerals ARE the heading - marked up as one, not as decoration
            with a screen-reader label bolted beside it. `tabular-nums` so the
            two 4s and the 0 sit on even widths at this size, where the default
            proportional set leaves a visible gap after the first digit. */}
        {/* The top of the type scale, and the only place in the app that uses
            it. `d-xl` already carries its own tracking and a line-height of 1,
            so the numerals need nothing added: an arbitrary size here would be
            a defect (§2.1), and the scale stopping at 72px is the answer to
            "how big" rather than a limit to work around. */}
        <h1 className="tnum font-display text-d-md font-extrabold text-ink-900 sm:text-d-lg lg:text-d-xl">
          404
        </h1>

        <p className="mt-4 font-display text-2xl font-bold tracking-[-0.015em] text-ink-900 sm:text-3xl">
          This page came apart
        </p>

        <p className="mt-3 max-w-md text-lg leading-relaxed text-ink-500">
          Nothing here answers to{' '}
          <span className="break-all font-mono text-md text-ink-700">{pathname}</span>. Search
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
          className="mt-4 inline-flex h-11 w-full max-w-md items-center justify-center gap-2 rounded-md bg-brand-gradient px-6 font-display text-md font-semibold text-white transition-[filter] duration-press hover:brightness-110 active:brightness-95 sm:mt-6 sm:w-auto"
        >
          <Home className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Go to home
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
