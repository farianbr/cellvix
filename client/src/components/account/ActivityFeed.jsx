import { Link } from 'react-router';
import {
  Ban,
  CreditCard,
  FileText,
  Package,
  Receipt,
  Truck,
  Wallet,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, date } from '@/lib/format';
import { PanelEmpty } from '@/components/ui/Panel';

/**
 * The account's history: orders, invoices, payments and credit movements, in
 * one list, newest first.
 *
 * Assembled server-side by `services/activityService.js`, which also feeds the
 * Activity tab on the admin client profile — so a buyer and their account rep
 * read the same history rather than two views that can disagree.
 *
 * Every row is `{ kind, at, title, detail, amount, reference, href }`. The
 * component's only job is to give each kind an icon and decide how the amount
 * reads: a credit movement is signed, because +$40 and −$40 are different
 * events and a bare "$40" hides which one happened. Everything else is a plain
 * figure — an order total is not a direction.
 */

const ICONS = {
  order: Package,
  'order-status': Truck,
  invoice: FileText,
  receipt: Receipt,
  payment: CreditCard,
  void: Ban,
  credit: Wallet,
};

function ActivityRow({ event }) {
  const Icon = ICONS[event.kind] ?? FileText;
  const signed = event.kind === 'credit';
  const negative = signed && event.amount < 0;

  const body = (
    <>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          event.kind === 'void' ? 'bg-danger-50 text-danger' : 'bg-surface-2 text-ink-400',
        )}
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-900">{event.title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-400">
          {date(event.at)}
          {event.detail && ` · ${event.detail}`}
        </span>
      </span>

      {event.amount != null && (
        <span
          className={cn(
            'tnum shrink-0 text-sm font-semibold',
            negative ? 'text-ink-400' : signed ? 'text-ok' : 'text-ink-900',
          )}
        >
          {signed && (negative ? '−' : '+')}
          {money(Math.abs(event.amount))}
        </span>
      )}
    </>
  );

  const shared = 'flex w-full items-center gap-3 px-4 py-2.5 text-left sm:px-5';

  // Not every event has somewhere to go — a status change on an order does, a
  // credit adjustment does not always. A row without a destination stays a
  // plain row rather than becoming a link to nowhere.
  return event.href ? (
    <li>
      <Link to={event.href} className={cn(shared, 'transition-colors hover:bg-surface-2')}>
        {body}
      </Link>
    </li>
  ) : (
    <li className={shared}>{body}</li>
  );
}

export function ActivityFeed({ events, limit, emptyBody }) {
  const rows = limit ? events.slice(0, limit) : events;

  if (rows.length === 0) {
    return (
      <PanelEmpty
        icon={FileText}
        title="Nothing here yet"
        body={emptyBody ?? 'Orders, invoices and credit movements will appear here as they happen.'}
      />
    );
  }

  return <ul className="divide-y divide-line">{rows.map((event, index) => (
    // Events are assembled from three collections and a payment row carries no
    // id of its own, so the index is part of the key. The list is
    // server-ordered and never reordered or filtered in place, which is the
    // condition that makes an index key safe.
    <ActivityRow key={`${event.kind}-${event.reference ?? index}-${index}`} event={event} />
  ))}</ul>;
}

export default ActivityFeed;
