import { useState } from 'react';
import {
  AlertCircle,
  Check,
  FileText,
  MessageSquare,
  Send,
  Trash2,
  Trophy,
  Truck,
  UserPlus,
} from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import ActionMenu from '@/components/ui/ActionMenu';
import { toast } from '@/store/toastStore';
import { apiUrl } from '@/lib/api';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';
import {
  useAdminPoBids,
  useSuppliersForComponentTypes,
  useAdminMutations,
} from '@/hooks/useAdmin';

/**
 * Every supplier this purchase order was put to, and what they came back with
 * (§6.8a).
 *
 * **The comparison is the point of this panel.** One row per supplier, sorted
 * so the answer that should win is at the top — and `isBest` is the server's
 * ranking, not this component's, because "cheapest complete bid" is a rule and
 * a rule belongs in one place. An incomplete bid is marked as such rather than
 * ranked: a supplier who cannot fill every line has a smaller total for a
 * smaller order, and letting that sort to the top is exactly how the
 * cheapest-looking answer turns out not to cover the order.
 *
 * Sits above `Lines` because it is the live question while an order is open:
 * the lines say what was asked for, and until somebody is confirmed the prices
 * on them are zero.
 */

const BID_TONES = {
  invited: 'neutral',
  viewed: 'warn',
  quoted: 'info',
  negotiating: 'brand',
  confirmed: 'ok',
  declined: 'neutral',
  lost: 'neutral',
};

const BID_LABELS = {
  invited: 'not opened',
  viewed: 'opened',
  quoted: 'quoted',
  negotiating: 'negotiating',
  confirmed: 'confirmed',
  declined: 'declined',
  lost: 'not chosen',
};

const DELIVERY_LABELS = {
  pending: 'not dispatched',
  preparing: 'preparing',
  dispatched: 'dispatched',
  in_transit: 'in transit',
  delivered: 'delivered',
};

/**
 * One supplier's answer.
 *
 * **A card, not a table row** — and the reason is what this panel is for. A
 * table compares uniform rows of the same few values; this compares *offers*,
 * and an offer is a bundle of facts that belong together: who, at what price,
 * how soon, how much of the order they can actually fill, and what paperwork
 * they have raised. Squeezed into six fixed columns those facts were 19px wider
 * than the panel — so the whole comparison scrolled sideways — and Status was
 * carrying four different kinds of note in 141px.
 *
 * Cards also let the **money be the size it deserves**. The total is the number
 * an operator is comparing, and in a table cell it was 13px of tabular text
 * indistinguishable from the lead time beside it.
 *
 * The list is short by nature — a handful of suppliers carry any one component
 * type — which is the same argument the Businesses screen makes for cards over
 * a table at low row counts.
 */
