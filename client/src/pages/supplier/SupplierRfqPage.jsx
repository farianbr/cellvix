import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Send,
  Trophy,
  XCircle,
} from 'lucide-react';
import { money, date } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { useTableClasses } from '@/components/admin/DataTable';
import { toast } from '@/store/toastStore';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';
import { useSupplierRfq, useSupplierPortalMutations } from '@/hooks/useSupplierPortal';

/**
 * One request, and the form that prices it (§6.8a).
 *
 * **A price per line, and the ability to say "not this one".** A supplier who
 * stocks nine of the ten parts must be able to answer for the nine without
 * quoting zero on the tenth — a zero is a legitimate price for a sample, and
 * conflating the two is how an order gets raised for something nobody has. That
 * is the `available` toggle, and the server ranks an incomplete quote below a
 * complete one rather than letting a smaller total look like a better offer.
 *
 * **Prices are typed in dollars and sent in cents.** Every money field in this
 * app is an integer cent server-side; this is the boundary where that
 * conversion happens, and the running total below the table is a preview the
 * server recomputes on submit.
 *
 * Re-submittable while the request is open. A supplier correcting a typo should
 * not have to ask anybody to reopen anything.
 */
export function SupplierRfqPage() {
  const { id } = useParams();
  const t = useTableClasses();

  const { data, isLoading } = useSupplierRfq(id);
  const { submitQuote, declineQuote } = useSupplierPortalMutations();

  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState(null);

  const rfq = data?.rfq;

  const { register, handleSubmit, watch, setValue, formState } = useForm({
    // Populated from the request once it loads — `values` rather than
    // `defaultValues`, so a supplier returning to a quote they already sent
    // sees their own numbers rather than an empty form.
    values: rfq
      ? {
          shipping: ((rfq.myQuote.shipping ?? 0) / 100).toFixed(2),
          leadTimeDays: rfq.myQuote.leadTimeDays ?? '',
          validUntil: rfq.myQuote.validUntil
            ? new Date(rfq.myQuote.validUntil).toISOString().slice(0, 10)
            : '',
          note: rfq.myQuote.note ?? '',
          lines: rfq.items.map((item) => {
            const existing = rfq.myQuote.lines.find((line) => line.sku === item.sku);
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

  const subtotal = rfq
    ? rfq.items.reduce((sum, item, index) => {
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

  if (!rfq) {
    return (
      <Panel>
        <PanelEmpty
          icon={Send}
          title="Request not found"
          body="It may have been withdrawn, or the link is out of date. Check the email it came from."
        />
      </Panel>
    );
  }

  const locked = rfq.state !== 'open';

  function submit(values) {
    setError(null);

    const priced = values.lines.filter(
      (line) => line.available === false || String(line.unitCost).trim() !== '',
    );
    if (!priced.length) {
      setError('Enter a price for at least one line, or mark the lines you cannot supply.');
      return;
    }

    submitQuote.mutate(
      {
        id: rfq.id,
        shipping,
        leadTimeDays: values.leadTimeDays === '' ? undefined : Number(values.leadTimeDays),
        validUntil: values.validUntil || undefined,
        note: values.note || undefined,
        lines: priced.map((line) => ({
          sku: line.sku,
          unitCost: Math.round(Number(line.unitCost || 0) * 100),
          available: line.available !== false,
        })),
      },
      {
        onSuccess: () =>
          toast.ok('Your quote is with us', 'You can change it any time before the request closes.'),
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
        All requests
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight text-ink-900">
            {rfq.title || 'Request for quote'}
          </h1>
          <p className="mt-1 font-mono text-sm text-ink-400">{rfq.rfqNumber}</p>
        </div>

        {rfq.closesAt && !locked && (
          <Badge tone={rfq.closed ? 'danger' : 'info'}>
            {rfq.closed ? 'Closed' : 'Closes'} {date(rfq.closesAt)}
          </Badge>
        )}
      </div>

      {/* What state this request is in, said plainly. A supplier who won needs
          to know an order is coming; one who was not chosen is owed a straight
          answer rather than silence. */}
      {rfq.state === 'won' && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-ok-50 px-3 py-2.5 text-sm text-ok">
          <Trophy className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Your quote was accepted. A purchase order has been raised and emailed to you.
        </p>
      )}
      {rfq.state === 'closed' && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-surface-3 px-3 py-2.5 text-sm text-ink-500">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          This request has been decided. Thank you for quoting — we will be in touch with the next
          one.
        </p>
      )}
      {rfq.state === 'cancelled' && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-surface-3 px-3 py-2.5 text-sm text-ink-500">
          <XCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          This request was withdrawn.
        </p>
      )}
      {rfq.myQuote.status === 'declined' && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-surface-3 px-3 py-2.5 text-sm text-ink-500">
          <XCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          You told us you could not supply this one.
        </p>
      )}

      {rfq.notes && (
        <Panel className="mb-3">
          <p className="text-sm leading-relaxed text-ink-700">{rfq.notes}</p>
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
                {rfq.items.map((item, index) => {
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
                  {rfq.myQuote.status === 'quoted' ? 'Update my quote' : 'Send my quote'}
                </Button>

                {declining ? (
                  <>
                    <Button
                      type="button"
                      variant="danger"
                      loading={declineQuote.isPending}
                      onClick={() =>
                        declineQuote.mutate(
                          { id: rfq.id },
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

            {rfq.myQuote.quotedAt && (
              <p className="mt-2 text-xs text-ink-400">
                Last sent {date(rfq.myQuote.quotedAt)}.
              </p>
            )}
          </Panel>
        </div>
      </form>
    </>
  );
}

export default SupplierRfqPage;
