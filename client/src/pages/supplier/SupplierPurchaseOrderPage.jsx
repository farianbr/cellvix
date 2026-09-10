import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  MessageSquare,
  Send,
  Trophy,
  Truck,
  XCircle,
} from 'lucide-react';
import { money, date } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectMenu from '@/components/ui/SelectMenu';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { useTableClasses } from '@/components/admin/DataTable';
import { toast } from '@/store/toastStore';
import { apiUrl } from '@/lib/api';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';
import { useSupplierOrder, useSupplierPortalMutations } from '@/hooks/useSupplierPortal';

/**
 * One purchase order, and the form that prices it (§6.8a).
 *
 * **A price per line, and the ability to say "not this one".** A supplier who
 * stocks nine of the ten parts must be able to answer for the nine without
 * quoting zero on the tenth — a zero is a legitimate price for a sample, and
 * conflating the two is how an order gets placed for something nobody has. That
 * is the `available` toggle, and the server ranks an incomplete bid below a
 * complete one rather than letting a smaller total look like a better offer.
 *
 * **Prices are typed in dollars and sent in cents.** Every money field in this
 * app is an integer cent server-side; this is the boundary where that
 * conversion happens, and the running total below the table is a preview the
 * server recomputes on submit.
 *
 * **Nothing here names another supplier.** The serializer returns this
 * supplier's own bid and nothing else — no rank, no gap to the leader — because
 * a sealed process that quietly reports the competition is a live auction
 * nobody agreed to run.
 *
 * Re-submittable while the order is open. A supplier correcting a typo should
 * not have to ask anybody to reopen anything.
 */