function BidCard({ bid, order, lineCount, canAct, onNegotiate, onConfirm, onRemove, removing }) {
  const answered = ['quoted', 'negotiating'].includes(bid.status);
  const priced = answered || bid.status === 'confirmed';
  const settled = ['declined', 'lost'].includes(bid.status);

  // Computed once and used both to decide whether the notes row exists and to
  // render each note, so the wrapper can never appear around nothing.
  const showsShortfall = answered && !bid.complete;
  const showsProforma = Boolean(bid.proforma);
  const showsDelivery = Boolean(bid.delivery) && bid.status === 'confirmed';
  const showsDecline = bid.status === 'declined' && Boolean(bid.declineReason);

  return (
    <li
      className={cn(
        'rounded-lg border bg-surface p-3.5',
        // The leading answer gets the only coloured edge on the list. Everything
        // else is quiet, which is what makes it findable at a glance.
        bid.isBest ? 'border-ok/40' : 'border-line',
        settled && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-display text-md font-semibold text-ink-900">
              {bid.supplier.name}
            </span>
            {/* The server's ranking, not ours. Only ever set on a complete answer. */}
            {bid.isBest && (
              <Badge tone="ok" size="sm" icon={Trophy}>
                best
              </Badge>
            )}
            <Badge tone={BID_TONES[bid.status]} size="sm">
              {BID_LABELS[bid.status]}
            </Badge>
          </div>

          {bid.supplier.email && (
            <a
              href={`mailto:${bid.supplier.email}`}
              onClick={(event) => event.stopPropagation()}
              className="mt-0.5 block truncate text-xs text-ink-400 hover:text-brand hover:underline"
            >
              {bid.supplier.email}
            </a>
          )}
        </div>

        {/* The figure being compared, at the size that says so. */}
        <div className="shrink-0 text-right">
          {priced ? (
            <>
              <p className="tnum font-display text-lg font-bold leading-none text-ink-900">
                {money(bid.total)}
              </p>
              {bid.leadTimeDays != null && (
                <p className="mt-1 text-xs text-ink-400">{bid.leadTimeDays} day lead time</p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-300">No price yet</p>
          )}
        </div>

        {canAct && (
          <ActionMenu
            align="right"
            label={`Actions for ${bid.supplier.name}`}
            items={[
              {
                key: 'negotiate',
                label: 'Negotiate…',
                icon: MessageSquare,
                hidden: !answered,
                onSelect: onNegotiate,
              },
              {
                key: 'confirm',
                label: 'Confirm this supplier',
                icon: Check,
                hidden: !answered,
                onSelect: onConfirm,
              },
              {
                key: 'remove',
                label: 'Remove from order',
                icon: Trash2,
                danger: true,
                disabled: removing,
                hidden: answered || bid.status === 'declined',
                onSelect: onRemove,
              },
            ]}
          />
        )}
      </div>

      {/* The notes that were fighting for room inside a 141px Status cell. Each
          is a different kind of fact and only ever one or two apply at once.

          **Each condition below is spelled out identically to the one guarding
          its row.** They started as looser tests — `bid.delivery` rather than
          `showsDelivery` — and a losing bid carries a default `delivery` object
          from the schema, so the wrapper rendered its top border and padding
          around content that was then filtered out: an empty ruled strip under
          every supplier who was not chosen. */}
      {(showsShortfall || showsProforma || showsDelivery || showsDecline) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-2.5 text-xs">
          {/* An incomplete answer is called out rather than ranked — the whole
              reason the comparison can be trusted. */}
          {showsShortfall && (
            <span className="flex items-center gap-1 font-medium text-warn">
              <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              Can supply {formatCount(bid.quotedLines)} of {formatCount(lineCount)} lines
            </span>
          )}

          {showsProforma && (
            <a
              href={apiUrl(
                `/admin/purchase-orders/${order.id}/bids/${bid.supplier.id}/proforma`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                pressable,
                'flex items-center gap-1 font-medium text-ink-700 hover:text-brand hover:underline',
              )}
            >
              <FileText className="size-3.5 shrink-0 text-ink-400" strokeWidth={2.25} aria-hidden="true" />
              Proforma {bid.proforma.number || `rev ${bid.proforma.revision}`}
              <span className="tnum text-ink-400">· {money(bid.proforma.total)}</span>
            </a>
          )}

          {showsDelivery && (
            <span className="flex items-center gap-1 text-ink-500">
              <Truck className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              {DELIVERY_LABELS[bid.delivery.status] ?? bid.delivery.status}
              {bid.delivery.trackingNumber && (
                <span className="font-mono text-ink-400">· {bid.delivery.trackingNumber}</span>
              )}
            </span>
          )}

          {showsDecline && (
            <span className="min-w-0 flex-1 truncate text-ink-400">“{bid.declineReason}”</span>
          )}
        </div>
      )}
    </li>
  );
}

export function PurchaseBidsPanel({ order }) {
  const { data, isLoading } = useAdminPoBids(order.id);
  const {
    invitePoSuppliers,
    removePoSupplier,
    sendPurchaseOrder,
    negotiatePoBid,
    confirmPoSupplier,
  } = useAdminMutations();

  const [adding, setAdding] = useState(false);
  const [negotiating, setNegotiating] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState(null);

  const board = data;
  const bids = board?.bids ?? [];

  // Editable while the order is still being decided. Past `confirmed` the
  // supplier panel is a record of what happened, not a set of controls.
  const open = ['draft', 'sent', 'negotiating'].includes(order.status);
  const isDraft = order.status === 'draft';

  if (isLoading) {
    return (
      <Panel title="Suppliers" flush>
        <div className="p-4">
          <Skeleton className="h-24" rounded="lg" />
        </div>
      </Panel>
    );
  }

  function send() {
    setError(null);
    sendPurchaseOrder.mutate(
      { id: order.id },
      {
        onSuccess: (result) =>
          toast.ok(
            'Sent',
            result.mailed === result.total
              ? `All ${formatCount(result.total)} supplier(s) were emailed.`
              : `${formatCount(result.mailed)} of ${formatCount(result.total)} were emailed — check the addresses on the rest.`,
          ),
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <>
      <Panel
        title="Suppliers"
        description={
          isDraft
            ? 'Who this order will go to. Nothing reaches them until it is sent.'
            : `${formatCount(board?.quoteCount ?? 0)} of ${formatCount(bids.length)} have answered.`
        }
        flush
        action={
          open ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" icon={UserPlus} onClick={() => setAdding(true)}>
                Add suppliers
              </Button>
              {isDraft && (
                <Button
                  size="sm"
                  icon={Send}
                  loading={sendPurchaseOrder.isPending}
                  disabled={!bids.length}
                  onClick={send}
                >
                  Send to {formatCount(bids.length)}
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {error && (
          <p className="flex items-start gap-2 border-b border-line bg-danger-50 px-3 py-2.5 text-sm text-danger sm:px-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {error}
          </p>
        )}

        {!bids.length ? (
          <PanelEmpty
            icon={UserPlus}
            title="Nobody has been asked yet"
            body="Add the suppliers who carry these parts, then send the order to collect their prices."
            action={
              <Button size="sm" icon={UserPlus} onClick={() => setAdding(true)}>
                Add suppliers
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2 p-3 sm:p-4">
            {bids.map((bid) => (
              <BidCard
                key={bid.id}
                bid={bid}
                order={order}
                lineCount={order.items.length}
                canAct={open}
                removing={removePoSupplier.isPending}
                onNegotiate={() => setNegotiating(bid)}
                onConfirm={() => setConfirming(bid)}
                onRemove={() =>
                  removePoSupplier.mutate(
                    { id: order.id, supplierId: bid.supplier.id },
                    { onError: (err) => setError(err.message) },
                  )
                }
              />
            ))}
          </ul>
        )}

        {/* The negotiation history, under the table rather than inside a row:
            it is a conversation, and a conversation does not fit in a cell. */}
        {bids.some((bid) => bid.negotiations?.length > 0) && (
          <div className="border-t border-line px-3 py-3 sm:px-4">
            <p className="eyebrow mb-2 text-ink-400">Negotiation history</p>
            <ul className="space-y-1.5">
              {bids.flatMap((bid) =>
                (bid.negotiations ?? []).map((round) => (
                  <li key={`${bid.id}-${round.round}`} className="text-sm text-ink-700">
                    <span className="font-medium text-ink-900">{bid.supplier.name}</span>
                    {' · round '}
                    {round.round}
                    {round.askedTotal != null && (
                      <>
                        {' · asked '}
                        <span className="tnum font-medium">{money(round.askedTotal)}</span>
                      </>
                    )}
                    {round.theirCounter != null && (
                      <>
                        {' against '}
                        <span className="tnum">{money(round.theirCounter)}</span>
                      </>
                    )}
                    <span className="text-ink-400">
                      {' · '}
                      {date(round.at)}
                      {round.channels?.length ? ` · ${round.channels.join(', ')}` : ''}
                      {round.respondedAt ? ' · answered' : ' · awaiting reply'}
                    </span>
                    {round.note && (
                      <span className="block text-xs text-ink-500">{round.note}</span>
                    )}
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
      </Panel>

      <AddSuppliersModal
        open={adding}
        onClose={() => setAdding(false)}
        order={order}
        existing={bids.map((bid) => bid.supplier.id)}
        invite={invitePoSuppliers}
      />

      <NegotiateModal
        bid={negotiating}
        order={order}
        onClose={() => setNegotiating(null)}
        negotiate={negotiatePoBid}
      />

      <ConfirmModal
        bid={confirming}
        order={order}
        onClose={() => setConfirming(null)}
        confirm={confirmPoSupplier}
      />
    </>
  );
}

/**
 * Pick who to ask.
 *
 * **Tag-suggested and pre-ticked, with a free search underneath.** The suggested
 * set is every active supplier carrying one of the order's component types —
 * which is the question a purchasing clerk actually has ("who sells batteries")
 * — and the search is there because the answer is a default, not a rule.
 */
function AddSuppliersModal({ open, onClose, order, existing, invite }) {
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState(null);

  const { data, isLoading } = useSuppliersForComponentTypes(order.componentTypes ?? []);
  const suggested = (data?.suppliers ?? []).filter(
    (supplier) => !existing.includes(supplier.id),
  );

  function toggle(id) {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function submit() {
    setError(null);
    if (!picked.length) {
      setError('Pick at least one supplier.');
      return;
    }
    invite.mutate(
      { id: order.id, supplierIds: picked },
      {
        onSuccess: (result) => {
          setPicked([]);
          onClose();
          toast.ok(
            'Added',
            order.status === 'draft'
              ? `${formatCount(result.added)} supplier(s) will be asked when you send this order.`
              : `${formatCount(result.added)} supplier(s) were emailed.`,
          );
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Add suppliers" size="md" align="top">
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      {!order.componentTypes?.length ? (
        <p className="text-sm text-ink-500">
          This order carries no component types, so there is nobody to suggest. Add them to the
          order first.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-32" rounded="lg" />
      ) : !suggested.length ? (
        <p className="text-sm text-ink-500">
          Every supplier tagged with these component types is already on this order.
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-500">
            Suppliers tagged with {order.componentTypes.join(', ')}.
          </p>
          <ul className="space-y-1.5">
            {suggested.map((supplier) => {
              const on = picked.includes(supplier.id);
              return (
                <li key={supplier.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(supplier.id)}
                    className={cn(
                      pressable,
                      'flex w-full items-start gap-2.5 rounded-md border p-3 text-left',
                      on
                        ? 'border-ok/40 bg-ok-50'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                        on ? 'border-ok bg-ok text-white' : 'border-line-strong',
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {supplier.name}
                      </span>
                      <span className="block truncate text-xs text-ink-400">
                        {supplier.matched.join(', ')}
                        {/* A supplier with no portal login can still be asked —
                            the mail carries the lines — but the screen should
                            say so rather than let a clerk expect a price that
                            has nowhere to be typed. */}
                        {!supplier.hasPortal && ' · no portal access'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button icon={UserPlus} loading={invite.isPending} onClick={submit}>
          Add {picked.length ? formatCount(picked.length) : ''}
        </Button>
      </div>
    </Modal>
  );
}

/** Ask a supplier to move on their price. */
function NegotiateModal({ bid, order, onClose, negotiate }) {
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  if (!bid) return null;

  function submit() {
    setError(null);
    const askedTotal = target.trim() === '' ? undefined : Math.round(Number(target) * 100);
    if (askedTotal != null && !Number.isFinite(askedTotal)) {
      setError('That is not an amount.');
      return;
    }

    negotiate.mutate(
      { id: order.id, supplierId: bid.supplier.id, askedTotal, note: note || undefined },
      {
        onSuccess: () => {
          setTarget('');
          setNote('');
          onClose();
          toast.ok('Sent', `${bid.supplier.name} has been asked to revise their price.`);
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Modal
      open={Boolean(bid)}
      onClose={onClose}
      title={`Negotiate with ${bid.supplier.name}`}
      size="sm"
      align="top"
    >
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <p className="mb-3 text-sm text-ink-500">
        They quoted <span className="tnum font-semibold text-ink-900">{money(bid.total)}</span>.
      </p>

      <Input
        label="Your target"
        inputMode="decimal"
        suffix="$"
        placeholder="0.00"
        hint="Optional — a number gives them something specific to answer."
        value={target}
        onChange={(event) => setTarget(event.target.value)}
      />

      <Textarea
        label="Message"
        rows={3}
        placeholder="Volume is firm at these quantities — is there any movement on the unit price?"
        containerClassName="mt-3"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        Sent by email, plus any other channel they have consented to. We record which ones actually
        carried it.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button icon={MessageSquare} loading={negotiate.isPending} onClick={submit}>
          Send
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Confirm the order with one supplier.
 *
 * Says plainly what it will do, because it is the irreversible step: the other
 * suppliers are told they were not chosen, and any line the winner cannot
 * supply leaves the order rather than sitting on it at a price nobody quoted.
 */
function ConfirmModal({ bid, order, onClose, confirm }) {
  const [error, setError] = useState(null);

  if (!bid) return null;

  const missing = order.items.length - bid.quotedLines;

  function submit() {
    setError(null);
    confirm.mutate(
      { id: order.id, supplierId: bid.supplier.id },
      {
        onSuccess: (result) => {
          onClose();
          toast.ok(
            'Confirmed',
            result.dropped?.length
              ? `Order placed with ${bid.supplier.name}. ${formatCount(result.dropped.length)} line(s) they could not supply were removed.`
              : `Order placed with ${bid.supplier.name}.`,
          );
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Modal
      open={Boolean(bid)}
      onClose={onClose}
      title={`Confirm with ${bid.supplier.name}?`}
      size="sm"
      align="top"
    >
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <p className="text-sm leading-relaxed text-ink-700">
        This places the order with {bid.supplier.name} at{' '}
        <span className="tnum font-semibold text-ink-900">{money(bid.total)}</span>, prices its
        lines from their quote, and tells every other supplier they were not chosen.
      </p>

      {missing > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-warn-50 px-3 py-2.5 text-sm text-warn">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          They cannot supply {formatCount(missing)} of the {formatCount(order.items.length)} lines.
          Those lines will be removed from this order — raise a second one for them.
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button icon={Check} loading={confirm.isPending} onClick={submit}>
          Confirm order
        </Button>
      </div>
    </Modal>
  );
}

export default PurchaseBidsPanel;
