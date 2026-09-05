import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ClipboardList,
  Clock,
  Send,
  Truck,
  XCircle,
} from 'lucide-react';
import { money, date, dateTime, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import { useTableClasses } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminRfq, useAdminMutations } from '@/hooks/useAdmin';
import { toast } from '@/store/toastStore';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';

/**
 * One request for quote: who was asked, what came back, and which answer wins
 * (§6.8a).
 *
 * **The comparison matrix is the screen.** One row per requested part, one
 * column per supplier who answered, so the cheapest price on each line is
 * visible without arithmetic — and so is the supplier who is cheapest overall
 * but dearest on the line you actually care about. A list of quote totals could
 * not show that, which is why this is a table and not a set of cards.
 *
 * Two things it deliberately marks rather than hides:
 *
 *   - **A cheapest cell is not a winner.** The per-line minimum is highlighted,
 *     but the award is made on a whole quote, because splitting an order across
 *     two suppliers to save four dollars a line costs two deliveries.
 *   - **An incomplete quote never ranks best.** A supplier who could not
 *     supply three of the ten lines has a smaller total for a smaller order,
 *     and presenting that as the best price is how the wrong one gets chosen.
 *     The server marks it incomplete; this screen says so in the column head.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/rfqs/:id'], icon: adminIcon('Send') };

const STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  awarded: 'ok',
  cancelled: 'danger',
};

const INVITE_TONES = {
  invited: 'neutral',
  viewed: 'info',
  quoted: 'brand',
  declined: 'danger',
  won: 'ok',
  lost: 'neutral',
};

const INVITE_LABELS = {
  invited: 'asked',
  viewed: 'opened it',
  quoted: 'quoted',
  declined: 'declined',
  won: 'won',
  lost: 'not chosen',
};

export function AdminRfqDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useTableClasses();

  const { data, isLoading } = useAdminRfq(id);
  const { sendRfq, awardRfq, cancelRfq } = useAdminMutations();

  /** The quote awaiting confirmation. Awarding commits money — it asks first. */
  const [awarding, setAwarding] = useState(null);

  const rfq = data?.rfq;

  if (isLoading) {
    return (
      <Panel>
        <p className="text-sm text-ink-400">Loading…</p>
      </Panel>
    );
  }

  if (!rfq) {
    return (
      <PanelEmpty
        icon={Send}
        title="Request not found"
        body="It may have been cancelled, or the link is wrong."
      />
    );
  }

  const quoted = rfq.invites.filter((invite) => invite.status === 'quoted' || invite.status === 'won' || invite.status === 'lost');
  const answered = quoted.filter((invite) => invite.lines.length);

  /** Cheapest available price per SKU, for the highlight. */
  const bestPerSku = new Map();
  for (const item of rfq.items) {
    let best = null;
    for (const invite of answered) {
      const line = invite.lines.find((candidate) => candidate.sku === item.sku);
      if (!line || !line.available) continue;
      if (best === null || line.unitCost < best) best = line.unitCost;
    }
    if (best !== null) bestPerSku.set(item.sku, best);
  }

  function send() {
    sendRfq.mutate(
      { id: rfq.id },
      {
        onSuccess: (result) => {
          if (result.failed.length) {
            toast.error(
              `${result.failed.length} supplier(s) were not reached`,
              `${result.failed.map((entry) => entry.supplier).join(', ')} — check their email address. The others have it.`,
            );
          } else {
            toast.ok(`${rfq.rfqNumber} is out for quote`, `${result.sent.length} supplier(s) have been asked.`);
          }
        },
        onError: (error) => toast.error('Nothing was sent', error.message),
      },
    );
  }

  /**
   * Accept a quote, and report what could not be ordered.
   *
   * A supplier who marked three lines unavailable gets a purchase order for the
   * rest; those three are dropped rather than ordered from somebody who said
   * they did not have them. The clerk has to be told, or the parts silently
   * never arrive.
   */
  function award(invite) {
    awardRfq.mutate(
      { id: rfq.id, inviteId: invite.id },
      {
        onSuccess: (result) => {
          setAwarding(null);
          if (result.dropped.length) {
            toast.error(
              `${result.purchaseOrder.poNumber} raised, ${result.dropped.length} line(s) left out`,
              `${invite.supplier.name} could not supply ${result.dropped.map((line) => line.sku).join(', ')}. Raise a second request for those.`,
            );
          } else {
            toast.ok(
              `${result.purchaseOrder.poNumber} raised`,
              `${invite.supplier.name} has been told, and so have the others.`,
            );
          }
          navigate(`/admin/purchase-orders/${result.purchaseOrder.id}`);
        },
        onError: (error) => {
          setAwarding(null);
          toast.error('Nothing was awarded', error.message);
        },
      },
    );
  }

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={rfq.rfqNumber}
        description={rfq.title || 'Request for quote'}
        action={
          <>
            <Link
              to="/admin/rfqs"
              className={cn(
                pressable,
                'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2',
              )}
            >
              <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Back
            </Link>

            {rfq.status === 'draft' && (
              <Button icon={Send} loading={sendRfq.isPending} onClick={send} disabled={!rfq.inviteCount}>
                Send to {formatCount(rfq.inviteCount)} supplier{rfq.inviteCount === 1 ? '' : 's'}
              </Button>
            )}

            {rfq.status === 'awarded' && rfq.purchaseOrder && (
              <Link
                to={`/admin/purchase-orders/${rfq.purchaseOrder}`}
                className={cn(
                  pressable,
                  'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md bg-brand-gradient px-5 font-display text-md font-semibold text-white',
                )}
              >
                <ClipboardList className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                Open the purchase order
              </Link>
            )}
          </>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'status',
            label: 'Status',
            value: rfq.status === 'sent' ? 'Out for quote' : rfq.status,
            hint: rfq.closesAt ? `${rfq.closed ? 'Closed' : 'Closes'} ${date(rfq.closesAt)}` : 'No closing date',
            tone: STATUS_TONES[rfq.status],
            icon: Send,
          },
          {
            key: 'asked',
            label: 'Suppliers asked',
            value: formatCount(rfq.inviteCount),
            hint: `${rfq.quoteCount} have answered`,
            tone: 'info',
            icon: Truck,
          },
          {
            key: 'lines',
            label: 'Lines',
            value: formatCount(rfq.itemCount),
            hint: 'Parts on this request',
            tone: 'neutral',
            icon: ClipboardList,
          },
          {
            key: 'best',
            label: 'Best complete quote',
            value: (() => {
              const best = rfq.invites.find((invite) => invite.isBest);
              return best ? money(best.total) : '—';
            })(),
            hint:
              rfq.invites.find((invite) => invite.isBest)?.supplier.name ??
              'Nobody has priced every line yet',
            tone: 'brand',
            icon: Award,
          },
        ]}
      />

      {/* ---- the comparison ------------------------------------------------ */}

      <Panel title="Quotes side by side" flush className="mb-3">
        {!answered.length ? (
          <PanelEmpty
            icon={Clock}
            title={rfq.status === 'draft' ? 'Not sent yet' : 'No prices back yet'}
            body={
              rfq.status === 'draft'
                ? 'Send this request and the suppliers you picked can price it in their portal.'
                : 'The suppliers have been asked. Their prices appear here as they answer.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={t.headRow}>
                  <th scope="col" className={cn(t.headCell(), 'min-w-50')}>
                    Part
                  </th>
                  <th scope="col" className={cn(t.headCell('right'), 'w-20')}>
                    Qty
                  </th>
                  {answered.map((invite) => (
                    <th key={invite.id} scope="col" className={cn(t.headCell('right'), 'min-w-32')}>
                      <span className="block truncate font-semibold text-ink-900">
                        {invite.supplier.name}
                      </span>
                      {/* Why a cheaper total may not be the better offer. */}
                      {!invite.complete && (
                        <span className="block text-2xs font-normal text-warn">
                          {invite.quotedLines} of {rfq.itemCount} lines
                        </span>
                      )}
                      {invite.leadTimeDays != null && (
                        <span className="block text-2xs font-normal text-ink-400">
                          {invite.leadTimeDays} day lead
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rfq.items.map((item) => (
                  <tr key={item.sku} className={t.row}>
                    <td className={t.cell()}>
                      <span className="block truncate text-sm text-ink-900">{item.name}</span>
                      <span className="block font-mono text-2xs text-ink-400">{item.sku}</span>
                    </td>
                    <td className={cn(t.cell('right'), 'tnum text-sm text-ink-500')}>{item.qty}</td>

                    {answered.map((invite) => {
                      const line = invite.lines.find((candidate) => candidate.sku === item.sku);

                      if (!line || !line.available) {
                        return (
                          <td key={invite.id} className={cn(t.cell('right'), 'text-xs text-ink-300')}>
                            {line ? 'cannot supply' : '—'}
                          </td>
                        );
                      }

                      const isCheapest = bestPerSku.get(item.sku) === line.unitCost;

                      return (
                        <td key={invite.id} className={cn(t.cell('right'), 'tnum')}>
                          <span
                            className={cn(
                              'text-sm',
                              isCheapest ? 'font-semibold text-ok' : 'text-ink-900',
                            )}
                          >
                            {money(line.unitCost)}
                          </span>
                          <span className="block text-2xs text-ink-400">
                            {money(line.lineTotal)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className={t.row}>
                  <td className={cn(t.cell(), 'font-display text-sm font-semibold text-ink-900')}>
                    Shipping
                  </td>
                  <td className={t.cell('right')} />
                  {answered.map((invite) => (
                    <td key={invite.id} className={cn(t.cell('right'), 'tnum text-sm text-ink-500')}>
                      {money(invite.shipping)}
                    </td>
                  ))}
                </tr>

                <tr className="border-t-2 border-line">
                  <td className={cn(t.cell(), 'font-display text-md font-bold text-ink-900')}>
                    Total
                  </td>
                  <td className={t.cell('right')} />
                  {answered.map((invite) => (
                    <td key={invite.id} className={cn(t.cell('right'), 'tnum')}>
                      <span
                        className={cn(
                          'font-display text-md font-bold',
                          invite.isBest ? 'text-ok' : 'text-ink-900',
                        )}
                      >
                        {money(invite.total)}
                      </span>
                      {invite.isBest && (
                        <span className="block text-2xs font-semibold text-ok">best complete</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* The award row. One button per column, so choosing is the same
                    gesture as reading — no second screen, no re-finding the
                    supplier whose number you just compared. */}
                {rfq.status === 'sent' && (
                  <tr>
                    <td className={t.cell()} colSpan={2} />
                    {answered.map((invite) => (
                      <td key={invite.id} className={cn(t.cell('right'))}>
                        <Button
                          size="sm"
                          variant={invite.isBest ? 'primary' : 'outline'}
                          icon={Award}
                          onClick={() => setAwarding(invite)}
                        >
                          Award
                        </Button>
                      </td>
                    ))}
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      {/* ---- who was asked -------------------------------------------------- */}

      <div className="grid items-start gap-3 lg:grid-cols-[1fr_minmax(0,340px)]">
        <Panel title="Suppliers asked" flush>
          <ul className="divide-y divide-line">
            {rfq.invites.map((invite) => (
              <li key={invite.id} className="flex items-start gap-3 p-3 sm:px-4">
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/admin/suppliers/${invite.supplier.id}`}
                    className="block truncate font-display text-sm font-semibold text-ink-900 hover:underline"
                  >
                    {invite.supplier.name}
                  </Link>
                  <span className="block truncate text-xs text-ink-400">
                    {invite.supplier.email ?? 'No email on file'}
                  </span>

                  {/* The history of this one supplier's participation. "Opened
                      it three days ago and has not answered" is a different
                      conversation from "never opened it", and both are worth a
                      phone call for different reasons. */}
                  <span className="mt-1 block text-2xs text-ink-400">
                    {invite.quotedAt
                      ? `Quoted ${dateTime(invite.quotedAt)}`
                      : invite.viewedAt
                        ? `Opened ${dateTime(invite.viewedAt)}, no price yet`
                        : invite.sentAt
                          ? `Asked ${dateTime(invite.sentAt)}, not opened`
                          : 'Not sent yet'}
                  </span>

                  {invite.declineReason && (
                    <span className="mt-1 block text-2xs text-danger">
                      “{invite.declineReason}”
                    </span>
                  )}
                  {invite.note && (
                    <span className="mt-1 block text-2xs text-ink-500">“{invite.note}”</span>
                  )}
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={INVITE_TONES[invite.status]} size="sm">
                    {INVITE_LABELS[invite.status]}
                  </Badge>
                  {invite.status === 'quoted' && (
                    <span className="tnum text-sm font-medium text-ink-900">
                      {money(invite.total)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-3">
          <Panel title="Request">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Raised</dt>
                <dd className="text-ink-900">{date(rfq.createdAt)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Closes</dt>
                <dd className={cn(rfq.closed ? 'font-medium text-danger' : 'text-ink-900')}>
                  {rfq.closesAt ? date(rfq.closesAt) : '—'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Component types</dt>
                <dd className="max-w-45 text-right text-ink-900">
                  {rfq.componentTypes.length ? rfq.componentTypes.join(', ') : '—'}
                </dd>
              </div>
            </dl>

            {rfq.notes && (
              <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-500">
                {rfq.notes}
              </p>
            )}

            {['draft', 'sent'].includes(rfq.status) && (
              <Button
                variant="outline"
                icon={XCircle}
                fullWidth
                className="mt-3"
                loading={cancelRfq.isPending}
                onClick={() =>
                  cancelRfq.mutate(
                    { id: rfq.id },
                    {
                      onSuccess: () => toast.ok(`${rfq.rfqNumber} cancelled`),
                      onError: (error) => toast.error('It was not cancelled', error.message),
                    },
                  )
                }
              >
                Cancel this request
              </Button>
            )}
          </Panel>

          <Panel title="History" flush>
            <ol className="divide-y divide-line">
              {rfq.timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex items-start gap-2.5 p-3 sm:px-4">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-ink-300"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink-900">{entry.note ?? entry.status}</span>
                    <span className="block text-2xs text-ink-400">{dateTime(entry.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {/* Awarding raises a purchase order and emails every supplier who quoted,
          winner and losers. That is not undoable from a menu, so it asks. */}
      <ConfirmDialog
        open={Boolean(awarding)}
        onClose={() => setAwarding(null)}
        onConfirm={() => award(awarding)}
        title={`Award ${rfq.rfqNumber} to ${awarding?.supplier.name ?? ''}?`}
        body={
          awarding && (
            <>
              <p>
                This raises a purchase order for {money(awarding.total)} and marks it sent.{' '}
                {awarding.supplier.name} will be told they won; everybody else who quoted will be
                told they did not.
              </p>
              {!awarding.complete && (
                <p className="mt-2 flex items-start gap-2 rounded-md bg-warn-50 px-3 py-2.5 text-warn">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  They priced {awarding.quotedLines} of {rfq.itemCount} lines. The rest will not be
                  ordered — raise a second request for those.
                </p>
              )}
            </>
          )
        }
        confirmLabel="Award and raise the PO"
        // `info`, not `danger`: this commits an order rather than destroying a
        // record, and a red dialog for a routine purchasing decision is the
        // kind of false alarm that teaches people to click through real ones.
        tone="info"
        loading={awardRfq.isPending}
      />
    </>
  );
}

export default AdminRfqDetailPage;