const DELIVERY_OPTIONS = [
  { value: 'pending', label: 'Not started' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
];

export function SupplierPurchaseOrderPage() {
  const { id } = useParams();
  const t = useTableClasses();

  const { data, isLoading } = useSupplierOrder(id);
  const { submitQuote, declineQuote, submitProforma, setDeliveryStatus } =
    useSupplierPortalMutations();

  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState(null);

  const order = data?.order;
  const bid = order?.myBid;

  const { register, handleSubmit, watch, setValue } = useForm({
    // Populated from the order once it loads — `values` rather than
    // `defaultValues`, so a supplier returning to a price they already sent
    // sees their own numbers rather than an empty form.
    values: order
      ? {
          shipping: ((bid.shipping ?? 0) / 100).toFixed(2),
          leadTimeDays: bid.leadTimeDays ?? '',
          validUntil: bid.validUntil ? new Date(bid.validUntil).toISOString().slice(0, 10) : '',
          note: bid.note ?? '',
          lines: order.items.map((item) => {
            const existing = bid.lines.find((line) => line.sku === item.sku);
            return {
              sku: item.sku,
              unitCost: existing ? (existing.unitCost / 100).toFixed(2) : '',
              available: existing ? existing.available : true,
            };
          }),
        }
      : undefined,
  });

  const lines = watch('lines') ?? [];
  const shipping = Math.round(Number(watch('shipping') || 0) * 100);

  const subtotal = order
    ? order.items.reduce((sum, item, index) => {
        const line = lines[index];
        if (!line || line.available === false) return sum;
        const cost = Math.round(Number(line.unitCost || 0) * 100);
        return sum + (Number.isFinite(cost) ? cost * item.qty : 0);
      }, 0)
    : 0;

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full" />
      </>
    );
  }

  if (!order) {
    return (
      <Panel>
        <PanelEmpty
          icon={Send}
          title="Order not found"
          body="It may have been withdrawn, or the link is out of date. Check the email it came from."
        />
      </Panel>
    );
  }

  const locked = order.state !== 'open';
  const won = order.state === 'won';
  const priced = ['quoted', 'negotiating', 'confirmed'].includes(bid.status);
  // The round we have opened and they have not yet answered — the whole reason
  // to show a negotiation banner rather than burying it in history.
  const openRound = (bid.negotiations ?? []).find((round) => !round.respondedAt);

  function submit(values) {
    setError(null);

    const answered = values.lines.filter(
      (line) => line.available === false || String(line.unitCost).trim() !== '',
    );
    if (!answered.length) {
      setError('Enter a price for at least one line, or mark the lines you cannot supply.');
      return;
    }

    submitQuote.mutate(
      {
        id: order.id,
        shipping,
        leadTimeDays: values.leadTimeDays === '' ? undefined : Number(values.leadTimeDays),
        validUntil: values.validUntil || undefined,
        note: values.note || undefined,
        lines: answered.map((line) => ({
          sku: line.sku,
          unitCost: Math.round(Number(line.unitCost || 0) * 100),
          available: line.available !== false,
        })),
      },
      {
        onSuccess: () =>
          toast.ok('Your price is with us', 'You can change it any time before the order closes.'),
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <>
      <Link
        to="/supplier"
        className={cn(
          pressable,
          'mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        All orders
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight text-ink-900">
            {order.title || 'Purchase order'}
          </h1>
          <p className="mt-1 font-mono text-sm text-ink-400">{order.poNumber}</p>
        </div>

        {order.closesAt && !locked && (
          <Badge tone={order.closed ? 'danger' : 'info'}>
            {order.closed ? 'Closed' : 'Closes'} {date(order.closesAt)}
          </Badge>
        )}
      </div>

      {/* What state this order is in, said plainly. A supplier who won needs to
          know goods are expected; one who was not chosen is owed a straight
          answer rather than silence. */}
      {won && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-ok-50 px-3 py-2.5 text-sm text-ok">
          <Trophy className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Your price was accepted and this order is confirmed with you.
        </p>
      )}
      {order.state === 'closed' && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-surface-3 px-3 py-2.5 text-sm text-ink-500">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          This order has been decided. Thank you for pricing it — we will be in touch with the next
          one.
        </p>
      )}
      {order.state === 'cancelled' && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-surface-3 px-3 py-2.5 text-sm text-ink-500">
          <XCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          This order was withdrawn.
        </p>
      )}
      {bid.status === 'declined' && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-surface-3 px-3 py-2.5 text-sm text-ink-500">
          <XCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          You told us you could not supply this one.
        </p>
      )}

      {/* An open negotiation round leads the page: it is a question waiting on
          an answer, and burying it under the price table is how it goes unread. */}
      {openRound && !locked && (
        <Panel className="mb-3 border-brand/40">
          <p className="flex items-start gap-2 text-sm text-ink-900">
            <MessageSquare
              className="mt-0.5 size-4 shrink-0 text-brand"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>
              <strong className="font-semibold">We have asked about your price.</strong>{' '}
              {openRound.askedTotal != null && (
                <>
                  Our target for the order is{' '}
                  <span className="tnum font-semibold">{money(openRound.askedTotal)}</span>.{' '}
                </>
              )}
              {openRound.note}
            </span>
          </p>
          <p className="mt-2 text-xs text-ink-400">
            Update your prices below and send them again to answer.
          </p>
        </Panel>
      )}

      {order.notes && (
        <Panel className="mb-3">
          <p className="text-sm leading-relaxed text-ink-700">{order.notes}</p>
        </Panel>
      )}

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit(submit)}>
        <Panel title="Your prices" flush className="mb-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 text-left">
              <thead>
                <tr className={t.headRow}>
                  <th scope="col" className={t.headCell()}>
                    Part
                  </th>
                  <th scope="col" className={cn(t.headCell('right'), 'w-20')}>
                    Qty
                  </th>
                  <th scope="col" className={cn(t.headCell('right'), 'w-32')}>
                    Unit price
                  </th>
                  <th scope="col" className={cn(t.headCell('right'), 'w-28')}>
                    Line total
                  </th>
                  <th scope="col" className={cn(t.headCell('right'), 'w-32')}>
                    Can supply
                  </th>
                </tr>
              </thead>

              <tbody>
                {order.items.map((item, index) => {
                  const line = lines[index];
                  const available = line?.available !== false;
                  const cost = Math.round(Number(line?.unitCost || 0) * 100);
                  const lineTotal = available && Number.isFinite(cost) ? cost * item.qty : 0;

                  return (
                    <tr key={item.sku} className={cn(t.row, !available && 'opacity-60')}>
                      <td className={t.cell()}>
                        <span className="block truncate text-sm text-ink-900">{item.name}</span>
                        <span className="block font-mono text-2xs text-ink-400">{item.sku}</span>
                      </td>
                      <td className={cn(t.cell('right'), 'tnum text-sm text-ink-500')}>
                        {item.qty}
                      </td>
                      <td className={t.cell('right')}>
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          suffix="$"
                          disabled={locked || !available}
                          aria-label={`Your unit price for ${item.name}`}
                          {...register(`lines.${index}.unitCost`)}
                        />
                      </td>
                      <td className={cn(t.cell('right'), 'tnum text-sm font-medium text-ink-900')}>
                        {available ? money(lineTotal) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className={t.cell('right')}>
                        {/* A toggle, not a price of zero. "We do not stock this"
                            and "this one is free" are different answers, and
                            only one of them should end up on a purchase order. */}
                        <button
                          type="button"
                          disabled={locked}
                          aria-pressed={available}
                          onClick={() =>
                            setValue(`lines.${index}.available`, !available, { shouldDirty: true })
                          }
                          className={cn(
                            pressable,
                            'rounded-full border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50',
                            available
                              ? 'border-ok/30 bg-ok-50 text-ok'
                              : 'border-line bg-surface text-ink-400 hover:border-line-strong',
                          )}
                        >
                          {available ? 'Yes' : 'No'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid items-start gap-3 lg:grid-cols-[1fr_minmax(0,320px)]">
          <Panel title="Delivery and terms">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Lead time"
                type="number"
                min="0"
                suffix="days"
                disabled={locked}
                hint="How long from order to delivery."
                {...register('leadTimeDays')}
              />
              <Input
                label="Price valid until"
                type="date"
                disabled={locked}
                {...register('validUntil')}
              />
            </div>

            <Textarea
              label="Anything we should know"
              rows={3}
              disabled={locked}
              placeholder="Minimum order, part condition, packaging…"
              containerClassName="mt-3"
              {...register('note')}
            />

            {!locked && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="submit" icon={Send} loading={submitQuote.isPending}>
                  {priced ? 'Update my price' : 'Send my price'}
                </Button>

                {declining ? (
                  <>
                    <Button
                      type="button"
                      variant="danger"
                      loading={declineQuote.isPending}
                      onClick={() =>
                        declineQuote.mutate(
                          { id: order.id },
                          {
                            onSuccess: () => {
                              setDeclining(false);
                              toast.ok('Thanks for telling us', 'We will not chase this one.');
                            },
                            onError: (err) => setError(err.message),
                          },
                        )
                      }
                    >
                      Yes, I cannot supply this
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setDeclining(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    icon={XCircle}
                    onClick={() => setDeclining(true)}
                  >
                    I cannot supply this
                  </Button>
                )}
              </div>
            )}
          </Panel>

          <Panel>
            <dl className="space-y-2 text-sm">
              <div className="tnum flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Parts</dt>
                <dd className="font-medium text-ink-900">{money(subtotal)}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">Shipping</dt>
                <dd className="w-28">
                  <Input
                    inputMode="decimal"
                    suffix="$"
                    disabled={locked}
                    aria-label="Shipping"
                    {...register('shipping')}
                  />
                </dd>
              </div>

              <div className="tnum flex items-baseline justify-between gap-3 border-t border-line pt-2 font-display text-lg font-bold text-ink-900">
                <dt>Your total</dt>
                <dd>{money(subtotal + shipping)}</dd>
              </div>
            </dl>

            <p className="mt-2.5 text-xs leading-relaxed text-ink-400">
              A preview — we recalculate this from your line prices when you send it.
            </p>

            {bid.quotedAt && (
              <p className="mt-2 text-xs text-ink-400">Last sent {date(bid.quotedAt)}.</p>
            )}
          </Panel>
        </div>
      </form>

      {/* The proforma invoice, once there is a price to raise one against. Its
          own form rather than part of the price submission: a PI is a formal
          offer with terms and bank details, issued when the supplier is ready,
          not something to fill in every time a price is corrected. */}
      {priced && <ProformaPanel order={order} bid={bid} submitProforma={submitProforma} />}

      {/* Delivery reporting, only for the confirmed supplier — a losing bidder
          marking a delivery dispatched is a fact about nothing. */}
      {won && (
        <DeliveryPanel order={order} bid={bid} setDeliveryStatus={setDeliveryStatus} />
      )}
    </>
  );
}

/**
 * The supplier's proforma invoice.
 *
 * **No totals are typed here.** The figures come from the prices already sent,
 * recomputed server-side — a PI whose total disagreed with the bid it was
 * raised from would be a document nobody could reconcile. What the supplier
 * supplies is their reference, their terms and where the money goes.
 */
function ProformaPanel({ order, bid, submitProforma }) {
  const proforma = bid.proforma;
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit } = useForm({
    values: {
      number: proforma?.number ?? '',
      validUntil: proforma?.validUntil
        ? new Date(proforma.validUntil).toISOString().slice(0, 10)
        : '',
      paymentTerms: proforma?.paymentTerms ?? '',
      bankDetails: proforma?.bankDetails ?? '',
      note: proforma?.note ?? '',
    },
  });

  function submit(values) {
    setError(null);
    submitProforma.mutate(
      { id: order.id, ...values, validUntil: values.validUntil || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          toast.ok('Proforma sent', 'Our purchasing team has been notified.');
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Panel
      title="Proforma invoice"
      description={
        proforma
          ? `Revision ${proforma.revision}, issued ${date(proforma.issuedAt)}.`
          : 'Send us a formal offer against the prices above.'
      }
      className="mt-3"
      action={
        <Button variant="ghost" size="sm" icon={FileText} onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : proforma ? 'Issue a revision' : 'Issue one'}
        </Button>
      }
    >
      {proforma && !open && (
        <dl className="space-y-2 text-sm">
          {proforma.number && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-500">Reference</dt>
              <dd className="font-mono text-ink-900">{proforma.number}</dd>
            </div>
          )}
          <div className="tnum flex items-baseline justify-between gap-3">
            <dt className="text-ink-500">Total</dt>
            <dd className="font-semibold text-ink-900">{money(proforma.total)}</dd>
          </div>
          {proforma.acceptedAt && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-500">Accepted</dt>
              <dd className="text-ok">{date(proforma.acceptedAt)}</dd>
            </div>
          )}
          <div className="pt-1">
            <a
              href={apiUrl(`/supplier-portal/orders/${order.id}/proforma`)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                pressable,
                'inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline',
              )}
            >
              <FileText className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              View or print it
            </a>
          </div>
        </dl>
      )}

      {open && (
        <form onSubmit={handleSubmit(submit)}>
          {error && (
            <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Your reference"
              placeholder="PI-00123"
              hint="Your own invoice number, if you use one."
              {...register('number')}
            />
            <Input label="Valid until" type="date" {...register('validUntil')} />
          </div>

          <Input
            label="Payment terms"
            placeholder="30% deposit, balance before dispatch"
            containerClassName="mt-3"
            {...register('paymentTerms')}
          />

          <Textarea
            label="Bank details"
            rows={3}
            placeholder="Bank, SWIFT/IBAN, account name and number"
            containerClassName="mt-3"
            {...register('bankDetails')}
          />

          <Textarea
            label="Notes"
            rows={2}
            containerClassName="mt-3"
            {...register('note')}
          />

          <p className="mt-3 text-xs leading-relaxed text-ink-400">
            The amounts come from the prices you sent above — we total them when this is issued, so
            the invoice and your quote can never disagree.
          </p>

          <Button type="submit" icon={FileText} className="mt-3" loading={submitProforma.isPending}>
            {proforma ? 'Issue revision' : 'Issue proforma invoice'}
          </Button>
        </form>
      )}
    </Panel>
  );
}

/**
 * Where the goods are, reported by the supplier who is sending them.
 *
 * **This never moves stock.** Receiving is a physical count somebody makes at
 * our end, and a supplier saying "delivered" is a claim rather than a receipt —
 * so this updates a status and notifies the purchasing desk, and the stock
 * ledger stays behind the admin's own receiving screen.
 */
function DeliveryPanel({ order, bid, setDeliveryStatus }) {
  const delivery = bid.delivery ?? { status: 'pending' };
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(delivery.status);

  const { register, handleSubmit } = useForm({
    values: {
      carrier: delivery.carrier ?? '',
      trackingNumber: delivery.trackingNumber ?? '',
      expectedAt: delivery.expectedAt
        ? new Date(delivery.expectedAt).toISOString().slice(0, 10)
        : '',
      note: delivery.note ?? '',
    },
  });

  function submit(values) {
    setError(null);
    setDeliveryStatus.mutate(
      { id: order.id, status, ...values, expectedAt: values.expectedAt || undefined },
      {
        onSuccess: () => toast.ok('Thank you', 'We have updated the order.'),
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Panel
      title="Delivery"
      description="Tell us where this order has got to."
      className="mt-3"
    >
      <form onSubmit={handleSubmit(submit)}>
        {error && (
          <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-1.5 text-ink-400">Status</p>
            <SelectMenu
              srLabel="Delivery status"
              value={status}
              onChange={setStatus}
              options={DELIVERY_OPTIONS}
              containerClassName="w-full"
            />
          </div>
          <Input label="Expected arrival" type="date" {...register('expectedAt')} />
          <Input label="Carrier" placeholder="Purolator" {...register('carrier')} />
          <Input label="Tracking number" {...register('trackingNumber')} />
        </div>

        <Textarea label="Notes" rows={2} containerClassName="mt-3" {...register('note')} />

        <Button type="submit" icon={Truck} className="mt-3" loading={setDeliveryStatus.isPending}>
          Update delivery
        </Button>
      </form>
    </Panel>
  );
}

export default SupplierPurchaseOrderPage;
