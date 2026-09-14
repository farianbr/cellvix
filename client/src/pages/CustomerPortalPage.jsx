import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  FileSignature,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Receipt,
  StickyNote,
  Wallet,
  Wrench,
} from 'lucide-react';

import api from '@/lib/api';
import cn from '@/lib/cn';
import { money, date, relativeTime } from '@/lib/format';
import { TICKET_STATUS_LABELS } from '@shared/schemas/admin';
import Badge from '@/components/ui/Badge';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import TabRow from '@/components/ui/TabRow';

/**
 * The customer's own read-only page (§6.13a).
 *
 * **This is the screen a service business's customer gets instead of a
 * storefront.** A repair shop has no catalogue to sign into and its customers
 * mostly have no account at all - somebody left a phone at a counter and wants
 * to know whether it is ready. The link they were sent is the credential, and
 * everything here is read-only: there is no form, no action and nothing that
 * writes, which is what makes a link with no password a defensible thing to
 * hand out.
 *
 * **Outside `RootLayout` on purpose**, like the unsubscribe page and for the
 * same reason. The shop header, the mega menu and the footer all belong to a
 * storefront this customer's business may not even have, and wrapping a repair
 * customer in a parts catalogue's chrome would be reading the moment badly.
 *
 * The server decides what is here. A product business's customer sees no
 * Tickets tab because the feature registry says so, not because this file
 * guesses from the shape of the data - which is what keeps the portal and the
 * panel telling the same story about what a business does.
 */

const TICKET_TONES = {
  diagnosis: 'info',
  accepted: 'info',
  waiting_for_parts: 'warn',
  ready_to_repair: 'info',
  processing: 'warn',
  retention_policy: 'neutral',
  ready_to_pickup: 'ok',
  completed: 'ok',
  cancelled: 'danger',
};

const INVOICE_TONES = { unpaid: 'warn', partial: 'info', paid: 'ok', overdue: 'danger' };

const QUOTE_TONES = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'ok',
  expired: 'neutral',
  converted: 'ok',
  rejected: 'danger',
};

/**
 * Channel icons for the conversation list.
 *
 * `note` is here because a note IS a conversation - something said across a
 * counter, recorded on the same list as the calls and emails around it. What
 * never appears is an internal note: that is a different collection, written
 * for staff, and the server does not send it.
 */
const CHANNEL_META = {
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: MessageSquare },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  call: { label: 'Call', icon: Phone },
  note: { label: 'Note', icon: StickyNote },
};

/** One figure on the summary strip. Plain by design - eight coloured tiles shout. */
function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <dt className="text-xs font-medium text-ink-400">{label}</dt>
      <dd className="tnum mt-0.5 text-lg font-semibold text-ink-900">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/**
 * A row in one of the lists.
 *
 * Not a link: there is nothing deeper to open. A portal that hinted at pages it
 * does not have would be worse than one that plainly does not have them.
 */
function Row({ title, meta, badge, amount }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{title}</p>
        {meta && <p className="truncate text-xs text-ink-400">{meta}</p>}
      </div>
      {badge}
      {amount != null && (
        <span className="tnum shrink-0 text-sm font-semibold text-ink-900">{money(amount)}</span>
      )}
    </li>
  );
}

function List({ rows, empty, children }) {
  if (rows.length === 0) return empty;
  return <ul className="divide-y divide-line">{rows.map(children)}</ul>;
}

