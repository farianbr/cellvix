import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';

/**
 * A listbox we draw ourselves, for the one place a native `<select>` cannot be
 * trusted: a toolbar control sitting against the right edge of a narrow screen.
 *
 * `Select` is still the right choice inside forms — it gets the platform picker
 * on a phone, which matters for the sub-2-minute checkout. But the browser sizes
 * and places a native popup itself, and next to the viewport edge it renders the
 * option list wider than its trigger and lets it run off the screen. This panel
 * is anchored to the trigger, clamped to the viewport, and cannot.
 *
 * Keyboard contract is the ARIA listbox one: Enter/Space/Arrow opens, Arrow keys
 * and Home/End move the active option, Enter selects, Escape closes and returns
 * focus to the trigger.
 */
const SIZES = {
  sm: 'h-9 pl-3 pr-2.5 text-[13px] rounded-[10px]',
  md: 'h-11 pl-3.5 pr-3 text-[14px] rounded-[10px]',
};

export function SelectMenu({
  options = [],
  value,
  onChange,
  label,
  size = 'sm',
  align = 'right',
  className,
  buttonClassName,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  const listId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  useOnClickOutside(containerRef, () => setOpen(false), open);

  // Opening lands the highlight on the current value, not the top of the list.
  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    listRef.current?.focus();
  }, [open, selectedIndex]);

  function close({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
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
        close({ refocus: false });
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

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-1.5 border border-line bg-surface text-ink-900',
          'transition-[border-color,box-shadow] duration-[120ms]',
          'hover:border-line-strong',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
          SIZES[size],
          open && 'border-brand ring-2 ring-brand/25',
          buttonClassName,
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-ink-400 transition-transform duration-[160ms]',
            open && 'rotate-180',
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            onKeyDown={onListKeyDown}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              // w-max sizes to the longest label; max-w clamps that to whatever
              // room is left on screen, so the panel can never run off the edge.
              'scroll-slim absolute top-[calc(100%+6px)] z-40 max-h-[min(60vh,320px)] w-max min-w-full',
              'max-w-[calc(100vw-24px)] overflow-y-auto overflow-x-hidden rounded-[12px] border border-line',
              'bg-surface p-1 shadow-flyout focus:outline-none',
              align === 'right' ? 'right-0' : 'left-0',
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
                    {isSelected && (
                      <Check className="size-3.5 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SelectMenu;
