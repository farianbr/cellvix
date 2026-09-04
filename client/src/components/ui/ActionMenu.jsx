import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import useAnchoredPosition from '@/hooks/useAnchoredPosition';

/**
 * The `···` overflow menu, as its own component.
 *
 * It began inside `DataTable` as the row-actions menu and stayed there, so a
 * screen that wanted the same control — a record's own page, where the same
 * secondary actions belong — had no way to reach it. Lifting it here keeps one
 * implementation of "the actions that did not earn a button", which matters
 * because it is the thing an operator learns once and expects everywhere.
 *
 * `items` are `{ key, label, icon, tone, disabled, hidden, onSelect }`. Both
 * `disabled` and `hidden` accept a value **or** a predicate, so `DataTable` can
 * keep passing row-aware functions while a page passes plain booleans.
 *
 * ```jsx
 * <ActionMenu items={[{ key: 'void', label: 'Void', icon: Undo2, onSelect: … }]} />
 * ```
 */
export function ActionMenu({ items = [], context, label = 'More actions', trigger, align = 'right', className }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  /**
   * Anchored and **portalled**, exactly as `SelectMenu` is.
   *
   * Absolutely positioned inside its own cell, this menu was clipped by every
   * ancestor that hides its overflow — which on a table row is the horizontal
   * scroll wrapper the table is always wrapped in, so the last rows' menus
   * disappeared under the panel edge. A portal takes it out of that box, and
   * fixed coordinates from the trigger keep it attached to the button.
   */
  const [panelStyle] = useAnchoredPosition(buttonRef, open, {
    align,
    maxHeight: 320,
    matchWidth: false,
    padding: 8,
  });

  // The panel lives in a portal, so it is not inside `containerRef` — both refs
  // have to count as "inside" or the first click on an item closes the menu.
  useOnClickOutside([containerRef, panelRef], () => setOpen(false), open);

  // A predicate or a plain value — see the note above.
  const resolve = (value) => (typeof value === 'function' ? value(context) : value);

  const usable = items.filter((item) => !resolve(item.hidden));
  if (!usable.length) return null;

  const panel = open && (
    <div
      ref={panelRef}
      role="menu"
      style={panelStyle}
      className="z-[70] w-[200px] max-w-[calc(100vw-24px)] overflow-hidden rounded-md border border-line bg-surface py-1 shadow-pop"
    >
      {usable.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key ?? item.label}
            type="button"
            role="menuitem"
            disabled={resolve(item.disabled)}
            onClick={() => {
              setOpen(false);
              item.onSelect?.(context);
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-40',
              item.tone === 'danger'
                ? 'text-danger hover:bg-danger-50'
                : 'text-ink-700 hover:bg-surface-2 hover:text-ink-900',
            )}
          >
            {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
            {typeof item.label === 'function' ? item.label(context) : item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={cn('relative flex', align === 'right' ? 'justify-end' : 'justify-start', className)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          trigger
            ? 'active:scale-[0.97]'
            : 'flex size-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900 active:scale-[0.97]'
        }
      >
        {trigger ?? <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden="true" />}
      </button>

      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  );
}

export default ActionMenu;