export default function CustomerPortalPage() {
  const { business, token } = useParams();
  const [tab, setTab] = useState('overview');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portal', business, token],
    queryFn: () => api.get(`/portal/${business}/${token}`),
    // A read-only page nobody is editing behind: one fetch on open is enough,
    // and refetching on every window focus would re-run it all afternoon on a
    // tab somebody left open at a counter.
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-72" />
        <Skeleton className="mt-6 h-40 w-full" />
      </main>
    );
  }

  /**
   * One message for every failure.
   *
   * A bad token, a revoked one and a well-formed one naming nobody all answer
   * 404 on the server, and they must read identically here too - a page that
   * distinguished "expired" from "never existed" would confirm which links had
   * once been real.
   */
  if (isError || !data) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-2">
          <Globe className="size-5 text-ink-400" strokeWidth={2.25} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-ink-900">This link does not work</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          It may have been replaced with a newer one, or copied incompletely. Ask the shop to send
          you a fresh link.
        </p>
      </main>
    );
  }

  const { customer, business: shop, features, summary, tickets, invoices, quotes, webQuotes, payments, messages } = data;

  /**
   * The tabs this customer's business actually has.
   *
   * Built from the server's answer rather than from whether a list came back
   * empty: a repair shop with no tickets yet still has Tickets, and a
   * wholesaler with none never should.
   */
  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    features.tickets && { key: 'tickets', label: 'Tickets', icon: Wrench },
    { key: 'invoices', label: 'Invoices', icon: Receipt },
    features.quotes && { key: 'quotes', label: 'Quotes', icon: FileSignature },
    features.webQuotes && { key: 'web-quotes', label: 'Enquiries', icon: Globe },
    { key: 'payments', label: 'Payments', icon: Wallet },
    { key: 'activity', label: 'Activity', icon: MessageCircle },
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {/* The shop first, the customer second. Somebody opening a link from a
          text message needs to know who it is from before anything else. */}
      <header>
        <p className="text-sm font-semibold text-brand">{shop?.name ?? 'Your account'}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          {customer.name}
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          {customer.businessName && <span>{customer.businessName} · </span>}
          Customer since {date(customer.since)}
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {features.tickets && (
          <Stat
            label="Open jobs"
            value={summary.openTickets}
            hint={summary.tickets > 0 ? `${summary.tickets} in total` : undefined}
          />
        )}
        <Stat label="Invoices" value={summary.invoices} />
        <Stat
          label="Outstanding"
          value={money(summary.outstanding)}
          hint={summary.outstanding === 0 ? 'Nothing owed' : undefined}
        />
        {features.storeCredit && (
          <Stat label="Store credit" value={money(customer.storeCredit)} hint="Held on account" />
        )}
      </dl>

      <TabRow
        tabs={tabs}
        value={tab}
        onChange={setTab}
        label="Your record"
        panel
        className="mb-4 mt-6"
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          {/**
           * Open jobs lead, because that is the question the link was opened to
           * answer. A completed repair is history; an open one is why somebody
           * is looking.
           */}
          {features.tickets && (
            <Panel title="Open jobs" description="What we are working on for you right now.">
              <List
                rows={tickets.filter(
                  (ticket) => ticket.status !== 'completed' && ticket.status !== 'cancelled',
                )}
                empty={
                  <PanelEmpty
                    icon={Wrench}
                    title="Nothing open"
                    body="No job is in progress at the moment."
                  />
                }
              >
                {(ticket) => (
                  <Row
                    key={ticket.number}
                    title={ticket.device ?? ticket.number}
                    meta={ticket.issue}
                    badge={
                      <Badge tone={TICKET_TONES[ticket.status] ?? 'neutral'} size="sm">
                        {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                      </Badge>
                    }
                  />
                )}
              </List>
            </Panel>
          )}

          {summary.outstanding > 0 && (
            <Panel title="What you owe" description="Invoices that are still open.">
              <List rows={invoices.filter((invoice) => invoice.balance > 0)} empty={null}>
                {(invoice) => (
                  <Row
                    key={invoice.number}
                    title={invoice.number}
                    meta={invoice.dueDate ? `Due ${date(invoice.dueDate)}` : date(invoice.issuedAt)}
                    badge={
                      <Badge tone={INVOICE_TONES[invoice.status] ?? 'neutral'} size="sm">
                        {invoice.status}
                      </Badge>
                    }
                    amount={invoice.balance}
                  />
                )}
              </List>
            </Panel>
          )}

          {/* How to reach a human. The portal answers questions; it cannot
              answer a new one, so it says where to ask. */}
          {shop && (shop.phone || shop.email || shop.address?.city) && (
            <Panel title={`Contact ${shop.name}`}>
              <dl className="space-y-2.5 text-sm">
                {shop.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="size-4 shrink-0 text-ink-400" strokeWidth={2.25} aria-hidden="true" />
                    <a href={`tel:${shop.phone}`} className="font-semibold text-brand hover:text-brand-700">
                      {shop.phone}
                    </a>
                  </div>
                )}
                {shop.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="size-4 shrink-0 text-ink-400" strokeWidth={2.25} aria-hidden="true" />
                    <a href={`mailto:${shop.email}`} className="break-all font-semibold text-brand hover:text-brand-700">
                      {shop.email}
                    </a>
                  </div>
                )}
                {shop.address?.city && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" strokeWidth={2.25} aria-hidden="true" />
                    <span className="text-ink-700">
                      {[shop.address.street, shop.address.city, shop.address.region, shop.address.postal]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </dl>
            </Panel>
          )}
        </div>
      )}

      {tab === 'tickets' && (
        <Panel title="Your jobs" description="Everything we have worked on, newest first.">
          <List
            rows={tickets}
            empty={<PanelEmpty icon={Wrench} title="No jobs yet" body="Nothing has been booked in." />}
          >
            {(ticket) => (
              <li key={ticket.number} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {ticket.device ?? ticket.number}
                    </p>
                    <p className="truncate text-xs text-ink-400">
                      <span className="font-mono">{ticket.number}</span> · {date(ticket.createdAt)}
                    </p>
                  </div>
                  <Badge tone={TICKET_TONES[ticket.status] ?? 'neutral'} size="sm">
                    {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                  </Badge>
                  {ticket.total > 0 && (
                    <span className="tnum shrink-0 text-sm font-semibold text-ink-900">
                      {money(ticket.total)}
                    </span>
                  )}
                </div>
                {ticket.issue && <p className="mt-1.5 text-sm text-ink-500">{ticket.issue}</p>}
                {/* The note written FOR the customer. The technician's own
                    notes are a different field and never leave the panel. */}
                {ticket.notes && (
                  <p className="mt-1.5 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-700">
                    {ticket.notes}
                  </p>
                )}
              </li>
            )}
          </List>
        </Panel>
      )}

      {tab === 'invoices' && (
        <Panel title="Invoices" description="What has been billed, and what is still open.">
          <List
            rows={invoices}
            empty={<PanelEmpty icon={Receipt} title="No invoices" body="Nothing has been billed yet." />}
          >
            {(invoice) => (
              <Row
                key={invoice.number}
                title={invoice.number}
                meta={
                  invoice.balance > 0
                    ? `${money(invoice.balance)} still owed${invoice.dueDate ? ` · due ${date(invoice.dueDate)}` : ''}`
                    : date(invoice.issuedAt)
                }
                badge={
                  <Badge tone={INVOICE_TONES[invoice.status] ?? 'neutral'} size="sm">
                    {invoice.status}
                  </Badge>
                }
                amount={invoice.amount}
              />
            )}
          </List>
        </Panel>
      )}

      {tab === 'quotes' && (
        <Panel title="Quotes" description="Prices we have offered you.">
          <List
            rows={quotes}
            empty={<PanelEmpty icon={FileSignature} title="No quotes" body="Nothing has been quoted yet." />}
          >
            {(quote) => (
              <Row
                key={quote.number}
                title={quote.number}
                meta={quote.validUntil ? `Valid until ${date(quote.validUntil)}` : date(quote.createdAt)}
                badge={
                  <Badge tone={QUOTE_TONES[quote.status] ?? 'neutral'} size="sm">
                    {quote.status}
                  </Badge>
                }
                amount={quote.total}
              />
            )}
          </List>
        </Panel>
      )}

      {tab === 'web-quotes' && (
        <Panel title="Your enquiries" description="Requests you sent through the website.">
          <List
            rows={webQuotes}
            empty={<PanelEmpty icon={Globe} title="No enquiries" body="You have not sent one yet." />}
          >
            {(quote) => (
              <Row
                key={quote.number}
                title={quote.number}
                meta={date(quote.createdAt)}
                badge={
                  <Badge tone={QUOTE_TONES[quote.status] ?? 'neutral'} size="sm">
                    {quote.status}
                  </Badge>
                }
                amount={quote.total > 0 ? quote.total : undefined}
              />
            )}
          </List>
        </Panel>
      )}

      {tab === 'payments' && (
        <Panel title="Payments" description="What we have received from you, newest first.">
          <List
            rows={payments}
            empty={<PanelEmpty icon={Wallet} title="No payments" body="Nothing has been received yet." />}
          >
            {(payment, index) => (
              <Row
                key={`${payment.invoice}-${payment.at}-${index}`}
                title={payment.method ?? 'Payment'}
                meta={`${date(payment.at)} · against ${payment.invoice}`}
                badge={
                  payment.reversedAt ? (
                    <Badge tone="warn" size="sm">
                      Reversed
                    </Badge>
                  ) : null
                }
                amount={payment.amount}
              />
            )}
          </List>
        </Panel>
      )}

      {tab === 'activity' && (
        <Panel title="Messages" description="Calls, messages and notes about your account.">
          {messages.length === 0 ? (
            <PanelEmpty icon={MessageCircle} title="Nothing yet" body="No messages on this account." />
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => {
                const meta = CHANNEL_META[message.channel] ?? CHANNEL_META.note;
                const Icon = meta.icon;
                return (
                  <li key={message.id} className="flex gap-2.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-500">
                      <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-ink-900">{meta.label}</span>
                        <span className="text-xs text-ink-300">{relativeTime(message.at)}</span>
                      </div>
                      {message.subject && (
                        <p className="text-sm font-medium text-ink-700">{message.subject}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm text-ink-500">
                        {message.body}
                      </p>
                      {message.staffName && (
                        <p className="text-xs text-ink-300">by {message.staffName}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      <p className={cn('mt-8 text-center text-xs leading-relaxed text-ink-400')}>
        This page is read-only and updates as your account does. Keep the link private - anyone
        holding it can see this page.
      </p>
    </main>
  );
}
