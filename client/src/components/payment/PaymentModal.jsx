import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Lock, ShieldCheck, Wallet } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import cn from '@/lib/cn';
import { money } from '@/lib/format';

/**
 * The payment sheet — every Pay button in the app opens this one.
 *
 * **The card fields are a facade, and deliberately an honest one.** The gateway
 * is a mock (`server/src/services/payment.js`), nothing typed here is sent, and
 * the repo stores no card number anywhere by design. A payment step with no
 * form at all does not demonstrate a payment flow to anyone reviewing the
 * build, so the form exists — and says plainly, on the sheet, that it is a test
 * gateway. Dressing a mock up as real without saying so is how somebody ends up
 * typing an actual card number into it.
 *
 * What IS real: the amount, the store-credit split, the decline path, and every
 * ledger row the server writes on success. When a live gateway swaps in, this
 * component keeps its shape — `payment.js` is the single seam, exactly as its
 * own header promises.
 *
 * The amount is passed in for display only. The server derives what to charge
 * from the invoice's own balance and never trusts a figure from here (§5.3), so
 * a tampered `amount` prop changes the label and nothing else.
 */

/** `4242 4242 4242 4242` — grouped as it is typed, like a real card field. */
function groupCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function groupExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** One field in the Stripe-style stacked group. */
function CardField({ label, className, ...props }) {
  return (
    <label className={cn('block', className)}>
      <span className="sr-only">{label}</span>
      <input
        {...props}
        aria-label={label}
        className="h-11 w-full bg-transparent px-3 text-md text-ink-900 outline-none placeholder:text-ink-300 focus-visible:bg-brand-50/40"
      />
    </label>
  );
}

export function PaymentModal({
  open,
  onClose,
  /** Integer cents. Display only — the server decides what is actually charged. */
  amount,
  title = 'Pay invoice',
  description,
  /** Store credit the account holds, in cents. Omit or 0 to hide the option. */
  storeCredit = 0,
  onSubmit,
  loading = false,
  error = null,
  confirmLabel,
}) {
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [postal, setPostal] = useState('');
  const [poNumber, setPoNumber] = useState('');

  // Reopening the sheet after a decline should not present the previous
  // attempt's details as though they were still pending.
  useEffect(() => {
    if (!open) return;
    setUseStoreCredit(false);
    setCard('');
    setExpiry('');
    setCvc('');
    setPostal('');
    setPoNumber('');
  }, [open]);

  // The same arithmetic the server does, shown so the buyer can see the split
  // before they commit. The server recomputes it and its answer is the one that
  // counts — this is a preview, not an instruction.
  const split = useMemo(() => {
    const credit = useStoreCredit ? Math.min(storeCredit, amount) : 0;
    return { credit, card: Math.max(0, amount - credit) };
  }, [useStoreCredit, storeCredit, amount]);

  const cardNeeded = split.card > 0;

  function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    // Only the two fields the server actually reads. Nothing typed into the
    // card group leaves the browser.
    onSubmit?.({ useStoreCredit, poNumber: poNumber.trim() || undefined });
  }

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      description={description}
      size="sm"
      closeOnScrimClick={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ---- the amount, stated once and prominently ------------------- */}
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-400">
            Amount due
          </p>
          <p className="tnum mt-1 font-display text-3xl font-extrabold leading-none text-ink-900">
            {money(amount)}
          </p>

          {split.credit > 0 && (
            <dl className="mt-3 space-y-1 border-t border-line pt-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Store credit</dt>
                <dd className="tnum font-semibold text-ok">−{money(split.credit)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">On card</dt>
                <dd className="tnum font-semibold text-ink-900">{money(split.card)}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* ---- store credit --------------------------------------------- */}
        {storeCredit > 0 && (
          <div className="rounded-lg border border-line p-2.5">
            <Checkbox
              checked={useStoreCredit}
              onChange={(event) => setUseStoreCredit(event.target.checked)}
              label={
                <span className="flex items-center gap-1.5">
                  <Wallet className="size-3.5 shrink-0 text-ink-400" strokeWidth={2} aria-hidden="true" />
                  Use my store credit
                </span>
              }
            />
            {/* Outside the Checkbox: its label truncates to one line, which is
                the right behaviour for a filter facet and the wrong one for a
                sentence about money. */}
            <p className="mt-0.5 pl-9.5 pr-2 text-xs leading-snug text-ink-400">
              {money(storeCredit)} available. Applied first; the card covers the rest.
            </p>
          </div>
        )}

        {/* ---- card ------------------------------------------------------ */}
        {/* Hidden once credit covers the whole amount: a card form above a
            "$0.00 on card" line is a form asking for something it does not
            need. */}
        {cardNeeded && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-700">
              <CreditCard className="size-3.5 text-ink-400" strokeWidth={2} aria-hidden="true" />
              Card details
            </legend>

            {/* One bordered group with hairline dividers — the Stripe Elements
                shape, which reads as a single control rather than four. */}
            <div className="overflow-hidden rounded-md border border-line-strong bg-surface focus-within:border-brand">
              <CardField
                label="Card number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="4242 4242 4242 4242"
                value={card}
                onChange={(event) => setCard(groupCardNumber(event.target.value))}
              />
              <div className="grid grid-cols-3 border-t border-line">
                <CardField
                  label="Expiry date"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="MM / YY"
                  value={expiry}
                  onChange={(event) => setExpiry(groupExpiry(event.target.value))}
                />
                <CardField
                  label="Security code"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="CVC"
                  className="border-l border-line"
                  value={cvc}
                  onChange={(event) => setCvc(event.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <CardField
                  label="Postal code"
                  autoComplete="off"
                  placeholder="A1A 1A1"
                  className="border-l border-line"
                  value={postal}
                  onChange={(event) => setPostal(event.target.value.toUpperCase().slice(0, 7))}
                />
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-500">
                PO number <span className="font-normal text-ink-300">(optional)</span>
              </span>
              <input
                value={poNumber}
                onChange={(event) => setPoNumber(event.target.value)}
                maxLength={40}
                placeholder="Your reference"
                className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-md text-ink-900 outline-none placeholder:text-ink-300 focus:border-brand"
              />
            </label>
          </fieldset>
        )}

        {/* ---- what this gateway actually is ----------------------------- */}
        {/* Said plainly rather than buried. A test form that looks real is how
            somebody ends up typing a live card number into it. */}
        <p className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-400">
          <ShieldCheck className="mt-px size-4 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
          <span>
            Test gateway — no card details are sent or stored. Use{' '}
            <span className="tnum font-semibold text-ink-500">4242 4242 4242 4242</span>, or a PO
            number starting <span className="font-semibold text-ink-500">DECLINE</span> to see the
            failure path.
          </span>
        </p>

        {error && (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} icon={Lock} className="sm:min-w-[10rem]">
            {confirmLabel ?? `Pay ${money(amount)}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default PaymentModal;
