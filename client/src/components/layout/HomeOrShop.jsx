import { Navigate, useSearchParams } from 'react-router';
import HomePage from '@/pages/HomePage';

/**
 * What `/` answers, now that the catalogue has moved to `/shop`.
 *
 * The shop owned `/` for the whole life of this project, so every link anyone
 * has ever shared or bookmarked into a filtered catalogue looks like
 * `/?deviceType=smartphone&grade=OEM`. Those must not land on a marketing page
 * with their filters silently dropped - that is a broken link that looks like a
 * working one, which is the worst kind.
 *
 * So: `/` with any catalogue parameter is a catalogue URL and is forwarded to
 * `/shop` with the query string intact. A bare `/` is the homepage. The
 * redirect replaces rather than pushes, so Back returns to wherever the reader
 * came from rather than bouncing them through the redirect again.
 */

/**
 * Every parameter the filter store mirrors into the URL. Kept as a literal
 * list rather than "any query string at all" because campaign tags land on the
 * homepage constantly - `/?utm_source=…` is a homepage visit, not a catalogue
 * one, and forwarding it would send every ad click to the shop.
 */
const CATALOGUE_PARAMS = [
  'deviceType',
  'brand',
  'series',
  'model',
  'partType',
  'grade',
  'inStockOnly',
  'priceMin',
  'priceMax',
  'sort',
  'page',
  'q',
];

export function HomeOrShop() {
  const [searchParams] = useSearchParams();

  const isCatalogueUrl = CATALOGUE_PARAMS.some((key) => searchParams.has(key));
  if (isCatalogueUrl) {
    // `search` wants the leading '?'; `toString()` does not include one.
    return <Navigate to={{ pathname: '/shop', search: `?${searchParams.toString()}` }} replace />;
  }

  return <HomePage />;
}

export default HomeOrShop;
