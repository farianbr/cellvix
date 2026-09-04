import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileSignature,
  FileText,
  Globe,
  Gift,
  History,
  Mail,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Undo2,
  UserRound,
  Wallet,
  WalletCards,
  Wrench,
  XCircle,
} from 'lucide-react';
import cn from '@/lib/cn';
import { apiUrl } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { money, date, dateTime, relativeTime, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ApproveClientForm from '@/components/admin/ApproveClientForm';
import { RejectForm } from '@/pages/admin/AdminApprovalsPage';
import Skeleton from '@/components/ui/Skeleton';
import { OrderStatusBadge, InvoiceStatusBadge } from '@/components/account/OrderStatusBadge';
import DataTable from '@/components/admin/DataTable';
import Pagination from '@/components/ui/Pagination';
import {
  CreditForm,
  CreditRepaymentForm,
  StoreCreditPanel,
  STATUS_TONES,
} from '@/components/admin/ClientDetail';
import {
  ConsentPanel,
  TierPanel,
  NotesPanel,
  ConversationsPanel,
  ReferralPanel,
} from '@/components/admin/CustomerCrm';
import { MEMBERSHIP_TIERS } from '@shared/schemas/admin';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import { pressable } from '@/lib/motion';
import {
  useAdminUser,
  useAdminUserActivity,
  useAdminMutations,
  useMarketingMessages,
  useAdminSettings,
  useAdminTickets,
  useAdminQuotes,
  useAdminWebQuotes,
} from '@/hooks/useAdmin';


/**
 * The tab lives in the URL so a colleague can be sent straight to the credit
 * ledger rather than "open the client, then click Credit" (§4, one canonical
 * URL per screen).
 */
const TABS = [
  // Overview is a **summary of every other tab**, not a tab of its own content:
  // each panel on it shows the first few rows and links to the tab that owns
  // them. An operator opening a customer wants the shape of the relationship
  // before they want any one part of it.
  { key: 'overview', label: 'Overview', icon: UserRound },
  /**
   * Tickets, with **Conversations folded into it**.
   *
   * Conversations was its own tab, which put the record of a repair and the
   * record of talking about that repair on opposite sides of the tab strip.
   * A contact log is almost always *about* a job, so it now sits under the
   * tickets it belongs to and the strip loses a top-level entry that was only
   * ever read after a ticket anyway.
   */
  { key: 'tickets', label: 'Tickets', icon: Wrench },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'credit', label: 'Credit', icon: WalletCards },
  { key: 'quotes', label: 'Quotes', icon: FileSignature },
  // Enquiries this account sent through the website's contact form. Only ever
  // populated for a customer who was signed in when they submitted.
  { key: 'web-quotes', label: 'Web Quotes', icon: Globe },
  { key: 'rmas', label: 'RMAs', icon: RotateCcw },
  { key: 'notes', label: 'Notes', icon: FileText },
  // Consent, tier and the referral scheme: the terms of the relationship
  // rather than a record of it.
  { key: 'membership', label: 'Referral & Portal', icon: Gift },
  { key: 'activity', label: 'Activity', icon: History },
];

/** Icon and tone per activity kind, so a ledger of forty rows is scannable. */
const ACTIVITY_STYLE = {
  order: { icon: Package, tone: 'text-info' },
  'order-status': { icon: ArrowRight, tone: 'text-ink-400' },
  invoice: { icon: Receipt, tone: 'text-brand' },
  payment: { icon: Wallet, tone: 'text-ok' },
  void: { icon: Undo2, tone: 'text-warn' },
  credit: { icon: WalletCards, tone: 'text-ok' },
};

/** Tier badge tones. Mirrors `CustomerCrm`'s `TierPanel` and the customers list. */
const TIER_TONE = { standard: 'neutral', silver: 'info', gold: 'warn', platinum: 'brand' };

/**
 * The header tiles are deliberately uniform.
 *
 * Colouring each one by meaning made the row shout: eight washes, eight chips
 * and eight hairlines is a lot of signal for a set of figures somebody scans
 * once. The plain treatment the counts already used — white card, grey chip,
 * one ink colour — is what the whole row uses now, and colour is left to the
 * one place it still earns its keep: a figure that is actually a problem.
 */
const TILE_ALERT = 'text-danger';

/** Ticket status tones, matching `AdminTicketsPage` so a status reads the same on both. */
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

/**
 * Explicit widths on every column.
 *
 * Left to itself the browser sizes columns by content, so a long fault
 * description swallowed the row and the money column landed in a different
 * place on every table. Fixed proportions keep the figures in a straight line
 * down the page, which is the only thing that makes a column of numbers
 * comparable at a glance.
 */
