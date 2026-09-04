import { create } from 'zustand';

/**
 * Transient confirmations, in one place.
 *
 * **Why a store and not a local `useState` notice.** Every screen that wrote
 * its own inline "sent" banner had to find somewhere to put it, keep it from
 * shifting the layout underneath, and remember to clear it — and the result was
 * a confirmation that looked different on every page and pushed content down
 * the moment it appeared. A toast is the same message with none of that: it
 * announces, it is not part of the layout, and it goes away on its own.
 *
 * **A toast is for something that already happened.** It never asks a question
 * and never carries the only copy of information the operator needs — anything
 * they must act on belongs on the page, not in a message that disappears after
 * four seconds. A failure that needs a decision is a dialog; a failure that is
 * merely news is a toast with `tone: 'danger'`, which does not auto-dismiss.
 */

/** How long a toast stays before it removes itself. Errors stay put. */
const DISMISS_AFTER = 4200;

let nextId = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],

  /**
   * @param {{ title: string, body?: string, tone?: 'ok' | 'danger' | 'info' }} toast
   * @returns {number} the toast's id, so a caller can dismiss it early
   */
  push(toast) {
    const id = (nextId += 1);
    const tone = toast.tone ?? 'ok';

    set((state) => ({ toasts: [...state.toasts, { ...toast, tone, id }] }));

    // A failure stays until it is read and dismissed: it is the one kind of
    // message where missing it means acting on something that did not happen.
    if (tone !== 'danger') {
      setTimeout(() => get().dismiss(id), DISMISS_AFTER);
    }

    return id;
  },

  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

/**
 * The calling convention, so screens do not reach into the store shape.
 *
 * ```js
 * toast.ok('Statement sent', 'buyer@cellvix.ca has it.');
 * toast.error('Nothing was sent', 'Check the mail settings.');
 * ```
 */
export const toast = {
  ok: (title, body) => useToastStore.getState().push({ title, body, tone: 'ok' }),
  info: (title, body) => useToastStore.getState().push({ title, body, tone: 'info' }),
  error: (title, body) => useToastStore.getState().push({ title, body, tone: 'danger' }),
};

export default useToastStore;
