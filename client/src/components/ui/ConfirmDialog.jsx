import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

/**
 * Confirmation for a destructive admin action.
 *
 * Products deactivate rather than delete, so nothing in the trading screens
 * needs this. Editorial content is the exception — a blog post, an FAQ entry or
 * an offer is referenced by nothing, so a delete really deletes and the admin
 * gets asked once, with the thing's name in the question.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  body,
  confirmLabel = 'Delete',
  loading = false,
  error,
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger">
          <AlertTriangle className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[17px]">{title}</h2>
          {body && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{body}</p>}

          {error && (
            <p className="mt-3 rounded-[10px] bg-danger-50 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" loading={loading} onClick={onConfirm} data-autofocus>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