const TICKET_COLUMNS = [
  {
    key: 'ticketNumber',
    header: 'Ticket',
    priority: 1,
    width: '18%',
    render: (ticket) => (
      <span className="whitespace-nowrap font-mono text-sm font-semibold text-ink-900">
        {ticket.ticketNumber}
      </span>
    ),
  },
  {
    key: 'device',
    header: 'Device',
    priority: 2,
    width: '30%',
    sortValue: (ticket) => `${ticket.device.brand ?? ''} ${ticket.device.model ?? ''}`,
    render: (ticket) => (
      <>
        <span className="block truncate text-sm text-ink-900">
          {[ticket.device.brand, ticket.device.model].filter(Boolean).join(' ') || '—'}
        </span>
        <span className="block truncate text-xs text-ink-400">{ticket.issue}</span>
      </>
    ),
  },
  {
    key: 'createdAt',
    header: 'Booked in',
    priority: 3,
    width: '16%',
    sortValue: (ticket) => new Date(ticket.createdAt).getTime(),
    render: (ticket) => (
      <span className="tnum whitespace-nowrap text-sm text-ink-500">
        {date(ticket.createdAt)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    priority: 1,
    width: '20%',
    render: (ticket) => (
      <Badge tone={TICKET_TONES[ticket.status] ?? 'neutral'} size="sm">
        {ticket.status.replace(/_/g, ' ')}
      </Badge>
    ),
  },
  {
    key: 'estimateCents',
    header: 'Estimate',
    priority: 2,
    width: '16%',
    align: 'right',
    className: 'tnum',
    sortValue: (ticket) => ticket.estimateCents ?? 0,
    render: (ticket) =>
      ticket.estimateCents > 0 ? (
        <span className="text-sm font-semibold text-ink-900">{money(ticket.estimateCents)}</span>
      ) : (
        <span className="text-xs text-ink-300">—</span>
      ),
  },
];

/** Orders. Same fixed-width discipline as the tickets table above. */
const ORDER_COLUMNS = [
  {
    key: 'orderNumber',
    header: 'Order #',
    priority: 1,
    width: '20%',
    render: (order) => (
      <span className="whitespace-nowrap font-mono text-sm font-semibold text-brand">
        {order.orderNumber}
      </span>
    ),
  },
  {
    key: 'createdAt',
    header: 'Date',
    priority: 2,
    width: '20%',
    sortValue: (order) => new Date(order.createdAt).getTime(),
    render: (order) => (
      <span className="tnum whitespace-nowrap text-sm text-ink-500">
        {date(order.createdAt)}
      </span>
    ),
  },
  {
    key: 'items',
    header: 'Items',
    priority: 3,
    // Centred, not right-aligned. A right-aligned count sits hard against the
    // left-aligned Status beside it, so the two read as one crowded pair while
    // a gap opens on the other side. A count is not a money column and gains
    // nothing from a decimal edge to line up on.
    width: '20%',
    align: 'center',
    className: 'tnum',
    sortValue: (order) => order.items.length,
    render: (order) => (
      <span className="text-sm text-ink-700">{formatCount(order.items.length)}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    priority: 1,
    width: '20%',
    render: (order) => <OrderStatusBadge status={order.status} size="sm" />,
  },
  {
    key: 'total',
    header: 'Total',
    priority: 1,
    width: '20%',
    align: 'right',
    className: 'tnum',
    sortValue: (order) => order.total,
    render: (order) => (
      <span className="text-sm font-semibold text-ink-900">{money(order.total)}</span>
    ),
  },
];

/**
 * Invoices, in the reference's column order: number, dates, money, status.
 *
 * **No subtotal or tax columns**, which the reference has and this does not.
 * The profile's invoice payload carries the total and what is paid against it,
 * not the line detail those two would be summed from — printing a "subtotal"
 * derived from a guessed tax rate would be a figure nobody could reconcile
 * against the invoice it claims to describe. The invoice's own screen, one
 * click away, shows the real breakdown.
 */
const INVOICE_COLUMNS = [
  {
    key: 'number',
    header: 'Invoice #',
    priority: 1,
    width: '18%',
    render: (invoice) => (
      <span className="whitespace-nowrap font-mono text-sm font-semibold text-brand">
        {invoice.number}
      </span>
    ),
  },
  {
    key: 'issuedAt',
    header: 'Date',
    priority: 2,
    width: '16%',
    sortValue: (invoice) => (invoice.issuedAt ? new Date(invoice.issuedAt).getTime() : 0),
    render: (invoice) => (
      <span className="tnum whitespace-nowrap text-sm text-ink-500">
        {invoice.issuedAt ? date(invoice.issuedAt) : '—'}
      </span>
    ),
  },
  {
    key: 'dueDate',
    header: 'Due',
    priority: 3,
    width: '16%',
    sortValue: (invoice) => (invoice.dueDate ? new Date(invoice.dueDate).getTime() : 0),
    render: (invoice) => (
      <span className="tnum whitespace-nowrap text-sm text-ink-500">
        {invoice.dueDate ? date(invoice.dueDate) : '—'}
      </span>
    ),
  },
  {
    /**
     * Paid, not "balance".
     *
     * A balance column reads "Settled" on every row of a healthy account,
     * which is a column of the same word — it says nothing and still costs the
     * width. What is actually useful beside a total is how much of it has
     * arrived, and the outstanding remainder is the one case worth colouring.
     */
    key: 'amountPaid',
    header: 'Paid',
    priority: 2,
    width: '18%',
    align: 'right',
    className: 'tnum',
    sortValue: (invoice) => invoice.amountPaid,
    render: (invoice) =>
      invoice.balance > 0 ? (
        <>
          <span className="text-sm font-semibold text-ink-900">
            {money(invoice.amountPaid)}
          </span>
          <span className="block whitespace-nowrap text-2xs text-danger">
            {money(invoice.balance)} owed
          </span>
        </>
      ) : (
        <span className="text-sm text-ink-700">{money(invoice.amountPaid)}</span>
      ),
  },
  {
    key: 'amount',
    header: 'Total',
    priority: 1,
    width: '16%',
    align: 'right',
    className: 'tnum',
    sortValue: (invoice) => invoice.amount,
    render: (invoice) => (
      <span className="text-sm font-semibold text-ink-900">{money(invoice.amount)}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    priority: 1,
    width: '16%',
    render: (invoice) => <InvoiceStatusBadge status={invoice.status} size="sm" />,
  },
];

/** Quote status tones, matching `AdminQuotesPage` so one status reads the same on both. */
const QUOTE_TONES = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'ok',
  expired: 'warn',
  converted: 'brand',
  rejected: 'danger',
};

/** Quotes on the customer profile. Even fifths, like the orders table. */
const QUOTE_COLUMNS = [
  {
    key: 'quoteNumber',
    header: 'Quote #',
    priority: 1,
    width: '20%',
    render: (quote) => (
      <span className="whitespace-nowrap font-mono text-sm font-semibold text-brand">
        {quote.quoteNumber}
      </span>
    ),
  },
  {
    key: 'createdAt',
    header: 'Date',
    priority: 2,
    width: '20%',
    sortValue: (quote) => new Date(quote.createdAt).getTime(),
    render: (quote) => (
      <span className="tnum whitespace-nowrap text-sm text-ink-500">
        {date(quote.createdAt)}
      </span>
    ),
  },
  {
    key: 'itemCount',
    header: 'Items',
    priority: 3,
    width: '20%',
    align: 'center',
    className: 'tnum',
    sortValue: (quote) => quote.itemCount ?? 0,
    render: (quote) => (
      <span className="text-sm text-ink-700">{formatCount(quote.itemCount ?? 0)}</span>
    ),
  },
  {
    key: 'validUntil',
    header: 'Expires',
    priority: 2,
    width: '20%',
    sortValue: (quote) => (quote.validUntil ? new Date(quote.validUntil).getTime() : 0),
    render: (quote) => (
      <span
        className={cn(
          'tnum whitespace-nowrap text-sm',
          quote.expired ? 'font-medium text-warn' : 'text-ink-500',
        )}
      >
        {quote.validUntil ? date(quote.validUntil) : '—'}
      </span>
    ),
  },
  {
    key: 'total',
    header: 'Total',
    priority: 1,
    width: '20%',
    align: 'right',
    className: 'tnum',
    sortValue: (quote) => quote.total,
    render: (quote) => (
      <>
        <span className="block text-sm font-semibold text-ink-900">{money(quote.total)}</span>
        <Badge tone={QUOTE_TONES[quote.status] ?? 'neutral'} size="sm">
          {quote.status}
        </Badge>
      </>
    ),
  },
];

/** Website enquiries on the customer profile. Even fifths, like the others. */
const WEB_QUOTE_TONES = { new: 'brand', read: 'info', closed: 'neutral' };

const WEB_QUOTE_COLUMNS = [
  {
    key: 'createdAt',
    header: 'Received',
    priority: 1,
    width: '20%',
    sortValue: (row) => new Date(row.createdAt).getTime(),
    render: (row) => (
      <span className="tnum whitespace-nowrap text-sm text-ink-500">
        {date(row.createdAt)}
      </span>
    ),
  },
  {
    key: 'topic',
    header: 'Topic',
    priority: 2,
    width: '20%',
    render: (row) => (
      <Badge tone="neutral" size="sm">
        {row.topic}
      </Badge>
    ),
  },
  {
    key: 'message',
    header: 'Enquiry',
    priority: 2,
    width: '40%',
    render: (row) => (
      <span className="block truncate text-sm text-ink-700">{row.message}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    priority: 1,
    width: '20%',
    render: (row) => (
      <Badge tone={WEB_QUOTE_TONES[row.status] ?? 'neutral'} size="sm">
        {row.status}
      </Badge>
    ),
  },
];

/** Rows per page on the profile's own tables. */
const ROWS_PER_PAGE = 10;

/**
 * One Overview roll-up card: a few rows, and a link to the tab that owns them.
 *
 * The action is a button rather than a link because the tab lives in a query
 * parameter this page already owns — routing through the URL would work, but
 * `setTab` is the one place that decides how a tab is selected.
 */
function SummaryPanel({ title, cta, onOpen, children }) {
  return (
    <Panel
      title={title}
      action={
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
        >
          {cta}
          <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      }
    >
      {children}
    </Panel>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 text-right text-ink-900">{children}</dd>
    </div>
  );
}

/**
 * A tab whose records arrive with a later phase.
 *
 * Named rather than hidden: an operator who cannot find the Quotes tab assumes
 * the client has none. This says the screen is not built, which is a different
 * claim from "there is nothing here" (§6b, rule 4 — nothing fakes success).
 */
function PendingTab({ icon: Icon, title, phase }) {
  return (
    <Panel>
      <PanelEmpty
        icon={Icon}
        title={title}
        body={`This record type ships in phase ${phase}. Nothing is hidden here — there is nothing to show yet.`}
      />
    </Panel>
  );
}

export function AdminClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'overview';

  const { data, isLoading } = useAdminUser(id);
  // The activity feed is a second query and only runs on its own tab — it
  // merges four collections and there is no reason to pay for it on Overview.
  const { data: activityData, isLoading: activityLoading } = useAdminUserActivity(
    id,
    tab === 'activity',
  );

  /**
   * Contact history, from the same `MessageLog` the Marketing screens write.
   *
   * Fetched on Overview as well as its own tab, because Overview summarises it —
   * but only a handful of rows there, since the roll-up shows three.
   */
  const wantsMessages = tab === 'tickets' || tab === 'overview';
  const { data: messageData, isLoading: messagesLoading } = useMarketingMessages(
    wantsMessages ? { user: id, limit: tab === 'overview' ? 5 : 50 } : undefined,
  );

  /**
   * This account's repair tickets, for the Tickets tab.
   *
   * Filtered server-side by `user`, which only tickets raised against an
   * account carry — a walk-in repair has no account and belongs on nobody's
   * profile. Fetched on its own tab only; the header's count comes from
   * `totals` and does not need the rows.
   */
  /** This account's quotes. Fetched on its own tab; the header count is in `totals`. */
  const { data: quoteData, isLoading: quotesLoading } = useAdminQuotes(
    tab === 'quotes' ? { user: id, status: 'all' } : undefined,
  );

  /** This account's website enquiries. Fetched on its own tab only. */
  const { data: webQuoteData, isLoading: webQuotesLoading } = useAdminWebQuotes(
    tab === 'web-quotes' ? { user: id, status: 'all' } : undefined,
  );

  const { data: ticketData, isLoading: ticketsLoading } = useAdminTickets(
    tab === 'tickets' ? { user: id, status: 'all', limit: 50 } : undefined,
  );

  const {
    setContactConsent,
    setTier,
    addInternalNote,
    deleteInternalNote,
    sendMessage,
    approveUser,
    rejectUser,
  } = useAdminMutations();

  // What the server said actually happened to a message. Held here rather than
  // in the panel so it survives the panel's own re-render after a send.
  const [notice, setNotice] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // The tier's warranty bonus is a setting, not a property of the account, so
  // the panel reads it from there rather than the profile inventing a number.
  const { data: settingsData } = useAdminSettings();

  // Publishes the business name to the shell's breadcrumb, so the trail reads
  // `⌂ > Sales > Clients > Northline Wireless` rather than `… > Client` (§4b.6).
  // Called before the loading return, because a hook cannot be conditional.
  useSetRecordLabel(data?.user?.displayName);

  function setTab(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-80" />
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { user, orders, invoices, notes = [] } = data;
  const messages = messageData?.messages ?? [];

  /**
   * Log a call, or send a message, against this account.
   *
   * Defined once and passed to both the Conversations tab and the Overview
   * roll-up: two copies would eventually disagree about which route a channel
   * posts to, and the `notice` handling is the part that must not drift — the
   * server says whether anything actually transmitted, and that is rendered
   * verbatim rather than turned into a confirmation (§6b rule 4).
   */
  function logInteraction({ channel, direction, body }, done) {
    // `calls` is the route's plural; the other three match the channel name.
    const route = channel === 'call' ? 'calls' : channel;

    sendMessage.mutate(
      { channel: route, userId: id, direction, body, text: body },
      {
        onSuccess: (payload) => {
          setNotice(payload?.notice ?? null);
          done();
        },
      },
    );
  }

  /**
   * The monogram. Two letters from the display name, one from a single word.
   *
   * Built from `displayName` rather than `businessName` (§0): a private
   * customer has no company, and initials taken from an empty string would
   * render an empty circle on exactly the accounts this panel now serves.
   */
  const initials =
    (user.displayName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '—';

  /**
   * Header figures come from `totals`, not from the lists.
   *
   * `orders` and `invoices` are the ten most recent — enough for the roll-up
   * panels, wrong for a tile that says "total". Summing them understated every
   * account past its tenth invoice, which is precisely the set of accounts
   * somebody opens this screen to check. The server counts the whole set.
   */
  const totals = data.totals ?? {};
  const invoiced = totals.invoiced ?? 0;
  const collected = totals.collected ?? 0;
  const outstanding = totals.outstanding ?? 0;
  const activeTickets = totals.activeTickets ?? 0;
  const openQuotes = totals.openQuotes ?? 0;

  /**
   * When anything last happened on this account.
   *
   * Taken from the newest order or invoice already on screen rather than a
   * sixth query: both lists are sorted newest-first, so the answer is the first
   * row of each. `lastLoginAt` is deliberately not in the running — signing in
   * is not activity on the account, it is somebody looking at it.
   */
  const lastActivityAt = [orders[0]?.createdAt, invoices[0]?.issuedAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  /**
   * Paging for the Orders and Invoices tables.
   *
   * In the URL beside `tab`, so a page is part of the address like every other
   * bit of screen state here — and clamped on read, because a filter or a
   * fresh load can strand the URL on a page that no longer exists.
   */
  const ordersPage = Math.max(1, Number(searchParams.get('ordersPage') ?? 1));
  const invoicesPage = Math.max(1, Number(searchParams.get('invoicesPage') ?? 1));

  const orderPages = Math.max(1, Math.ceil(orders.length / ROWS_PER_PAGE));
  const invoicePages = Math.max(1, Math.ceil(invoices.length / ROWS_PER_PAGE));

  const currentOrdersPage = Math.min(ordersPage, orderPages);
  const currentInvoicesPage = Math.min(invoicesPage, invoicePages);

  const pagedOrders = orders.slice(
    (currentOrdersPage - 1) * ROWS_PER_PAGE,
    currentOrdersPage * ROWS_PER_PAGE,
  );
  const pagedInvoices = invoices.slice(
    (currentInvoicesPage - 1) * ROWS_PER_PAGE,
    currentInvoicesPage * ROWS_PER_PAGE,
  );

  function setRowPage(key, next) {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete(key);
    else params.set(key, String(next));
    setSearchParams(params, { replace: true });
  }

  /** Query string that pre-fills the ticket form's free-text customer. */
  const ticketSeed = new URLSearchParams({
    client: id,
    name: user.displayName ?? '',
    phone: user.phone ?? '',
    email: user.email ?? '',
  }).toString();

  /**
   * The header strip's figures.
   *
   * Built as data rather than markup so the strip stays one loop — eight
   * hand-written cells is eight places to get a divider or a type size wrong.
   * `emphasis` is only set where the number carries a warning; everything else
   * is deliberately the same weight, because a panel where four figures shout
   * has no emphasis at all.
   */
  const STATS = [
    {
      key: 'revenue',
      label: 'Total revenue',
      icon: Receipt,
      value: money(invoiced),
      hint: `${formatCount(totals.invoiceCount ?? 0)} invoiced · ${formatCount(totals.orderCount ?? 0)} orders`,
    },
    {
      key: 'collected',
      label: 'Collected',
      icon: Wallet,
      value: money(collected),
      hint: outstanding > 0 ? `${money(outstanding)} still unpaid` : 'Paid in full',
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      icon: FileText,
      // Red only when money is actually late. An always-red Outstanding tile
      // is a warning light that is never off, which is a warning light nobody
      // looks at.
      alert: outstanding > 0,
      value: money(outstanding),
      hint: 'Unpaid on issued invoices',
    },
    {
      // The line of credit: what Cellvix lends. Kept apart from store credit,
      // as the Instructions require — they are two different instruments.
      key: 'credit-line',
      label: 'Line of credit',
      icon: Wallet,
      value: money(user.balance),
      hint: `of ${money(user.creditLimit)} · ${user.terms.replace('net', 'Net ')}`,
    },
    {
      // Store credit: what the business already holds.
      key: 'store-credit',
      label: 'Store credit',
      icon: WalletCards,
      value: money(user.storeCredit ?? 0),
      hint: 'Spends at checkout',
    },
    {
      key: 'tickets',
      label: 'Active tickets',
      icon: Wrench,
      value: formatCount(activeTickets),
      hint: activeTickets > 0 ? 'Open repair jobs' : 'No open jobs',
    },
    {
      key: 'quotes',
      label: 'Open quotes',
      icon: FileSignature,
      value: formatCount(openQuotes),
      hint: openQuotes > 0 ? 'Awaiting a decision' : 'Nothing outstanding',
    },
    {
      // The one non-numeric cell: "when did we last hear from them" is how a
      // dormant account is spotted, and a date answers it where a count cannot.
      key: 'last-activity',
      label: 'Last activity',
      icon: CalendarDays,
      value: lastActivityAt ? relativeTime(lastActivityAt) : '—',
      hint: lastActivityAt ? date(lastActivityAt) : 'Nothing recorded yet',
    },
  ];

  /** Counts shown on the tabs. Absent or zero renders no badge at all. */
  const TAB_COUNTS = {
    tickets: activeTickets,
    orders: totals.orderCount ?? 0,
    invoices: totals.invoiceCount ?? 0,
    quotes: openQuotes,
    'web-quotes': totals.webQuotes ?? 0,
    notes: notes.length,
  };

  const tierBonus = settingsData?.financial?.warrantyBonusByTier?.[user.tier] ?? 0;

  // Channel names for the Overview summary. Read from the same `consent.channels`
  // the panel writes, so the two can never disagree about who may be contacted.
  const consentedChannels = Object.entries(user.consent.channels)
    .filter(([, on]) => on)
    .map(([channel]) => (channel === 'call' ? 'Phone' : channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'));

  return (
    <>
      {/**
       * The profile's own header, not `PageHeader`.
       *
       * Every other admin screen opens with an icon, a title and a description,
       * because every other screen is *about a kind of record*. This one is
       * about **a person**, and the things an operator does from it are
       * transactional — raise a ticket, invoice them, send a statement. So it
       * gets a monogram rather than the Customers glyph (which was the same
       * mark on every account), the contact details as a scannable row rather
       * than one run-on sentence, and the actions laid out as a row of equals.
       */}
      {/**
       * The approval decision, on the record it is about.
       *
       * A pending account was answerable only from the Approvals queue or the
       * notification bell — so an operator who arrived here from a search, or
       * from the customers list, could read everything about the business and
       * still had to go and find the same form somewhere else. The banner is
       * the whole state of the account said in one line, with both answers
       * beside it.
       *
       * It leads the page rather than sitting among the tabs because until it
       * is answered nothing else on this screen can happen: a pending account
       * cannot see a price, order, or be invoiced.
       */}
      {user.status === 'pending' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warn/35 bg-warn-50 px-4 py-3">
          <Clock className="size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-snug text-ink-900">
            <span className="font-semibold">This account is waiting for approval.</span>{' '}
            <span className="text-ink-600">
              It can sign in and browse, but sees no wholesale pricing and cannot order until it is
              approved.
            </span>
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={XCircle} onClick={() => setRejecting(true)}>
              Reject
            </Button>
            <Button size="sm" icon={CheckCircle2} onClick={() => setApproving(true)}>
              Approve
            </Button>
          </div>
        </div>
      )}

      {/* One card: identity, figures and tabs are the same object, and three
          separate slabs made the top of this screen read as three unrelated
          widgets. The brand rule along the top is the only ornament — it says
          "this is a record" the way the reference does. */}
      <div className="mb-5 overflow-hidden rounded-lg border border-line bg-surface">
        <span className="block h-1 bg-brand-gradient" aria-hidden="true" />

        <header className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            {/* Initials, from the name the account is actually known by
                (§0's `displayName`). A monogram tells two accounts apart in a
                way a shared icon cannot. */}
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-xl font-bold text-white"
              aria-hidden="true"
            >
              {initials}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl leading-tight sm:text-2xl">{user.displayName}</h1>
                <Badge tone={STATUS_TONES[user.status]} size="sm">
                  {user.status}
                </Badge>
                {user.tier && user.tier !== 'standard' && (
                  <Badge tone="brand" size="sm">
                    {user.tier}
                  </Badge>
                )}
              </div>

              {/* One line per fact, each behind its own icon: an operator
                  reading a phone number off the screen should not have to find
                  it inside a sentence of separators. Email and phone are
                  actionable — this is a screen somebody uses while picking up
                  the handset. */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
                {user.businessName && user.businessName !== user.displayName && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0 text-brand" strokeWidth={2.25} aria-hidden="true" />
                    {user.businessName}
                  </span>
                )}
                <a
                  href={`mailto:${user.email}`}
                  className={cn(pressable, 'inline-flex items-center gap-1.5 hover:text-ink-900')}
                >
                  <Mail className="size-3.5 shrink-0 text-brand" strokeWidth={2.25} aria-hidden="true" />
                  {user.email}
                </a>
                {user.phone && (
                  <a
                    href={`tel:${user.phone.replace(/[^\d+]/g, '')}`}
                    className={cn(pressable, 'inline-flex items-center gap-1.5 hover:text-ink-900')}
                  >
                    <Phone className="size-3.5 shrink-0 text-brand" strokeWidth={2.25} aria-hidden="true" />
                    {user.phone}
                  </a>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0 text-brand" strokeWidth={2.25} aria-hidden="true" />
                  Since {date(user.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* The transactional actions, in the order somebody reaches for
              them. Each opens the page that already owns that record type,
              seeded with this account — never a second form of its own, which
              is how two create paths end up disagreeing (§7.2). */}
          <div className="flex flex-wrap items-center gap-2">
            {/* A ticket stores its customer as free text, so the name, phone
                and email travel with the link rather than an id the tickets
                page would have to look up. `client` links it back to the
                account so this profile can count its own open jobs. */}
            <Link to={`/admin/tickets?new=1&${ticketSeed}`}>
              <Button size="sm" icon={Wrench}>
                New ticket
              </Button>
            </Link>
            <Link to={`/admin/invoices?new=1&client=${id}`}>
              <Button size="sm" variant="outline" icon={Receipt}>
                Invoice
              </Button>
            </Link>
            <Link to={`/admin/quotes?new=1&client=${id}`}>
              <Button size="sm" variant="outline" icon={FileSignature}>
                Quote
              </Button>
            </Link>
            {/* The printable account statement: every invoice and payment on
                this account with a closing balance. It opens the rendered
                document in a new tab, where the browser's print dialog is what
                saves it as a PDF — the same route the invoice document takes,
                so there is one way to produce paper from this system. */}
            <Button
              size="sm"
              variant="outline"
              icon={FileText}
              onClick={() =>
                window.open(apiUrl(`/admin/users/${id}/statement`), '_blank', 'noopener')
              }
            >
              Statement
            </Button>
            <Link to={`/admin/clients/${id}/edit`}>
              <Button size="sm" variant="outline" icon={Pencil}>
                Edit
              </Button>
            </Link>
            </div>
          </div>
        </header>


        {/**
         * Eight figures, one uniform treatment.
         *
         * They were briefly coloured by meaning — a wash, a chip and a
         * hairline per tile keyed to what the number was. Eight of those in a
         * row is a lot of signal for a set of figures somebody scans once, and
         * the colour ended up competing with the numbers rather than ranking
         * them. Every tile is the plain card the counts already used; the only
         * colour left is on a figure that is genuinely a problem.
         */}
        <dl className="grid grid-cols-2 gap-2.5 border-t border-line bg-surface-2 p-3 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.key}
              className={cn(
                'rounded-lg border border-line bg-surface px-3.5 py-3',
                'transition-shadow duration-fast hover:shadow-card',
              )}
            >
              <dt className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-400">
                  <stat.icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="truncate text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  {stat.label}
                </span>
              </dt>

              <dd>
                <span
                  className={cn(
                    'tnum mt-2.5 block font-display text-xl font-bold leading-none',
                    // The one exception to the uniform treatment: a figure that
                    // is genuinely a problem. Everything else is ink.
                    stat.alert ? TILE_ALERT : 'text-ink-900',
                  )}
                >
                  {stat.value}
                </span>
                <span className="mt-1.5 block text-2xs leading-tight text-ink-400">
                  {stat.hint}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/**
       * Tabs are their own section now.
       *
       * Inside the identity card they read as part of the record's header,
       * which is the wrong claim: the strip does not describe the customer, it
       * switches what is shown *below* it. Sitting on its own, directly above
       * the panel it controls, the relationship is the one it actually has.
       */}
      <div className="scroll-slim mb-4 flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface px-2">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm font-medium',
                pressable,
                active ? 'text-brand' : 'text-ink-400 hover:text-ink-700',
              )}
            >
              <item.icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              {item.label}
              {/* A count only when there is something to count: a row of grey
                  zeroes teaches an operator to stop reading them. */}
              {TAB_COUNTS[item.key] > 0 && (
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 text-2xs font-semibold leading-[16px]',
                    active ? 'bg-brand text-white' : 'bg-surface-2 text-ink-500',
                  )}
                >
                  {TAB_COUNTS[item.key]}
                </span>
              )}
              {active && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-brand-gradient-compact"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>


      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* The one place the business name is shown. Everywhere else — the
              header, the breadcrumb, the customers list, every reference to
              this account — uses `displayName`, which is the person (§0). The
              company is a detail *about* them, and it belongs in the detail
              panel rather than standing in as their name. */}
          <Panel
            title="Customer details"
            action={
              <Link
                to={`/admin/clients/${id}/edit`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
              >
                <Pencil className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                Edit
              </Link>
            }
          >
            <dl className="space-y-2.5 text-sm">
              {[
                ['Name', user.displayName],
                ['Business', user.businessName || '—'],
                ['Email', user.email],
                ['Phone', user.phone || '—'],
                ['Tax ID', user.taxId || '—'],
                ['Registered', date(user.createdAt)],
                ['Last signed in', user.lastLoginAt ? date(user.lastLoginAt) : 'Never'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-ink-400">{label}</dt>
                  <dd className="min-w-0 flex-1 break-words text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Invoices get their own panel on Overview rather than only a line
              in "Recent activity". It is the section an operator opens a
              customer to look at — what has been billed and what is still
              owed — and the roll-up above buries it among order rows. */}
          <Panel
            title="Invoices"
            action={
              <div className="flex items-center gap-2">
                <Link to={`/admin/invoices?new=1&client=${id}`}>
                  <Button size="xs" icon={Plus}>
                    New
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => setTab('invoices')}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
                >
                  View all
                  <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
            }
          >
            {invoices.length === 0 ? (
              <PanelEmpty icon={Receipt} title="No invoices yet" body="Nothing has been billed to this account." />
            ) : (
              <ul className="divide-y divide-line">
                {invoices.slice(0, 5).map((invoice) => (
                  /* A link, not a row with a click handler: an invoice has its
                     own URL, so this should be openable in a new tab and show
                     its destination in the status bar like any other link. The
                     eye appears on hover — an icon on all five rows is five
                     copies of a fact the pointer already gives. */
                  <li key={invoice.number} className="first:pt-0 last:pb-0">
                    <Link
                      to={`/admin/invoices/${invoice.number}`}
                      className={cn(pressable, 'group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2')}
                    >
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 group-hover:text-brand">
                        <span className="truncate">{invoice.number}</span>
                        <Eye
                          className="size-3.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="block text-xs text-ink-400">
                        {invoice.issuedAt ? date(invoice.issuedAt) : '—'}
                        {invoice.balance > 0 && ` · ${money(invoice.balance)} owed`}
                      </span>
                    </div>
                    <InvoiceStatusBadge status={invoice.status} />
                    <span className="tnum shrink-0 text-sm font-semibold text-ink-900">
                      {money(invoice.amount)}
                    </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent activity"
            description="The last few things to happen on this account. Click any row to open it."
            action={
              <button
                type="button"
                onClick={() => setTab('activity')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
              >
                Full history
                <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              </button>
            }
          >
            {orders.length === 0 && invoices.length === 0 ? (
              <PanelEmpty icon={Building2} title="Nothing yet" body="No orders or invoices." />
            ) : (
              // Each row is a link to the record it names. The row already
              // said "Order 1043"; it just could not be opened, which made the
              // panel a list of things to go and find somewhere else.
              <ul className="-mx-2 space-y-0.5">
                {orders.slice(0, 3).map((order) => (
                  <li key={order.orderNumber}>
                    <Link
                      to={`/admin/orders/${order.orderNumber}`}
                      className={cn(pressable, 'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2')}
                    >
                      <Package className="size-3.5 shrink-0 text-info" strokeWidth={2.25} aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink-700 group-hover:text-brand">
                        <span className="truncate">Order {order.orderNumber}</span>
                        <Eye
                          className="size-3.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="tnum shrink-0 text-ink-400">{date(order.createdAt)}</span>
                    </Link>
                  </li>
                ))}
                {invoices.slice(0, 3).map((invoice) => (
                  <li key={invoice.number}>
                    <Link
                      to={`/admin/invoices/${invoice.number}`}
                      className={cn(pressable, 'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2')}
                    >
                      <Receipt className="size-3.5 shrink-0 text-brand" strokeWidth={2.25} aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink-700 group-hover:text-brand">
                        <span className="truncate">Invoice {invoice.number}</span>
                        <Eye
                          className="size-3.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="tnum shrink-0 text-ink-400">{money(invoice.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ---- the roll-up ------------------------------------------------
              Each summary shows the first few rows and hands off to the tab
              that owns them. Deliberately read-only: a form on Overview and the
              same form on its own tab is two places to write the same record,
              and they drift. Overview answers "what is going on with this
              account"; the tabs are where something is done about it. */}
          <SummaryPanel
            title="Membership & consent"
            onOpen={() => setTab('membership')}
            cta="Referral & Portal"
          >
            <dl className="space-y-2 text-sm">
              <SummaryRow label="Tier">
                <Badge tone={TIER_TONE[user.tier] ?? 'neutral'} size="sm">
                  {MEMBERSHIP_TIERS.find((item) => item.value === user.tier)?.label ?? user.tier}
                </Badge>
              </SummaryRow>
              <SummaryRow label="Warranty bonus">
                {tierBonus > 0 ? `+${tierBonus} days` : 'None'}
              </SummaryRow>
              <SummaryRow label="Referral code">
                {user.referralCode ? (
                  <code className="font-mono text-xs font-semibold">{user.referralCode}</code>
                ) : (
                  <span className="text-ink-400">Not issued</span>
                )}
              </SummaryRow>
              <SummaryRow label="Contactable on">
                {user.consent.unsubscribedAt ? (
                  <span className="text-danger">Unsubscribed</span>
                ) : consentedChannels.length > 0 ? (
                  consentedChannels.join(' · ')
                ) : user.consent.recorded ? (
                  <span className="text-warn">Nothing — all declined</span>
                ) : (
                  <span className="text-ink-400">Not recorded</span>
                )}
              </SummaryRow>
            </dl>
          </SummaryPanel>

          <SummaryPanel
            title="Conversations"
            onOpen={() => setTab('conversations')}
            cta="All conversations"
          >
            {messages.length === 0 ? (
              <p className="py-3 text-sm text-ink-400">Nothing logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {messages.slice(0, 3).map((message) => (
                  <li key={message.id} className="flex items-start gap-2.5 text-sm">
                    <MessageCircle
                      className="mt-0.5 size-3.5 shrink-0 text-ink-300"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink-700">{message.body}</span>
                      <span className="text-xs text-ink-400">
                        {message.channel} · {relativeTime(message.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SummaryPanel>

          <SummaryPanel title="Internal notes" onOpen={() => setTab('notes')} cta="All notes">
            {notes.length === 0 ? (
              <p className="py-3 text-sm text-ink-400">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {notes.slice(0, 3).map((note) => (
                  <li key={note.id} className="text-sm">
                    <p className="line-clamp-2 text-ink-700">{note.body}</p>
                    <p className="text-xs text-ink-400">
                      {note.staffName} · {date(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SummaryPanel>
        </div>
      )}

      {/* Tickets, and the conversation log underneath them. Talking to a
          customer is nearly always *about* a job, so the record of the call
          sits with the jobs rather than on its own tab across the strip. */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          <Panel
            flush
            title="Repair tickets"
            description="Jobs raised against this account. A walk-in with no account is not listed here."
            action={
              <Link to={`/admin/tickets?new=1&${ticketSeed}`}>
                <Button size="xs" icon={Plus}>
                  New ticket
                </Button>
              </Link>
            }
          >
            <DataTable
              columns={TICKET_COLUMNS}
              rows={ticketData?.tickets ?? []}
              rowKey={(ticket) => ticket.id}
              loading={ticketsLoading}
              onRowClick={(ticket) => navigate(`/admin/tickets?q=${ticket.ticketNumber}`)}
              defaultSort={{ key: 'createdAt', direction: 'desc' }}
              empty={
                <PanelEmpty
                  icon={Wrench}
                  title="No tickets"
                  body="No repair has been booked in against this account."
                />
              }
            />
          </Panel>

          <ConversationsPanel
            messages={messages}
            isLoading={messagesLoading}
            isPending={sendMessage.isPending}
            error={sendMessage.error?.message}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onLog={logInteraction}
          />
        </div>
      )}

      {tab === 'notes' && (
        <NotesPanel
          notes={notes}
          isPending={addInternalNote.isPending}
          onAdd={(body, done) => addInternalNote.mutate({ id, body }, { onSuccess: done })}
          onDelete={(noteId) => deleteInternalNote.mutate({ id, noteId })}
        />
      )}

      {tab === 'membership' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <ReferralPanel user={user} percent={settingsData?.financial?.referralPercent ?? 5} />
            <TierPanel
              tier={user.tier}
              warrantyBonus={settingsData?.financial?.warrantyBonusByTier?.[user.tier] ?? 0}
              isPending={setTier.isPending}
              onChange={(next) => setTier.mutate({ id, tier: next })}
            />
          </div>

          <ConsentPanel
            consent={user.consent}
            isPending={setContactConsent.isPending}
            onSave={(channels) => setContactConsent.mutate({ id, ...channels })}
          />
        </div>
      )}

      {tab === 'orders' && (
        <Panel
          flush
          title="Orders"
          description="Click a row to open the order."
        >
          <DataTable
            columns={ORDER_COLUMNS}
            rows={pagedOrders}
            rowKey={(order) => order.orderNumber}
            defaultSort={{ key: 'createdAt', direction: 'desc' }}
            // One canonical URL per record (invariant 15): the row opens the
            // order's own screen rather than a drawer showing the same thing
            // at a different address.
            onRowClick={(order) => navigate(`/admin/orders/${order.orderNumber}`)}
            empty={<PanelEmpty icon={Package} title="No orders" body="This account has not ordered yet." />}
          />

          {orders.length > 0 && (
            <div className="border-t border-line p-3">
              <Pagination
                page={currentOrdersPage}
                pages={orderPages}
                onChange={(next) => setRowPage('ordersPage', next)}
              />
            </div>
          )}
        </Panel>
      )}

      {tab === 'invoices' && (
        <Panel
          flush
          title="All invoices"
          description="Click a row to open the invoice."
          action={
            <Link to={`/admin/invoices?new=1&client=${id}`}>
              <Button size="xs" icon={Plus}>
                New invoice
              </Button>
            </Link>
          }
        >
          <DataTable
            columns={INVOICE_COLUMNS}
            rows={pagedInvoices}
            rowKey={(invoice) => invoice.number}
            defaultSort={{ key: 'issuedAt', direction: 'desc' }}
            onRowClick={(invoice) => navigate(`/admin/invoices/${invoice.number}`)}
            empty={<PanelEmpty icon={FileText} title="No invoices" body="Nothing has been invoiced yet." />}
          />

          {invoices.length > 0 && (
            <div className="border-t border-line p-3">
              <Pagination
                page={currentInvoicesPage}
                pages={invoicePages}
                onChange={(next) => setRowPage('invoicesPage', next)}
              />
            </div>
          )}
        </Panel>
      )}

      {tab === 'credit' && (
        // Two instruments, kept visually apart (Instructions): the line of
        // credit is what Cellvix lends, store credit is what the business holds.
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <CreditForm id={id} user={user} />
            {/* Recording a payment sits under the terms it pays against, not
                beside store credit: they are the two halves of the same
                instrument. */}
            <CreditRepaymentForm id={id} user={user} />
          </div>
          <StoreCreditPanel id={id} balance={user.storeCredit} />
        </div>
      )}

      {tab === 'quotes' && (
        <Panel
          flush
          title="All quotes"
          description="Click a row to open the quote. An accepted quote converts to an order and its invoice."
          action={
            <Link to={`/admin/quotes?new=1&client=${id}`}>
              <Button size="xs" icon={Plus}>
                New quote
              </Button>
            </Link>
          }
        >
          <DataTable
            columns={QUOTE_COLUMNS}
            rows={quoteData?.quotes ?? []}
            rowKey={(quote) => quote.id}
            loading={quotesLoading}
            defaultSort={{ key: 'createdAt', direction: 'desc' }}
            onRowClick={(quote) => navigate(`/admin/quotes/${quote.id}`)}
            empty={
              <PanelEmpty
                icon={FileSignature}
                title="No quotes"
                body="Nothing has been quoted to this account yet."
              />
            }
          />
        </Panel>
      )}
      {tab === 'web-quotes' && (
        <Panel
          flush
          title="Website enquiries"
          description="Messages this account sent through the site's contact form. A guest enquiry is not linked to an account and lives on the Web Quote list."
          action={
            <Link
              to="/admin/web-quotes"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
            >
              All enquiries
              <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            </Link>
          }
        >
          <DataTable
            columns={WEB_QUOTE_COLUMNS}
            rows={webQuoteData?.webQuotes ?? []}
            rowKey={(row) => row.id}
            loading={webQuotesLoading}
            defaultSort={{ key: 'createdAt', direction: 'desc' }}
            onRowClick={() => navigate('/admin/web-quotes')}
            empty={
              <PanelEmpty
                icon={Globe}
                title="No enquiries"
                body="This account has not sent anything through the website contact form."
              />
            }
          />
        </Panel>
      )}

      {tab === 'rmas' && <PendingTab icon={RotateCcw} title="RMAs arrive in phase 7" phase={7} />}

      {tab === 'activity' && (
        <Panel
          title="Activity"
          description="Orders, invoices, payments and credit movements, newest first"
          flush
        >
          {activityLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : (activityData?.activity ?? []).length === 0 ? (
            <PanelEmpty icon={Building2} title="Nothing recorded" body="No activity on this account." />
          ) : (
            <ul className="divide-y divide-line">
              {activityData.activity.map((event, index) => {
                const style = ACTIVITY_STYLE[event.kind] ?? ACTIVITY_STYLE['order-status'];
                const Icon = style.icon;

                return (
                  <li
                    key={`${event.kind}-${event.at}-${index}`}
                    className="flex items-start gap-3 px-4 py-2.5"
                  >
                    <Icon
                      className={cn('mt-0.5 size-3.5 shrink-0', style.tone)}
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink-900">{event.title}</span>
                      {event.detail && (
                        <span className="block text-xs text-ink-400">{event.detail}</span>
                      )}
                    </span>
                    {event.amount != null && (
                      <span className="tnum shrink-0 text-sm font-medium text-ink-700">
                        {money(Math.abs(event.amount))}
                      </span>
                    )}
                    <span className="tnum hidden shrink-0 text-xs text-ink-400 sm:block">
                      {dateTime(event.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
      {/* Approving sets credit terms and an account rep in one payload — the
          decision to do business with somebody and the decision how much credit
          to extend them are one decision, so they are one form. */}
      <Modal
        open={approving}
        onClose={() => setApproving(false)}
        title={`Approve ${user.displayName}`}
        size="lg"
      >
        {approving && (
          <ApproveClientForm
            user={user}
            isPending={approveUser.isPending}
            error={approveUser.error?.message}
            onCancel={() => setApproving(false)}
            onSubmit={(values) =>
              approveUser.mutate(
                { id, ...values },
                {
                  onSuccess: () => {
                    setApproving(false);
                    toast.ok('Account approved', `${user.displayName} can now see pricing and order.`);
                  },
                },
              )
            }
          />
        )}
      </Modal>

      {/* The same `RejectForm` the Approvals queue uses. A reason is required
          because it goes into the notification email — a rejection with no
          explanation is a customer who calls to ask why. */}
      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={`Reject ${user.displayName}`}
      >
        {rejecting && (
          <RejectForm
            user={user}
            isPending={rejectUser.isPending}
            onCancel={() => setRejecting(false)}
            onSubmit={(reason) =>
              rejectUser.mutate(
                { id, reason },
                {
                  onSuccess: () => {
                    setRejecting(false);
                    toast.ok('Account rejected', 'They have been told why.');
                  },
                },
              )
            }
          />
        )}
      </Modal>

    </>
  );
}

export default AdminClientProfilePage;
