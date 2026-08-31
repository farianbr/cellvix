import { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import cn from '@/lib/cn';

/**
 * The confirmation step in front of an action that cannot be taken back.
 *
 * Three tones, and the tone is chosen by what the action COSTS, not by how the
 * button looks:
 *
 *   `info`    a state change the admin can reverse by doing the opposite
 *             (deactivate, unpublish, mark ready). One click, plain question.
 *   `danger`  a delete, a cancellation, an approval — reversible only by hand,
 *             or not at all. One click, danger button, consequence spelled out.
 *   `critical` money leaves, credit moves, or a record is destroyed for good.
 *             The confirm button stays disabled until the admin types the
 *             record's own identifier.
 *
 * The typed confirmation is the "ask twice" for critical actions, and it is a
 * second ASK rather than a second dialog on purpose: a second dialog trains an
 * admin to click through two buttons in the same spot without reading either,
 * which is worse than one. Typing SR-1042 cannot be done by muscle memory, and
 * it forces the admin to look at WHICH record they are about to destroy — the
 * failure that actually happens is deleting the right kind of thing from the
 * wrong row.
 *
 * The old one-shot API (`title` / `body` / `confirmLabel` / `loading` / `error`)
 * still works unchanged, so existing callers keep behaving exactly as they did.
 */

const TONES = {
  info: {
    icon: Info,
    iconClass: 'bg-surface-3 text-ink-500',
    confirmVariant: 'solid',
  },
  danger: {
    icon: AlertTriangle,
    iconClass: 'bg-danger-50 text-danger',
    confirmVariant: 'danger',
  },
  critical: {
    icon: ShieldAlert,
    iconClass: 'bg-danger-50 text-danger',
    confirmVariant: 'danger',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
  error,
  tone = 'danger',
  /** Critical only: the exact string the admin has to type to arm the button. */
  confirmPhrase,
  /** What that string IS, so the prompt can say "type the order number". */
  confirmPhraseLabel = 'the name above',
  /** A last, plain-language statement of the consequence. */
  consequence,
}) {
  const resolvedTone = confirmPhrase ? 'critical' : tone;
  const { icon: Icon, iconClass, confirmVariant } = TONES[resolvedTone] ?? TONES.danger;

  const inputId = useId();
  const [typed, setTyped] = useState('');

  // Every open starts from an empty field. Without this, closing a dialog and
  // reopening it on a DIFFERENT record would arrive pre-armed with the previous
  // record's phrase still typed in.
  useEffect(() => {
    if (open) setTyped('');
  }, [open, confirmPhrase]);

  // Comparison is trimmed and case-insensitive: the point is to make the admin
  // read and retype the identifier, not to test their shift key.
  const phraseMatches = useMemo(() => {
    if (!confirmPhrase) return true;
    return typed.trim().toLowerCase() === String(confirmPhrase).trim().toLowerCase();
  }, [typed, confirmPhrase]);

  const armed = phraseMatches && !loading;

  function handleSubmit(event) {
    event.preventDefault();
    if (!armed) return;
    onConfirm?.();
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex gap-4">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full',
            iconClass,
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[17px]">{title}</h2>
          {body && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{body}</p>}

          {/* The consequence is separated from the body copy and carries the
              danger tint, because it is the one line an admin skimming the
              dialog has to actually land on. */}
          {consequence && (
            <p
              className={cn(
                'mt-3 rounded-[10px] px-3 py-2 text-[13px] leading-relaxed',
                resolvedTone === 'info'
                  ? 'bg-surface-2 text-ink-700'
                  : 'bg-danger-50 text-danger',
              )}
            >
              {consequence}
            </p>
          )}

          {confirmPhrase && (
            <form onSubmit={handleSubmit} className="mt-4">
              <label htmlFor={inputId} className="block text-[13px] font-medium text-ink-700">
                Type {confirmPhraseLabel} to confirm
              </label>

              <p className="mt-1 text-[12.5px] text-ink-400">
                <span className="tnum font-semibold text-ink-700">{confirmPhrase}</span>
              </p>

              <input
                id={inputId}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                aria-describedby={`${inputId}-state`}
                data-autofocus
                className={cn(
                  // 16px on a phone so mobile Safari does not zoom the page in,
                  // same rule as Input.
                  'mt-2 h-11 w-full rounded-[10px] border bg-surface px-3.5 text-[16px] text-ink-900 sm:text-[14px]',
                  'placeholder:text-ink-300',
                  'transition-[border-color,box-shadow] duration-[120ms]',
                  'focus:outline-none focus:ring-2',
                  typed && !phraseMatches
                    ? 'border-danger focus:border-danger focus:ring-danger/20'
                    : 'border-line focus:border-brand focus:ring-brand/25',
                )}
              />

              {/* Live region rather than an error: nothing is wrong yet, the
                  admin is mid-way through typing. It only speaks once the
                  phrase matches, so a screen reader is not told it is wrong on
                  every keystroke. */}
              <p id={`${inputId}-state`} aria-live="polite" className="sr-only">
                {phraseMatches ? 'Confirmation matches. The action is now enabled.' : ''}
              </p>
            </form>
          )}

          {error && (
            <p className="mt-3 rounded-[10px] bg-danger-50 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              loading={loading}
              disabled={!armed}
              onClick={onConfirm}
              // With a phrase to type, focus belongs in the field. Without one,
              // the confirm button is the only thing to land on.
              {...(confirmPhrase ? {} : { 'data-autofocus': true })}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
