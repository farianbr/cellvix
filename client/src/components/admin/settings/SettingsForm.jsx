import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

import Button from '@/components/ui/Button';

/**
 * The chrome every settings form shares (§6.15, phase 11).
 *
 * Six screens save a section of one document, and each needs the same four
 * things: a root error, a save button, a "saved" confirmation, and a way back
 * to the values on the server. Repeating that five times is how the fifth one
 * ends up subtly different from the other four.
 *
 * **The confirmation matters more here than on most forms.** A settings screen
 * has no navigation on success — you save and stay looking at the same fields,
 * so without an explicit acknowledgement there is nothing at all to distinguish
 * a save that worked from a click that missed.
 *
 * `dirty` drives both controls: nothing to save and nothing to discard when the
 * form matches the server, and saying so is clearer than a live button that
 * writes the same values back.
 */
export function SettingsFormActions({ dirty, saving, saved, error, onReset, saveLabel = 'Save changes' }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
      <Button type="submit" loading={saving} disabled={!dirty}>
        {saveLabel}
      </Button>

      {dirty && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-ink-600 transition-colors hover:border-line-strong hover:text-ink-900"
        >
          <RotateCcw className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          Discard changes
        </button>
      )}

      {/* Polite rather than assertive: a save confirmation should not interrupt
          a screen reader mid-sentence, and an error below is announced by the
          form's own alert. */}
      <p aria-live="polite" className="min-w-0">
        {saved && !dirty && !error && (
          <span className="flex items-center gap-1.5 text-sm text-ok">
            <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Saved.
          </span>
        )}
      </p>

      {error && (
        <span
          role="alert"
          className="flex items-start gap-2 text-sm text-danger"
        >
          <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * The notice every screen carrying seeded placeholder values must show (§6b,
 * rule 5).
 *
 * Tax rates, warranty lengths and business details all ship with defaults that
 * are stand-ins for figures the client has not confirmed. An operator who
 * cannot tell a real configured value from a plausible-looking placeholder will
 * eventually invoice against one.
 */
export function PlaceholderNotice({ children }) {
  return (
    <p className="mb-4 flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export default SettingsFormActions;
