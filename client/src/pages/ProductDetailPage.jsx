import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Lock, ShieldCheck, ShoppingCart } from 'lucide-react';
import cn from '@/lib/cn';
import api from '@/lib/api';
import { money } from '@/lib/format';
import { GRADES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import QtyStepper from '@/components/product/QtyStepper';
import GradeBadge from '@/components/product/GradeBadge';
import PartIllustration from '@/components/product/PartIllustration';
import ProductCard from '@/components/product/ProductCard';
import MarketCompare from '@/components/product/MarketCompare';
import ProductFaq from '@/components/product/ProductFaq';
import WhyCellvix from '@/components/product/WhyCellvix';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import useUiStore from '@/store/uiStore';
import useFilterStore from '@/store/filterStore';

function Breadcrumbs({ product }) {
  const setPath = useFilterStore((s) => s.setPath);

  // Crumbs filter the shop rather than pointing at category routes — the
  // taxonomy has no pages of its own (brief §3, §5).
  const crumbs = [
    { label: product.deviceTypeName, path: { deviceType: product.deviceTypeSlug } },
    {
      label: product.brandName,
      path: { deviceType: product.deviceTypeSlug, brand: product.brandSlug },
    },
    {
      label: product.modelName,
      path: {
        deviceType: product.deviceTypeSlug,
        brand: product.brandSlug,
        series: product.seriesSlug,
        model: product.modelSlug,
      },
    },
  ].filter((crumb) => crumb.label);

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-[12.5px]">
      <Link to="/" className="text-ink-400 transition-colors hover:text-brand">
        Shop
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.label} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 text-ink-300" strokeWidth={2} aria-hidden="true" />
          <Link
            to="/"
            onClick={() => setPath(crumb.path)}
            className="text-ink-400 transition-colors hover:text-brand"
          >
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function ProductDetailPage() {
  const { slug } = useParams();
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const openCartAfterAdd = useUiStore((s) => s.openCartAfterAdd);
  const openAccount = useUiStore((s) => s.openAccount);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.get(`/products/${slug}`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-[22px]">Part not found</h1>
        <p className="mt-3 text-[14px] text-ink-500">{error.message}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand hover:text-brand-700"
        >
          Back to the catalogue
        </Link>
      </div>
    );
  }

  const { product, related, faqs } = data;
  const gated = !product.priceVisible;
  const outOfStock = !product.inStock;
  const grade = GRADES[product.grade];

  function handleAdd() {
    addItem(product, qty);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
    // Desktop only — on a phone the dropdown would cover the page you just
    // acted on. See openCartAfterAdd.
    openCartAfterAdd();
  }

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 sm:px-4 lg:px-6 lg:py-8">
      <Breadcrumbs product={product} />

      <div className="grid gap-6 md:grid-cols-2 lg:gap-10">
        {/* ---- visual ------------------------------------------------------ */}
        <div className="relative @container overflow-hidden rounded-[14px] border border-line bg-surface-2">
          <div className="aspect-square p-10 lg:p-16">
            {product.image ? (
              <img src={product.image} alt={product.name} className="size-full object-contain" />
            ) : (
              <PartIllustration partType={product.partType} label={product.partTypeLabel} />
            )}
          </div>
          <GradeBadge grade={product.grade} className="absolute left-4 top-4" />
        </div>

        {/* ---- detail ------------------------------------------------------ */}
        <div className="min-w-0">
          <p className="eyebrow mb-2 text-ink-300">{product.partTypeLabel}</p>
          <h1 className="text-[24px] leading-tight sm:text-[30px]">{product.name}</h1>

          {/* Availability is a boolean here and everywhere else on the
              storefront. The on-hand count is warehouse data, and printing it
              invited buyers to plan against a number that moves hourly. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={grade?.tone ?? 'neutral'}>{grade?.label ?? product.grade}</Badge>
            <Badge tone={outOfStock ? 'neutral' : 'ok'}>
              {outOfStock ? 'Out of stock' : 'In stock'}
            </Badge>
          </div>

          {/* price, gated */}
          <div className="relative mt-6">
            <div className={cn(gated && 'price-gated')} aria-hidden={gated || undefined}>
              <div className="flex items-baseline gap-3">
                <span className="tnum font-display text-[32px] font-bold tracking-tight text-ink-900">
                  {gated ? '$000.00' : money(product.price)}
                </span>
                {!gated && product.compareAtPrice && (
                  <span className="tnum text-[15px] text-ink-300 line-through">
                    {money(product.compareAtPrice)}
                  </span>
                )}
              </div>
            </div>

            {gated && (
              <button
                type="button"
                onClick={() => openAccount('signin')}
                className="absolute inset-0 -m-2 flex items-center justify-start rounded-lg bg-surface/40 backdrop-blur-[1px] transition-colors hover:bg-surface/20"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink-700 shadow-card">
                  <Lock className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                  {isAuthenticated ? 'Pending approval' : 'Sign in to view trade pricing'}
                </span>
              </button>
            )}
          </div>

          {/* What the same part costs elsewhere. Absent while the price is
              gated — the server sends no comparison without a price to compare. */}
          {!gated && (
            <MarketCompare market={product.market} price={product.price} variant="detail" className="mt-5" />
          )}

          {/* add to cart */}
          <div className="mt-6 flex flex-wrap items-stretch gap-3">
            <QtyStepper value={qty} onChange={setQty} disabled={outOfStock} />
            <Button
              size="md"
              className="min-w-[180px] flex-1"
              onClick={handleAdd}
              disabled={outOfStock}
              icon={justAdded ? Check : ShoppingCart}
              variant={justAdded ? 'solid' : 'primary'}
            >
              {justAdded ? 'Added to cart' : 'Add to cart'}
            </Button>
          </div>

          <p className="mt-4 flex items-start gap-2 text-[12.5px] text-ink-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Tested before dispatch · {product.specs?.Warranty ?? '30 days'} warranty · Ships from
            Ontario
          </p>

          {product.description && (
            <p className="mt-6 text-[14px] leading-relaxed text-ink-500">{product.description}</p>
          )}

          {/* The SKU used to sit under the title, where it was the second thing
              on the page and meant nothing to a buyer still deciding. It is a
              reordering reference, so it lives with the rest of the reference
              data — first row, because it is the one a buyer comes back for. */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <dl className="mt-6 overflow-hidden rounded-[12px] border border-line">
              {Object.entries({ SKU: product.sku, ...product.specs }).map(([key, value], index) => (
                <div
                  key={key}
                  className={cn(
                    'flex justify-between gap-4 px-4 py-2.5 text-[13px]',
                    index % 2 === 1 && 'bg-surface-2',
                  )}
                >
                  <dt className="text-ink-500">{key}</dt>
                  <dd className="text-right font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* ---- why Cellvix ---------------------------------------------------- */}
      <WhyCellvix product={product} className="mt-10 lg:mt-14" />

      {/* ---- product FAQ ---------------------------------------------------- */}
      {/* Sits above Related on purpose: the questions belong to the part being
          looked at, and a grid of other parts is an invitation to leave. */}
      <ProductFaq faqs={faqs} product={product} className="mt-10 lg:mt-14" />

      {/* ---- related -------------------------------------------------------- */}
      {related?.length > 0 && (
        <section className="mt-10 lg:mt-14">
          <h2 className="mb-4 text-[18px]">More parts for the {product.modelName}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {related.slice(0, 4).map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetailPage;
