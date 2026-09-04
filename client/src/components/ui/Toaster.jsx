import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import cn from '@/lib/cn';
import useToastStore from '@/store/toastStore';

/**
 * Where toasts are drawn. Mounted once, at the app root.
 *
 * Bottom-right rather than top-centre: the admin's own header already owns the
 * top of every screen, and a message that lands over it covers the search and
 * the notification bell at exactly the moment somebody might reach for them.
 *
 * `aria-live="polite"` rather than `assertive` — a confirmation is worth
 * announcing, not worth interrupting whatever a screen reader is mid-sentence
 * on. Errors are the exception and carry `role="alert"` individually.
 */

const TONES = {
  ok: { icon: CheckCircle2, ring: 'border-ok/30', mark: 'text-ok' },
  info: { icon: Info, ring: 'border-info/30', mark: 'text-info' },
  danger: { icon: AlertCircle, ring: 'border-danger/30', mark: 'text-danger' },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      // `pointer-events-none` on the stack, restored per toast: an empty
      // corner of the screen must not swallow clicks meant for the page.
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = TONES[toast.tone] ?? TONES.ok;
          const Icon = tone.icon;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              role={toast.tone === 'danger' ? 'alert' : undefined}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-surface p-3 shadow-pop',
                tone.ring,
              )}
            >
              <Icon
                className={cn('mt-0.5 size-4 shrink-0', tone.mark)}
                strokeWidth={2}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ink-900">{toast.title}</p>
                {toast.body && (
                  <p className="mt-0.5 text-xs leading-snug text-ink-500">{toast.body}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="-m-1 shrink-0 rounded-sm p-1 text-ink-300 transition-colors hover:text-ink-900 active:scale-[0.97]"
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default Toaster;
