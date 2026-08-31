import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  ArrowRight,
  Building2,
  FileText,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Undo2,
  Wallet,
  WalletCards,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, dateTime, relativeTime, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import { OrderStatusBadge, InvoiceStatusBadge } from '@/components/account/OrderStatusBadge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import DataTable from '@/components/admin/DataTable';
import { CreditForm, StoreCreditPanel, STATUS_TONES } from '@/components/admin/ClientDetail';
import {
  ConsentPanel,
  TierPanel,
  NotesPanel,
  ConversationsPanel,
  ReferralPanel,
} from '@/components/admin/CustomerCrm';
import { MEMBERSHIP_TIERS } from '@shared/schemas/admin';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import {
  useAdminUser,
  useAdminUserActivity,
  useAdminMutations,
  useMarketingMessages,
  useAdminSettings,
} from '@/hooks/useAdmin';

const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/clients/:id'], icon: adminIcon('Users') };

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
  { key: 'overview', label: 'Overview' },
  { key: 'orders', label: 'Orders' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'credit', label: 'Credit' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'rmas', label: 'RMAs' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'notes', label: 'Notes' },
  // Consent, tier and the referral scheme: the terms of the relationship
  // rather than a record of it.
  { key: 'membership', label: 'Referral & Portal' },
  { key: 'activity', label: 'Activity' },
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
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
        >
          {cta}
          <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
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
  const wantsMessages = tab === 'conversations' || tab === 'overview';
  const { data: messageData, isLoading: messagesLoading } = useMarketingMessages(
    wantsMessages ? { user: id, limit: tab === 'overview' ? 5 : 50 } : undefined,
  );

  const {
    setContactConsent,
    setTier,
    addInternalNote,
    deleteInternalNote,
    sendMessage,
  } = useAdminMutations();

  // What the server said actually happened to a message. Held here rather than
  // in the panel so it survives the panel's own re-render after a send.
  const [notice, setNotice] = useState(null);

  // The tier's warranty bonus is a setting, not a property of the account, so
  // the panel reads it from there rather than the profile inventing a number.
  const { data: settingsData } = useAdminSettings();

  // Publishes the business name to the shell's breadcrumb, so the trail reads
  // `⌂ > Sales > Clients > Northline Wireless` rather than `… > Client` (§4b.6).
  // Called before the loading return, because a hook cannot be conditional.
  useSetRecordLabel(data?.user?.businessName);

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

  const invoiced = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const orderValue = orders.reduce((sum, order) => sum + order.total, 0);

  const tierBonus = settingsData?.financial?.warrantyBonusByTier?.[user.tier] ?? 0;

  // Channel names for the Overview summary. Read from the same `consent.channels`
  // the panel writes, so the two can never disagree about who may be contacted.
  const consentedChannels = Object.entries(user.consent.channels)
    .filter(([, on]) => on)
    .map(([channel]) => (channel === 'call' ? 'Phone' : channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'));

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={user.businessName}
        description={`${user.contactName} · ${user.email}${user.phone ? ` · ${user.phone}` : ''}`}
        badge={
          <Badge tone={STATUS_TONES[user.status]} size="sm">
            {user.status}
          </Badge>
        }
        action={
          <>
            <Link
              to="/admin/clients"
              className="flex h-9 items-center rounded-[8px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-600 transition-colors hover:border-line-strong hover:text-ink-900"
            >
              All customers
            </Link>
            {/* The profile is where somebody notices a detail is wrong, so the
                way to correct it belongs here rather than only back on the
                list. Same route the list's row menu opens. */}
            {/* Raising an invoice against the account already on screen. It
                opens the invoices page's own form pre-filled rather than
                forking a second one — two invoice forms would eventually
                disagree about terms or due dates. */}
            <Link to={`/admin/invoices?new=1&client=${id}`}>
              <Button size="sm" variant="outline" icon={Plus}>
                New invoice
              </Button>
            </Link>
            <Link to={`/admin/clients/${id}/edit`}>
              <Button size="sm" icon={Pencil}>
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'orders',
            label: 'Orders',
            value: formatCount(orders.length),
            hint: `${money(orderValue)} of order value`,
            tone: 'info',
            icon: Package,
          },
          {
            key: 'invoiced',
            label: 'Invoiced',
            value: money(invoiced),
            hint: `${formatCount(invoices.length)} ${invoices.length === 1 ? 'invoice' : 'invoices'}`,
            tone: 'brand',
            icon: Receipt,
          },
          {
            key: 'balance',
            // The line of credit: what Cellvix lends. Kept apart from store
            // credit below, as the Instructions require.
            label: 'Line of credit',
            value: money(user.balance),
            hint: `of ${money(user.creditLimit)} · ${user.terms.replace('net', 'Net ')}`,
            tone: user.balance > 0 ? 'warn' : 'ok',
            icon: Wallet,
          },
          {
            key: 'store-credit',
            // Store credit: what the business already holds.
            label: 'Store credit',
            value: money(user.storeCredit ?? 0),
            hint: 'Held by this account, spends at checkout',
            tone: 'ok',
            icon: WalletCards,
          },
          {
            key: 'outstanding',
            label: 'Outstanding',
            value: money(outstanding),
            hint: 'Unpaid on issued invoices',
            tone: outstanding > 0 ? 'danger' : 'ok',
            icon: FileText,
          },
        ]}
      />

      <div className="scroll-slim mb-4 flex gap-1.5 overflow-x-auto border-b border-line pb-0">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? 'page' : undefined}
            className={cn(
              'relative shrink-0 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors',
              tab === item.key ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700',
            )}
          >
            {item.label}
            {tab === item.key && (
              <span
                className="rule-brand-gradient absolute inset-x-0 -bottom-px h-0.5"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Account">
            <dl className="space-y-2.5 text-[13px]">
              {[
                ['Business', user.businessName],
                ['Contact', user.contactName],
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

          <Panel title="Recent activity" description="The last few things to happen on this account">
            {orders.length === 0 && invoices.length === 0 ? (
              <PanelEmpty icon={Building2} title="Nothing yet" body="No orders or invoices." />
            ) : (
              <ul className="space-y-2">
                {orders.slice(0, 3).map((order) => (
                  <li key={order.orderNumber} className="flex items-center gap-2.5 text-[12.5px]">
                    <Package className="size-3.5 shrink-0 text-info" strokeWidth={2} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-ink-700">
                      Order {order.orderNumber}
                    </span>
                    <span className="tnum shrink-0 text-ink-400">{date(order.createdAt)}</span>
                  </li>
                ))}
                {invoices.slice(0, 3).map((invoice) => (
                  <li key={invoice.number} className="flex items-center gap-2.5 text-[12.5px]">
                    <Receipt className="size-3.5 shrink-0 text-brand" strokeWidth={2} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-ink-700">
                      Invoice {invoice.number}
                    </span>
                    <span className="tnum shrink-0 text-ink-400">{money(invoice.amount)}</span>
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
            <dl className="space-y-2 text-[12.5px]">
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
                  <code className="font-mono text-[12px] font-semibold">{user.referralCode}</code>
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
              <p className="py-3 text-[12.5px] text-ink-400">Nothing logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {messages.slice(0, 3).map((message) => (
                  <li key={message.id} className="flex items-start gap-2.5 text-[12.5px]">
                    <MessageCircle
                      className="mt-0.5 size-3.5 shrink-0 text-ink-300"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink-700">{message.body}</span>
                      <span className="text-[11.5px] text-ink-400">
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
              <p className="py-3 text-[12.5px] text-ink-400">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {notes.slice(0, 3).map((note) => (
                  <li key={note.id} className="text-[12.5px]">
                    <p className="line-clamp-2 text-ink-700">{note.body}</p>
                    <p className="text-[11.5px] text-ink-400">
                      {note.staffName} · {date(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SummaryPanel>
        </div>
      )}

      {tab === 'conversations' && (
        <ConversationsPanel
          messages={messages}
          isLoading={messagesLoading}
          isPending={sendMessage.isPending}
          error={sendMessage.error?.message}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          onLog={logInteraction}
        />
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
        <Panel flush>
          <DataTable
            columns={[
              {
                key: 'orderNumber',
                header: 'Order',
                priority: 1,
                render: (order) => (
                  <span className="whitespace-nowrap font-mono text-[12.5px] font-medium text-ink-900">
                    {order.orderNumber}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                header: 'Placed',
                priority: 2,
                render: (order) => (
                  <span className="text-[12.5px] text-ink-500">{date(order.createdAt)}</span>
                ),
              },
              {
                key: 'items',
                header: 'Items',
                priority: 3,
                align: 'right',
                className: 'tnum',
                sortValue: (order) => order.items.length,
                render: (order) => order.items.length,
              },
              {
                key: 'status',
                header: 'Status',
                priority: 1,
                render: (order) => <OrderStatusBadge status={order.status} size="sm" />,
              },
              {
                key: 'total',
                header: 'Total',
                priority: 1,
                align: 'right',
                className: 'tnum font-medium text-ink-900',
                render: (order) => money(order.total),
              },
            ]}
            rows={orders}
            rowKey={(order) => order.orderNumber}
            defaultSort={{ key: 'createdAt', direction: 'desc' }}
            empty={<PanelEmpty icon={Package} title="No orders" body="This account has not ordered yet." />}
          />
        </Panel>
      )}

      {tab === 'invoices' && (
        <Panel flush>
          <DataTable
            columns={[
              {
                key: 'number',
                header: 'Invoice',
                priority: 1,
                render: (invoice) => (
                  <span className="whitespace-nowrap font-mono text-[12.5px] font-medium text-ink-900">
                    {invoice.number}
                  </span>
                ),
              },
              {
                key: 'dueDate',
                header: 'Due',
                priority: 2,
                render: (invoice) => (
                  <span className="text-[12.5px] text-ink-500">
                    {invoice.dueDate ? date(invoice.dueDate) : '—'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                priority: 1,
                render: (invoice) => <InvoiceStatusBadge status={invoice.status} size="sm" />,
              },
              {
                key: 'balance',
                header: 'Balance',
                priority: 1,
                align: 'right',
                className: 'tnum',
                render: (invoice) => (
                  <>
                    <span className="text-[13px] font-medium text-ink-900">
                      {money(invoice.balance)}
                    </span>
                    <span className="block text-[11px] text-ink-400">of {money(invoice.amount)}</span>
                  </>
                ),
              },
            ]}
            rows={invoices}
            rowKey={(invoice) => invoice.number}
            empty={<PanelEmpty icon={FileText} title="No invoices" body="Nothing has been invoiced yet." />}
            footer={
              <div className="border-t border-line px-4 py-2.5">
                <Link
                  to={`/admin/invoices?q=${encodeURIComponent(user.businessName)}`}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
                >
                  Open in Invoices to record a payment
                  <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            }
          />
        </Panel>
      )}

      {tab === 'credit' && (
        // Two instruments, kept visually apart (Instructions): the line of
        // credit is what Cellvix lends, store credit is what the business holds.
        <div className="grid gap-4 lg:grid-cols-2">
          <CreditForm id={id} user={user} />
          <StoreCreditPanel id={id} balance={user.storeCredit} />
        </div>
      )}

      {tab === 'quotes' && <PendingTab icon={FileText} title="Quotes arrive in phase 7" phase={7} />}
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
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink-900">{event.title}</span>
                      {event.detail && (
                        <span className="block text-[11.5px] text-ink-400">{event.detail}</span>
                      )}
                    </span>
                    {event.amount != null && (
                      <span className="tnum shrink-0 text-[12.5px] font-medium text-ink-700">
                        {money(Math.abs(event.amount))}
                      </span>
                    )}
                    <span className="tnum hidden shrink-0 text-[11.5px] text-ink-400 sm:block">
                      {dateTime(event.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}

export default AdminClientProfilePage;
