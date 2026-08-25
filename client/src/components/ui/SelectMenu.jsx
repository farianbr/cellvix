import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import useAnchoredPosition from '@/hooks/useAnchoredPosition';

/**
 * The listbox we draw ourselves. **This is the site's dropdown** — a native
 * `<select>` is not used anywhere a Cellvix control is expected to look like a
 * Cellvix control.
 *
 * Why it exists: the browser sizes and places a native popup itself. Against
 * the right edge of a narrow screen it renders the option list wider than its
 * trigger and lets it run off; inside a modal it is styled by the platform and
 * matches nothing around it. This panel is anchored to the trigger, clamped to
 * the viewport, and rendered in a **portal** so no scrolling or overflow-hidden
 * ancestor — a `Panel`, a modal body, a table wrapper — can clip it.
 *
 * Two shapes, one component:
 *   - **toolbar control** — `srLabel` only, no visible label. Filters, sorts.
 *   - **form field** — `label`, and `hint` / `error` under it, matching `Input`.
 *
 * Keyboard contract is the ARIA listbox one: Enter/Space/Arrow opens, Arrow keys
 * and Home/End move the active option, Enter selects, Escape closes and returns
 * focus to the trigger.
 *
 * For a field inside a react-hook-form form, use `SelectField` — it wires this
 * to a `Controller` rather than to `register`, which a non-native control cannot
 * accept.
 */
const SIZES = {
  sm: 'h-9 pl-3 pr-2.5 text-[13px] rounded-[10px]',
  md: 'h-11 pl-3.5 pr-3 text-[14px] rounded-[10px]',
};

/** Height of one option row — px-2.5 py-2 around a 13px line. */
const OPTION_H = 33;

/**
 * An option's tally, if it carries one. Rendered as its own muted column rather
 * than baked into the label, so a long label truncates without taking the
 * number with it.
 */
function Count({ value, muted }) {
  if (value === undefined || value === null) return null;
  return (
    <span className={cn('tnum shrink-0 text-[11.5px]', muted ? 'text-ink-300' : 'text-brand-700')}>
      {value}
    </span>
  );
}

export function SelectMenu({
  options = [],
  value,
  onChange,
  onBlur,
  /** Visible field label, as on `Input`. Omit for a toolbar control. */
  label,
  /** Accessible name when there is no visible label. */
  srLabel,
  hint,
  error,
  placeholder,
  disabled = false,
  size = 'sm',
  align = 'right',
  name,
  id: idProp,
  className,
  containerClassName,
  buttonClassName,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  const generatedId = useId();
  const id = idProp || generatedId;
  const listId = `${id}-listbox`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const selectedIndex = options.findIndex((option) => option.value === value);
  // With a placeholder an unmatched value shows the placeholder; without one it
  // falls back to the first option, which is what a filter control wants.
  const selected = selectedIndex >= 0 ? options[selectedIndex] : placeholder ? null : options[0];

  const panelStyle = useAnchoredPosition(buttonRef, open, {
    align,
    maxHeight: OPTION_H * 9 + 8,
    // Snapped to whole options: a list cut mid-row reads as clipped rather than
    // as scrollable.
    rowHeight: OPTION_H,
    padding: 8,
    matchWidth: true,
  });

  // The list is portalled, so it is not inside `containerRef` — both refs have
  // to count as "inside" or the first click on an option closes the menu.
  useOnClickOutside([containerRef, listRef], () => setOpen(false), open);

  // Opening lands the highlight on the current value, not the top of the list.
  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    listRef.current?.focus();
  }, [open, selectedIndex]);

  function close({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
    onBlur?.();
  }

  function commit(index) {
    const option = options[index];
    if (!option) return;
    onChange?.(option.value);
    close();
  }

  function onListKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        // Focus goes back to the trigger, not to nothing: the list is portalled
        // out of the DOM it belongs to, so leaving focus on <body> would step a
        // Tab out of the modal or form the control lives in. The default Tab
        // then moves on from the trigger, which is where the reader expects to
        // continue from.
        close();
        break;
      default:
        break;
    }
  }

  function onButtonKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  }

  const panel = (
    <AnimatePresence>
      {open && panelStyle && (
        <motion.ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label || srLabel}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          onKeyDown={onListKeyDown}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={panelStyle}
          className={cn(
            // w-max sizes to the longest label; the style's maxWidth clamps that
            // to the room actually left on screen, so it can never run off.
            'scroll-slim z-60 w-max overflow-y-auto overflow-x-hidden rounded-[12px]',
            'border border-line bg-surface p-1 shadow-flyout focus:outline-none',
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;

            return (
              <li key={option.value} role="none">
                <button
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onClick={() => commit(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] transition-colors',
                    index === activeIndex ? 'bg-surface-2' : 'bg-transparent',
                    isSelected ? 'font-semibold text-brand-700' : 'text-ink-700',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Count value={option.count} muted={!isSelected} />
                  {/* The tick always holds its column — dropping it from the
                      unselected rows pulled their counts 22px right of the
                      selected one's and made the list read as ragged. */}
                  <Check
                    className={cn('size-3.5 shrink-0 text-brand', !isSelected && 'invisible')}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </motion.ul>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn(label && 'w-full', containerClassName, className)}>
      {label && (
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="mb-1.5 block text-[13px] font-medium text-ink-700"
          onClick={(event) => {
            // A <label> cannot forward a click to a <button>, so do it here.
            event.preventDefault();
            buttonRef.current?.focus();
          }}
        >
          {label}
        </label>
      )}

      <div ref={containerRef} className="relative">
        <button
          ref={buttonRef}
          id={id}
          name={name}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onButtonKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          // <label for> only names a labelable element, and a button is not
          // one — without this the field's accessible name would be whichever
          // option happens to be selected. Naming it from the label AND the
          // button announces "Province, Ontario", which is both halves.
          aria-labelledby={label ? `${id}-label ${id}` : undefined}
          aria-label={label ? undefined : srLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'flex w-full min-w-0 cursor-pointer items-center gap-1.5 border bg-surface text-ink-900',
            'transition-[border-color,box-shadow] duration-[120ms]',
            'hover:border-line-strong',
            'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-400',
            SIZES[size],
            error ? 'border-danger' : 'border-line',
            open && !error && 'border-brand ring-2 ring-brand/25',
            buttonClassName,
          )}
        >
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-left',
              !selected && 'text-ink-300',
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <Count value={selected?.count} muted />
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-ink-400 transition-transform duration-[160ms]',
              open && 'rotate-180',
            )}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-ink-400">
          {hint}
        </p>
      ) : null}

      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  );
}

export default SelectMenu;
