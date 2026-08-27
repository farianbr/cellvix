import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { iconFor } from '@/lib/icons';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import cn from '@/lib/cn';
import { count as formatCount } from '@/lib/format';
import { useTaxonomy } from '@/hooks/useCatalog';
import useApplyFilterPath from '@/hooks/useApplyFilterPath';
import useUiStore from '@/store/uiStore';
import Skeleton from '@/components/ui/Skeleton';

/**
 * The desktop mega menu (brief §4.1).
 *
 * Critically: these are LIVE FILTERS, not links. Clicking a category writes to
 * the shared filter store and closes the panel — on the Shop page the grid
 * updates in place and the route never changes.
 *
 * Off the Shop page the store has no grid subscribed to it, so `useApplyFilterPath`
 * carries the user back to `/` with the filter applied. The header is on every
 * page; a Categories menu that silently did nothing on /about was the bug.
 */
export function MegaMenu() {
  const open = useUiStore((s) => s.megaMenuOpen);
  const closeMegaMenu = useUiStore((s) => s.closeMegaMenu);
  const setPath = useApplyFilterPath();

  const { data: tree, isLoading } = useTaxonomy();
  const [hoveredType, setHoveredType] = useState(null);

  const activeType = tree?.find((t) => t.slug === hoveredType) ?? tree?.[0] ?? null;

  // The mega menu is anchored to the header rather than portalled, so it does
  // not go through Overlay — it needs its own Escape handler. Every overlay in
  // the app closes on Escape; this one was the exception.
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') closeMegaMenu();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeMegaMenu]);

  function applyFilter(partial, labels) {
    setPath(partial, labels);
    closeMegaMenu();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim sits below the header so the trigger stays visible and clickable. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeMegaMenu}
            className="fixed inset-0 top-[var(--header-h,116px)] z-30 bg-ink-900/30"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 top-full z-40 origin-top"
          >
            <div className="mx-auto max-w-[1400px] px-4 lg:px-6">
              <div className="overflow-hidden rounded-b-[16px] border border-t-0 border-line bg-surface shadow-flyout">
                <div className="grid grid-cols-[minmax(200px,230px)_1fr_minmax(220px,260px)]">
                  {/* ---- device types ---------------------------------- */}
                  <nav aria-label="Device categories" className="border-r border-line bg-surface-2 p-2.5">
                    {isLoading
                      ? Array.from({ length: 6 }).map((_, index) => (
                          <Skeleton key={index} className="mb-1.5 h-10 w-full" />
                        ))
                      : tree?.map((type) => {
                          const Icon = iconFor(type.icon);
                          const isActive = activeType?.slug === type.slug;

                          return (
                            <button
                              key={type.slug}
                              type="button"
                              onMouseEnter={() => setHoveredType(type.slug)}
                              onFocus={() => setHoveredType(type.slug)}
                              onClick={() =>
                                applyFilter({ deviceType: type.slug }, { deviceType: type.name })
                              }
                              className={cn(
                                'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left transition-colors',
                                isActive
                                  ? 'bg-surface text-ink-900 shadow-card'
                                  : 'text-ink-700 hover:bg-surface-3',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                                  isActive ? 'bg-brand-gradient text-white' : 'bg-surface-3 text-ink-500',
                                )}
                                aria-hidden="true"
                              >
                                <Icon className="size-4" strokeWidth={1.75} />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-display text-[13.5px] font-semibold">
                                  {type.name}
                                </span>
                                <span className="tnum block text-[11.5px] text-ink-400">
                                  {formatCount(type.count)} parts
                                </span>
                              </span>

                              <ChevronRight
                                className={cn(
                                  'size-4 shrink-0 transition-colors',
                                  isActive ? 'text-brand' : 'text-ink-300',
                                )}
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                  </nav>

                  {/* ---- brands + series columns ----------------------- */}
                  <div className="scroll-slim max-h-[62vh] overflow-y-auto p-5">
                    {activeType && (
                      <>
                        <div className="mb-4 flex items-baseline justify-between gap-3">
                          <h3 className="text-[15px]">{activeType.name} parts</h3>
                          <button
                            type="button"
                            onClick={() =>
                              applyFilter(
                                { deviceType: activeType.slug },
                                { deviceType: activeType.name },
                              )
                            }
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand transition-colors hover:text-brand-700"
                          >
                            Shop all
                            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-5 xl:grid-cols-3">
                          {activeType.children?.map((brand) => (
                            <div key={brand.slug}>
                              <button
                                type="button"
                                onClick={() =>
                                  applyFilter(
                                    { deviceType: activeType.slug, brand: brand.slug },
                                    { deviceType: activeType.name, brand: brand.name },
                                  )
                                }
                                className="mb-1.5 flex w-full items-center gap-1.5 text-left font-display text-[13px] font-bold text-ink-900 transition-colors hover:text-brand"
                              >
                                {brand.name}
                                <span className="tnum text-[11px] font-medium text-ink-300">
                                  {formatCount(brand.count)}
                                </span>
                              </button>

                              <ul className="space-y-0.5">
                                {brand.children?.slice(0, 6).map((series) => (
                                  <li key={series.slug}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        applyFilter(
                                          {
                                            deviceType: activeType.slug,
                                            brand: brand.slug,
                                            series: series.slug,
                                          },
                                          {
                                            deviceType: activeType.name,
                                            brand: brand.name,
                                            series: series.name,
                                          },
                                        )
                                      }
                                      className="block w-full truncate text-left text-[12.5px] text-ink-500 transition-colors hover:text-brand"
                                    >
                                      {series.name}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ---- promo panel: the one gradient block on the page -- */}
                  <aside className="border-l border-line p-5">
                    <div className="flex h-full flex-col justify-between gap-6 rounded-[12px] bg-brand-gradient p-5 text-white">
                      <div>
                        <p className="eyebrow mb-2 opacity-70">Trade programme</p>
                        <h4 className="text-[18px] leading-tight text-white">
                          Net 30 terms for approved shops
                        </h4>
                        <p className="mt-2 text-[13px] leading-relaxed text-white/75">
                          Approved Cellvix accounts unlock wholesale pricing, credit terms and
                          same-day dispatch from our Canadian warehouse.
                        </p>
                      </div>

                      <div>
                        <ul className="space-y-1.5 text-[12.5px] text-white/85">
                          <li>· 400+ SKUs in stock</li>
                          <li>· Graded pulls, tested before dispatch</li>
                          <li>· 90-day warranty on new and OEM</li>
                        </ul>

                        {/* A route, not a filter — the offers page is its own
                            surface, so this one closes the menu and navigates. */}
                        <Link
                          to="/offers"
                          onClick={closeMegaMenu}
                          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-surface font-display text-[13.5px] font-semibold text-ink-900 transition-colors hover:bg-surface-2"
                        >
                          See running offers
                          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default MegaMenu;
