import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Tag } from 'lucide-react';
import { count as formatCount } from '@/lib/format';
import { SORT_OPTIONS } from '@/lib/constants';
import SelectMenu from '@/components/ui/SelectMenu';
import ProductGrid from '@/components/product/ProductGrid';
import Pagination from '@/components/ui/Pagination';
import { useClearance } from '@/hooks/useCatalog';
import useDocumentTitle from '@/hooks/useDocumentTitle';

/**
 * Stock clearance.
 *
 * A page of parts an admin has decided to clear, NOT a page of parts the
 * warehouse happens to be low on. The difference matters twice over: the
 * storefront may not publish an on-hand count or a reorder point, so a list
 * derived from stock levels would have had to leak exactly what that rule
 * forbids - and a list that rebuilt itself whenever the warehouse moved would
 * put parts in front of buyers that nobody decided to sell down.
 *
 * So every card carries a REASON. "Discontinued line" and "packaging damaged,
 * part sealed" are different purchases: the first is a warning about resupply,
 * the second is simply a cheaper box. A clearance price with nothing beside it
 * reads as a part with a fault nobody will name.
 */
export function ClearancePage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('price-asc');

  useDocumentTitle('Stock clearance');

  const { data, isLoading, isFetching, error } = useClearance({ page, sort });
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 sm:px-4 lg:px-6 lg:py-8">
      {/* ---- the header -------------------------------------------------
          A band rather than a bare heading: clearance is a standing section of
          the catalogue, and the one thing a buyer needs told before they read
          a price is what "clearance" means here - same grading, same warranty,
          finite stock. Without that the cheap number is the only signal and it
          reads as seconds.

          Bordered on surface, NOT a gradient panel. The gradient is a
          signature, not a background (§2.2): at band size it stopped reading
          as depth and became a field of red that the copy then had to survive
          rather than sit on. The brand stays as the eyebrow. */}
      <header className="overflow-hidden rounded-xl border border-line bg-surface px-5 py-7 sm:px-8 sm:py-9">
        <p className="eyebrow flex items-center gap-2 text-brand">
          <Tag className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          Clearance
        </p>

        <h1 className="mt-3 max-w-xl font-display text-2xl font-bold leading-tight text-ink-900 sm:text-d-sm">
          Lines we are clearing out, at the price that clears them.
        </h1>

        <p className="mt-3 max-w-xl text-md leading-relaxed text-ink-500">
          Same grading and the same warranty as the rest of the catalogue. What is
          different is the quantity: when a line here is gone it is not coming
          back.
        </p>
      </header>

      {/* ---- the results ------------------------------------------------- */}
      <div className="mt-6 mb-3 flex min-w-0 flex-wrap items-center gap-2.5">
        <h2 className="font-display text-lg font-bold sm:text-xl">
          On clearance
          <span className="tnum ml-2 text-md font-medium text-ink-400">
            {isLoading ? '-' : `${formatCount(total)} parts`}
          </span>
        </h2>

        <SelectMenu
          size="sm"
          options={SORT_OPTIONS}
          value={sort}
          onChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          srLabel="Sort clearance stock"
          align="right"
          className="ml-auto w-full min-w-0 sm:w-[170px]"
        />
      </div>

      <ProductGrid
        products={data?.products ?? []}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        error={error}
        emptyTitle="Nothing on clearance right now"
        emptyBody="Everything is at its standard price today. The catalogue is the place to look."
      />

      {data?.pages > 1 && (
        <Pagination
          page={page}
          pages={data.pages}
          onChange={(next) => {
            setPage(next);
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
          className="mt-8"
        />
      )}

      {/* One way onward, for the reader who found nothing here worth having. */}
      <div className="mt-10 border-t border-line pt-6">
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 font-display text-md font-semibold text-brand hover:text-brand-700"
        >
          Browse the full catalogue
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default ClearancePage;
