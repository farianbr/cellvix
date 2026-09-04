import { ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router';
import useUiStore from '@/store/uiStore';

/** Thin promo strip with a dismiss (brief §4.2). The gradient's smallest use. */
export function AnnouncementBar() {
  const dismissed = useUiStore((s) => s.announcementDismissed);
  const dismiss = useUiStore((s) => s.dismissAnnouncement);

  if (dismissed) return null;

  return (
    <div className="relative bg-brand-gradient text-white">
      <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-2 px-10 py-2 text-center">
        <p className="text-sm font-medium leading-tight">
          Free shipping on wholesale orders over $500 · Same-day dispatch before 2 PM ET
        </p>

        {/* The strip is the only always-visible place an offer can be
            advertised, and a promo line nobody can act on is wasted space. */}
        <Link
          to="/offers"
          className="hidden shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-white/25 sm:inline-flex"
        >
          See offers
          <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

export default AnnouncementBar;
