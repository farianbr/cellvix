import { Info, TriangleAlert } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * The persistent notice at the top of a channel screen (§6b rule 2).
 *
 * **Not a tooltip and not a disabled-button title.** A screen whose sending is
 * inactive has to say so where the operator is already looking, in the `warn`
 * token, naming both what is inactive and what would switch it on. Somebody
 * typing a real message into this box deserves to know before they press send,
 * not after.
 *
 * The wording comes from the server (`channels[channel].reason`) rather than
 * being written per screen, so connecting a provider updates every surface at
 * once instead of leaving one stale notice behind.
 */
export function ChannelNotice({ status, className }) {
  if (!status) return null;

  // A channel that genuinely delivers says nothing — a banner that is always
  // there stops being read, which is exactly when the real one gets ignored.
  //
  // Keys on `delivers`, not `configured`: since phase 11c an admin can save
  // Twilio credentials without anything being able to send through them yet
  // (§6b U3–U4), and hiding the notice at that point would have the screen
  // imply a delivery it does not do. The notice's text changes instead — the
  // server sends a different `reason` once credentials are present.
  if (status.delivers ?? status.configured) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn-50 px-3.5 py-3',
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 text-sm leading-relaxed text-ink-700">
        <p className="font-medium text-ink-900">{status.label} sending is not connected yet.</p>
        <p className="mt-0.5">{status.reason}</p>
      </div>
    </div>
  );
}

/**
 * The quieter sibling, for a screen that is working as intended but whose
 * behaviour is worth stating once — the Calls screen logs rather than dials,
 * and that is a design decision, not a missing provider.
 */
export function ChannelHint({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3.5 py-3',
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-ink-400" strokeWidth={2} aria-hidden="true" />
      <p className="min-w-0 text-sm leading-relaxed text-ink-600">{children}</p>
    </div>
  );
}

export default ChannelNotice;
