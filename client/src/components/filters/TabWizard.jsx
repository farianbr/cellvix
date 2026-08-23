import { useCallback, useRef, useState } from 'react';
import { ChevronRight, RotateCcw, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import cn from '@/lib/cn';
import { FILTER_LEVELS } from '@/lib/constants';
import { optionsFor } from '@/lib/taxonomy';
import { StepIndicator } from '@/components/ui/StepIndicator';
import WizardOverlay from './WizardOverlay';
import useFilterStore from '@/store/filterStore';
import { useTaxonomy } from '@/hooks/useCatalog';
import Skeleton from '@/components/ui/Skeleton';

const LEVEL_KEYS = FILTER_LEVELS.map((l) => l.key);

/**
 * The guided tab-wizard filter (brief §5.3).
 *
 * Behaviour that matters:
 *  - picking an option closes the overlay, flips that tab to "completed", and
 *    auto-opens the NEXT step — but only when the step was reached in sequence;
 *  - re-opening an already-completed tab is a non-linear edit: it applies the
 *    cascade reset from the store and stops, rather than dragging the user
 *    through every downstream step again;
 *  - every completed tab stays clickable and clearable, forever.
 *
 * Layout is two shapes, not one that squeezes:
 *  - md and up: four equal cards in a grid;
 *  - below md: an expanding sequence. Exactly one step is open — the first one
 *    still to answer — and every other step collapses to its number. Four cards
 *    do not fit on a 375px phone, and the horizontal scroller this replaces put
 *    steps 3 and 4 off the right edge where nobody found them.
 *
 * It writes to the same store the sidebar and mega menu write to — it is a third
 * face on one filter, not a filter of its own.
 */
export function TabWizard() {
  const { data: tree, isLoading } = useTaxonomy();
  const [openLevel, setOpenLevel] = useState(null);

  // True while the user is walking the steps in order. A non-linear edit clears
  // it so we do not chain-open overlays they did not ask for.
  const inSequence = useRef(false);

  const { path, labels, setPathLevel, clearLevel, resetAll } = useFilterStore(
    useShallow((s) => ({
      path: s.path,
      labels: s.labels,
      setPathLevel: s.setPathLevel,
      clearLevel: s.clearLevel,
      resetAll: s.resetAll,
    })),
  );

  const options = openLevel ? optionsFor(tree, path, openLevel) : [];

  const handleSelect = useCallback(
    (option) => {
      const level = openLevel;
      setPathLevel(level, option.slug, option.name);

      const index = LEVEL_KEYS.indexOf(level);
      const nextLevel = LEVEL_KEYS[index + 1];

      if (!inSequence.current || !nextLevel) {
        setOpenLevel(null);
        return;
      }

      // The store has just cascaded, so the next level's options hang off the
      // node we picked.
      const nextOptions = option.children ?? [];
      if (nextOptions.length === 0) {
        setOpenLevel(null);
        return;
      }

      setOpenLevel(nextLevel);
    },
    [openLevel, setPathLevel],
  );

  function openStep(level, index) {
    const isCompleted = Boolean(path[level]);
    const previousLevel = LEVEL_KEYS[index - 1];

    // Cannot pick a series before a brand.
    if (previousLevel && !path[previousLevel]) return;

    // Sequence mode only when stepping into the first unfinished step.
    inSequence.current = !isCompleted;
    setOpenLevel(level);
  }

  /** Completed / active / upcoming, plus whether the level above is unanswered. */
  function stateOf(level, index) {
    const locked = index > 0 && !path[LEVEL_KEYS[index - 1]];
    if (path[level.key]) return { state: 'completed', locked };
    return { state: locked ? 'upcoming' : 'active', locked };
  }

  const anySelected = LEVEL_KEYS.some((level) => path[level]);

  // The one step the mobile layout leaves open: the first that is neither
  // answered nor locked. Null once every level has an answer.
  const expandedKey =
    FILTER_LEVELS.find(
      (level, index) => !path[level.key] && (index === 0 || Boolean(path[LEVEL_KEYS[index - 1]])),
    )?.key ?? null;

  const chosenLabels = FILTER_LEVELS.map((level) => labels[level.key]).filter(Boolean);

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden rounded-[14px] border border-line bg-surface p-3">
        {FILTER_LEVELS.map((level) => (
          <Skeleton key={level.key} className="h-14 flex-1" />
        ))}
      </div>
    );
  }

  return (
    <section
      aria-label="Guided part finder"
      className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="eyebrow text-ink-400">Find your part</p>
        {anySelected && (
          <button
            type="button"
            onClick={() => {
              resetAll();
              inSequence.current = false;
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-400 transition-colors hover:text-brand"
          >
            <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Start over
          </button>
        )}
      </header>

      {/* ---- below md: expanding sequence, never a scroller ---------------- */}
      <div className="p-2.5 md:hidden">
        <ol className="flex items-stretch gap-1.5">
          {FILTER_LEVELS.map((level, index) => {
            const value = path[level.key];
            const { state, locked } = stateOf(level, index);

            if (level.key !== expandedKey) {
              return (
                <li key={level.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => openStep(level.key, index)}
                    disabled={locked}
                    aria-label={
                      value
                        ? `Step ${index + 1}, ${level.label}: ${labels[level.key]}. Change.`
                        : `Step ${index + 1}, ${level.label}${locked ? ', locked' : ''}`
                    }
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full',
                      locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    )}
                  >
                    <StepIndicator state={state} index={index + 1} size="lg" glyph="index" />
                  </button>
                </li>
              );
            }

            return (
              <li key={level.key} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => openStep(level.key, index)}
                  aria-expanded={openLevel === level.key}
                  className="flex h-11 w-full items-center gap-2 rounded-[11px] border border-brand bg-brand-50 px-2.5 text-left"
                >
                  <StepIndicator state="active" index={index + 1} size="sm" glyph="index" />
                  <span className="min-w-0 flex-1">
                    <span className="eyebrow block text-brand-700">{level.label}</span>
                    <span className="mt-0.5 block truncate font-display text-[12.5px] font-semibold text-ink-900">
                      Choose…
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-brand"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ol>

        {/* Every level answered: numbers alone no longer say what was picked, so
            the chosen path gets one truncating line. */}
        {!expandedKey && chosenLabels.length > 0 && (
          <p className="mt-2 truncate rounded-[9px] bg-ok-50/70 px-2.5 py-1.5 text-[12px] font-medium text-ink-700">
            {chosenLabels.join(' · ')}
          </p>
        )}
      </div>

      {/* ---- md and up: four equal cards ----------------------------------- */}
      <ol className="hidden gap-2 p-3 md:grid md:grid-cols-4">
        {FILTER_LEVELS.map((level, index) => {
          const value = path[level.key];
          const label = labels[level.key];
          const { state, locked } = stateOf(level, index);
          const isOpen = openLevel === level.key;

          return (
            <li key={level.key} className="min-w-0">
              <div
                className={cn(
                  'group relative flex h-full items-center gap-3 rounded-[11px] border p-2.5 transition-[border-color,background] duration-[220ms]',
                  value
                    ? 'border-ok/30 bg-ok-50/60'
                    : isOpen
                      ? 'border-brand bg-brand-50'
                      : locked
                        ? 'border-line bg-surface-2'
                        : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <button
                  type="button"
                  onClick={() => openStep(level.key, index)}
                  disabled={locked}
                  aria-expanded={isOpen}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 text-left',
                    locked ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  <StepIndicator state={state} index={index + 1} size="md" />

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'eyebrow block',
                        value ? 'text-ok' : locked ? 'text-ink-300' : 'text-ink-400',
                      )}
                    >
                      {level.label}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate font-display text-[13.5px] font-semibold',
                        value ? 'text-ink-900' : 'text-ink-300',
                      )}
                    >
                      {label ?? (locked ? 'Locked' : 'Choose…')}
                    </span>
                  </span>

                  {!value && !locked && (
                    <ChevronRight
                      className="size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      clearLevel(level.key);
                      inSequence.current = false;
                    }}
                    aria-label={`Clear ${level.label}`}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-surface-3 hover:text-ink-900"
                  >
                    <X className="size-3.5" strokeWidth={2.25} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <WizardOverlay
        open={Boolean(openLevel)}
        onClose={() => {
          setOpenLevel(null);
          inSequence.current = false;
        }}
        level={openLevel}
        title={openLevel ? `Select ${FILTER_LEVELS.find((l) => l.key === openLevel)?.label}` : ''}
        options={options}
        selected={openLevel ? path[openLevel] : null}
        onSelect={handleSelect}
      />
    </section>
  );
}

export default TabWizard;
