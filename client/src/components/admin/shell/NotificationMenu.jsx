import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, BellOff } from 'lucide-react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import { relativeTime } from '@/lib/format';
import { useNotifications, useNotificationActions } from '@/hooks/useAdmin';
import { adminIcon } from './adminIcons';

/**
 * The notification bell and its dropdown (ERP rework §7.3, §6.15, phase 12c).
 *
 * `Clear All`, `N alerts`, then rows of icon + type + one-line detail +
 * relative time, tinted by severity and linking to the entity — the panel §6.15
 * specifies.
 *
 * **The list arrives already filtered and already merged.** The server decides
 * which areas this role may hear about and recomputes the four standing
 * conditions on every read, so there is nothing here that filters, derives or
 * sorts. That is deliberate: a client that re-sorted would eventually disagree
 * with the badge it is sitting next to.
 *
 * **Opening marks read; it does not clear.** Those are different acts —
 * "I have seen this" and "I am done with this" — and collapsing them would mean
 * a glance at the bell silently emptied a queue somebody was working through.
 */

/** Which icon each type gets. Names resolve through the shared `adminIcon` map. */
const TYPE_ICON = {
  new_registration: 'UserPlus',
  new_order: 'Package',
  quote_accepted: 'FileSignature',
  new_rma: 'RotateCcw',
  invoice_overdue: 'FileText',
  low_stock: 'TrendingDown',
  out_of_stock: 'PackageX',
  po_overdue: 'ClipboardList',
};

/**
 * Severity tints (§6.15: `danger` for out of stock, `warn` for low stock).
 *
 * Colour is never the only carrier — every row also states its condition in
 * words, because a tint alone fails both a colour-blind reader and a
 * screen-reader one (Instructions 3.1).
 */
const SEVERITY_CLASS = {
  danger: 'text-danger',
  warn: 'text-warn',
  success: 'text-success',
  info: 'text-info',
};

export function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useOnClickOutside(ref, () => setOpen(false));

  const { data, isLoading } = useNotifications();
  const { markRead, clearAll } = useNotificationActions();

  const entries = data?.entries ?? [];
  const unread = data?.unread ?? 0;

  // Opening marks everything currently visible as read. Fired once per open
  // rather than on every render, and only when there is something to mark —
  // otherwise every poll while the panel sits open would re-issue the write.
  useEffect(() => {
    if (!open || unread === 0) return;
    markRead.mutate(undefined);
    // `markRead` is a fresh object each render, so it stays out of the deps —
    // including it would re-fire the mutation on its own success.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, none unread'
        }
        className="relative flex size-9 items-center justify-center rounded-[9px] text-ink-500 transition-colors hover:bg-surface-2 hover:text-ink-900"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && (
          // The count, not a dot: "3 things want you" and "something wants you"
          // are different messages, and the operator decides whether to stop
          // what they are doing based on which one it is. Past 9 it becomes
          // `9+` rather than widening the badge over the icon.
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-bold leading-[16px] text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          // Right-anchored under the bell on every width. The panel is capped
          // to the viewport rather than a fixed width so it cannot push the
          // page sideways on a 320 screen (Instructions 3.1).
          className="absolute right-0 top-full z-40 mt-1.5 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-[11px] border border-line bg-surface shadow-card"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-[12.5px] font-semibold text-ink-700">
              {entries.length} {entries.length === 1 ? 'alert' : 'alerts'}
            </p>
            <button
              type="button"
              onClick={() => clearAll.mutate()}
              // Nothing to clear is a disabled button rather than one that can
              // only fail — the same rule phase 9's "Send to 0" settled.
              disabled={entries.length === 0 || clearAll.isPending}
              className="text-[12px] font-medium text-ink-400 transition-colors hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear All
            </button>
          </div>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {isLoading && (
              <p className="px-3 py-6 text-center text-[12.5px] text-ink-400">Loading…</p>
            )}

            {!isLoading && entries.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <BellOff className="size-5 text-ink-300" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-[12.5px] text-ink-400">Nothing needs your attention.</p>
              </div>
            )}

            {entries.map((entry) => {
              const Icon = adminIcon(TYPE_ICON[entry.type]) ?? Bell;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (entry.href) navigate(entry.href);
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-2',
                    // An unread row is tinted, not bolded alone: weight shifts
                    // reflow the text and make the list twitch as rows are read.
                    !entry.read && 'bg-surface-2/60',
                  )}
                >
                  <Icon
                    className={cn('mt-px size-4 shrink-0', SEVERITY_CLASS[entry.severity] ?? 'text-ink-400')}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium leading-snug text-ink-900">
                      {entry.title}
                    </span>
                    {entry.detail && (
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-500">
                        {entry.detail}
                      </span>
                    )}
                  </span>

                  <time
                    dateTime={new Date(entry.createdAt).toISOString()}
                    className="shrink-0 pt-px text-[10.5px] text-ink-300"
                  >
                    {relativeTime(entry.createdAt)}
                  </time>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationMenu;
