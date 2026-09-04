import { useMemo, useState } from 'react';
import { componentIconFor, iconFor } from '@/lib/icons';
import { ArrowRight, Check, Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import cn from '@/lib/cn';
import { count as formatCount } from '@/lib/format';

/**
 * The option list a wizard step opens into (brief §5.3).
 *
 * Two shapes, chosen by what the level can honestly show:
 *
 *  - Component types and device types get ICON TILES. A battery, a fan and a
 *    keyboard all look like something, and a buyer scanning twenty-five of
 *    them reads a glyph faster than a word.
 *  - Brands, series and models get DENSE ROWS. There is no honest picture of
 *    "iPhone 15 Series", and the monogram that used to fill that slot was a
 *    placeholder sitting where the tile's most prominent element belongs. In a
 *    row the name leads, the count right-aligns so it can be compared down the
 *    column, and roughly twice as many options fit on one screen.
 *
 * Monograms survive only as the fallback inside a tile whose icon is missing.
 */
function words(name = '') {
  return name
    .replace(/^(Galaxy|Apple|iPhone|iPad) /, '')
    .split(/[\s/]+/)
    .filter(Boolean);
}

/**
 * Two letters for an option with no icon.
 *
 * Initials of the first two words, not the first two characters: "Back Cover
 * Sensor" and "Back Glass" both begin "Ba", and a grid where four tiles read
 * "BA" and two read "CH" is a grid whose monograms identify nothing. "BC" and
 * "BG" tell them apart.
 *
 * Single-word names keep their first two characters, which is all there is.
 */
function monogram(name = '') {
  const parts = words(name);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Monograms for a whole option list, every one distinct.
 *
 * Initials alone are not unique — "Back Cover Sensor" and "Bottom Cover" both
 * give "BC" — and neither is any single fallback: sending the first of those to
 * its own first word's initials gives "BA", which then collides with "Battery".
 * So each name offers candidates in order of preference and takes the first one
 * nobody has claimed, with the plain initials as the last resort.
 *
 * Resolved across the list rather than per card, because whether two letters
 * are ambiguous is a property of the set, not of one name.
 */
function monogramsFor(options) {
  const taken = new Set();
  const out = new Map();

  for (const option of options) {
    const parts = words(option.name);
    const initials = monogram(option.name);
    const first = parts[0] ?? option.name;

    const candidates = [
      initials,
      // first word's first two letters — separates "Back …" from "Bottom …"
      first.slice(0, 2).toUpperCase(),
      // first word's initial + its second letter's neighbour, then three-word
      // initials, then first + last initial
      parts.length > 2 ? (parts[0][0] + parts[2][0]).toUpperCase() : null,
      parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : null,
      first.slice(0, 3).toUpperCase().slice(1),
    ].filter(Boolean);

    const pick = candidates.find((c) => !taken.has(c)) ?? initials;
    taken.add(pick);
    out.set(option.slug, pick);
  }

  return out;
}

/**
 * `selected` is a slug for the single-select steps and an ARRAY of slugs for
 * component type, which is multi-select. Normalising here rather than at the
 * two comparison sites keeps them both reading `isSelected` the same way.
 */
export function WizardOverlay({ open, onClose, onNext, level, label, title, options, selected, onSelect }) {
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(
    () => new Set(Array.isArray(selected) ? selected : selected ? [selected] : []),
    [selected],
  );
  const multi = Array.isArray(selected);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.name.toLowerCase().includes(needle));
  }, [options, query]);

  // A long model list needs a filter; six device types do not.
  const searchable = options.length > 12;

  const monograms = useMemo(() => monogramsFor(options), [options]);

  // Component types are the one level with real icons (see componentIconFor),
  // so they get the tile treatment. Device types already carry a taxonomy icon.
  const iconic = level === 'componentType' || level === 'deviceType';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={`${formatCount(options.length)} options`}
      size="lg"
      align="top"
      bodyClassName="pb-6"
    >
      {searchable && (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${(label ?? level).toLowerCase()}s…`}
          icon={Search}
          containerClassName="mb-4"
          data-autofocus
        />
      )}

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-display text-md font-semibold text-ink-900">
            No {(label ?? level).toLowerCase()} matches “{query}”
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-2 text-sm font-semibold text-brand transition-colors hover:text-brand-700"
          >
            Clear the search
          </button>
        </div>
      ) : iconic ? (
        /* ---- icon tiles -------------------------------------------------
           Every tile is the same height, set by the grid rather than by how
           many lines its name happens to take: `items-stretch` plus a name
           block that reserves two lines. Names of different lengths made a
           ragged grid where the eye read the ragged edge instead of the
           options. */
        <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((option) => {
            const isSelected = selectedSet.has(option.slug);
            const Icon =
              level === 'componentType'
                ? componentIconFor(option.slug)
                : option.icon
                  ? iconFor(option.icon)
                  : null;

            return (
              <button
                key={option.slug}
                type="button"
                onClick={() => onSelect(option)}
                aria-pressed={isSelected}
                className={cn(
                  // The icon sits BESIDE the name rather than above it. Stacked,
                  // a one-line name left a dead band under it in every tile and
                  // only twelve of twenty-five options reached the screen.
                  'group flex h-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-[border-color,background,box-shadow] duration-press',
                  isSelected
                    ? 'border-brand bg-brand-50 shadow-card'
                    : 'border-line bg-surface hover:border-brand/40 hover:bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
                    isSelected
                      ? 'bg-brand text-white'
                      : 'bg-surface-3 text-ink-500 group-hover:bg-brand-50 group-hover:text-brand',
                  )}
                  aria-hidden="true"
                >
                  {Icon ? (
                    <Icon className="size-4" strokeWidth={2} />
                  ) : (
                    <span className="font-display text-xs font-bold">
                      {monograms.get(option.slug)}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'line-clamp-2 block font-display text-sm font-semibold leading-snug',
                      isSelected ? 'text-brand-700' : 'text-ink-900',
                    )}
                  >
                    {option.name}
                  </span>
                  <span className="tnum mt-0.5 block text-2xs text-ink-400">
                    {formatCount(option.count)} parts
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* ---- dense rows --------------------------------------------------
           Brands, series and models have no honest picture, and a monogram in
           a grey square is a placeholder occupying the most prominent slot in
           the tile. These are a list instead: the NAME leads, the count sits
           right-aligned where it can be compared down the column, and twice as
           many fit on a screen. */
        <div className="overflow-hidden rounded-lg border border-line">
          {/* The count column is bare numbers so they compare cleanly down the
              column; this names the unit once instead of repeating "parts" on
              every row. */}
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3.5 py-1.5">
            <span className="eyebrow text-ink-400">{label ?? level}</span>
            <span className="eyebrow text-ink-400">Parts</span>
          </div>

          <ul className="divide-y divide-line">
          {filtered.map((option) => {
            const isSelected = selectedSet.has(option.slug);

            return (
              <li key={option.slug}>
                <button
                  type="button"
                  onClick={() => onSelect(option)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-press',
                    isSelected ? 'bg-brand-50' : 'bg-surface hover:bg-surface-2',
                  )}
                >
                  <span
                    className={cn(
                      'min-w-0 flex-1 font-display text-md font-semibold leading-snug',
                      isSelected ? 'text-brand-700' : 'text-ink-900',
                    )}
                  >
                    {option.name}
                  </span>

                  <span className="tnum shrink-0 text-xs text-ink-400">
                    {formatCount(option.count)}
                  </span>

                  <Check
                    className={cn(
                      'size-4 shrink-0 transition-opacity',
                      isSelected ? 'text-brand opacity-100' : 'opacity-0',
                    )}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
          </ul>
        </div>
      )}

      {/* Multi-select keeps the panel open on every tick, so it needs a way out
          that is not the X in the corner — and a running total, because the
          tiles scroll and the ones already ticked go off screen. Single-select
          steps close themselves and get neither.

          The primary action is NEXT, not Done: this is step 1 of a five-step
          walk, and a button that only dismissed the panel dropped the buyer
          back on the wizard to work out for themselves that Device Type was now
          unlocked. `onNext` advances to step 2, which is the flow the wizard
          exists to run. Disabled until something is ticked, because there is no
          step 2 to open without a component to prune the tree by. */}
      {multi && (
        <div className="sticky bottom-0 -mx-5 mt-4 flex items-center justify-between gap-3 border-t border-line bg-surface px-5 pb-1 pt-3">
          <p className="text-sm text-ink-500">
            {selectedSet.size === 0
              ? 'Pick one or more'
              : `${formatCount(selectedSet.size)} selected`}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-line px-3 font-display text-sm font-semibold text-ink-700 transition-colors hover:border-line-strong hover:bg-surface-2 active:scale-[0.97]"
            >
              Done
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={selectedSet.size === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gradient px-4 font-display text-sm font-semibold text-white transition-[filter,opacity] duration-press hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default WizardOverlay;
