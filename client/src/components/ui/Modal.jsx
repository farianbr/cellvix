import { useId } from 'react';
import { X } from 'lucide-react';
import Overlay from './Overlay';
import cn from '@/lib/cn';
import { dialog, pressable } from '@/lib/motion';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[min(1100px,95vw)]',
};

/** Centred dialog. Use Drawer for edge-anchored panels. */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  className,
  bodyClassName,
  align = 'center',
  showClose = true,
  closeOnScrimClick = true,
}) {
  const titleId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      align={align}
      labelledBy={title ? titleId : undefined}
      label={title ? undefined : 'Dialog'}
      closeOnScrimClick={closeOnScrimClick}
      panelMotion={dialog}
      panelClassName={cn('w-full', SIZES[size], className)}
    >
      <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-flyout">
        {/* Without a title there is nothing to put in a header bar, so the close
            button floats over the content instead of reserving a whole row. */}
        {!title && showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={cn(pressable, 'absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-md bg-surface/80 text-ink-400 backdrop-blur-sm hover:bg-surface-3 hover:text-ink-900')}
          >
            <X className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}

        {title && (
          <header className="flex shrink-0 items-start gap-4 border-b border-line px-5 py-4 md:px-6">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-lg md:text-xl">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-md text-ink-500">{description}</p>}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className={cn(pressable, '-mr-1.5 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-3 hover:text-ink-900')}
              >
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            )}
          </header>
        )}

        <div className={cn('scroll-slim flex-1 overflow-y-auto px-5 py-5 md:px-6', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-line bg-surface-2 px-5 py-4 md:px-6">
            {footer}
          </footer>
        )}
      </div>
    </Overlay>
  );
}

export default Modal;
