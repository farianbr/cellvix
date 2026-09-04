import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  History,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react';

import cn from '@/lib/cn';
import Panel from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import ActionMenu from '@/components/ui/ActionMenu';
import ProcessStrip from '@/components/admin/ProcessStrip';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminInvoice, useAdminMutations, useAuditLog } from '@/hooks/useAdmin';
import { apiUrl } from '@/lib/api';
import { money, date, dateTime } from '@/lib/format';

/**
 * One invoice (§4b.6, phase 12).
 *
 * **This screen writes now.** It used to be read-only, on the reasoning that
 * the Invoices list already held the payment and void dialogs and a second set
 * of controls would be a second place for those rules to drift. In practice it
 * sent an operator who had opened an invoice to *look* at it back to a list to
 * act on it — and the rules never lived in the dialogs anyway, they live in
 * `invoicePaymentService`, which both paths call. So the controls are here,
 * against the document they describe, and the server still owns every rule.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/invoices/:number'], icon: adminIcon('FileText') };

const STATUS_TONE = {
  paid: 'ok',
  partial: 'info',
  unpaid: 'neutral',
  overdue: 'danger',
  void: 'neutral',
};

/** How a payment arrived. Matches the methods the Invoices list records. */
const PAYMENT_METHODS = [
  { value: 'card', label: 'Card' },
  { value: 'e-transfer', label: 'E-transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit', label: 'Store credit' },
];

/**
 * The stages an invoice moves through.
 *
 * Rendered by the shared `ProcessStrip`, **not a local component**: quotes and
 * purchase orders already show their pipeline that way, and an invoice drawing
 * its own row of pills meant the same idea looked different on three screens.
 * One rail, one vocabulary, one place at the foot of the page.
 *
 * `overdue` is not a fourth stage — it is an unpaid invoice past its date, so
 * it sits at `unpaid` on the track and the header badge carries the lateness.
 */
const INVOICE_LIFECYCLE = [
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'partial', label: 'Partially paid' },
  { key: 'paid', label: 'Paid' },
];

export function AdminInvoiceDetailPage() {
  const { number } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useAdminInvoice(number);

  /**
   * Every edit this invoice has taken, from the audit log rather than a second
   * history collection. The log is already written as a side effect of each
   * write, so a separate trail would be a copy that can disagree with it.
   */
  const { data: auditData } = useAuditLog('activity', { entity: 'invoice', q: number, limit: 20 });

  const {
    recordInvoicePayment,
    voidInvoice,
    emailInvoice,
    reverseInvoicePayment,
    updateInvoice,
    deleteInvoice,
  } = useAdminMutations();

  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Emailing goes out to a real customer, so it is confirmed first — the
  // outcome then arrives as a toast rather than a banner this page has to find
  // room for. What the transport actually said is reported verbatim: a send
  // that did not happen must not read as one (§6b rule 4).
  const [emailing, setEmailing] = useState(false);
  // Which payment row is being reversed, by index. `null` when none is.
  const [reversing, setReversing] = useState(null);

  if (isLoading) return <p className="text-sm text-ink-500">Loading invoice…</p>;

  if (error) {
    return (
      <>
        <PageHeader icon={ADMIN_PAGE.icon} title="Invoice not found" />
        <p className="text-sm text-ink-500">
          {error.message}{' '}
          <Link to="/admin/invoices" className="font-semibold text-brand underline">
            Back to invoices
          </Link>
        </p>
      </>
    );
  }

  const invoice = data?.invoice;
  if (!invoice) return null;

  const account = invoice.displayName ?? invoice.businessName;
  const settled = invoice.balance <= 0;
  const entries = auditData?.entries ?? auditData?.rows ?? [];

  const documentUrl = apiUrl(`/admin/invoices/${invoice.number}/document`);

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={invoice.number}
        description={`Issued ${date(invoice.issuedAt)} to ${account}.`}
        badge={
          <Badge tone={STATUS_TONE[invoice.status] ?? 'neutral'} size="sm">
            {invoice.status}
          </Badge>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/invoices"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink-600 transition-colors hover:border-ink-300 hover:bg-surface-2"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              All invoices
            </Link>

            <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>

            <Button
              size="sm"
              variant="outline"
              icon={Mail}
              loading={emailInvoice.isPending}
              onClick={() => setEmailing(true)}
            >
              Email
            </Button>

            {/* Everything past the two an operator reaches for daily. Print and
                PDF are the same rendered document — one goes to a printer, the
                other to a file. */}
            <ActionMenu
              label="More invoice actions"
              trigger={
                <span className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-600 transition-colors hover:border-ink-300 hover:bg-surface-2">
                  <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden="true" />
                </span>
              }
              items={[
                {
                  key: 'payment',
                  label: 'Record payment',
                  icon: Plus,
                  disabled: settled,
                  onSelect: () => setPaying(true),
                },
                {
                  /**
                   * One item, not a separate "Print" and "Download PDF".
                   *
                   * There is no PDF generator behind this: the route renders
                   * the invoice as a document with its own print button, and
                   * the browser's print dialog is where "save as PDF" lives.
                   * Two entries would promise two different files and produce
                   * the same page twice.
                   */
                  key: 'print',
                  label: 'Print or save as PDF',
                  icon: Printer,
                  onSelect: () => window.open(documentUrl, '_blank', 'noopener'),
                },
                {
                  key: 'void',
                  label: 'Void',
                  icon: Undo2,
                  disabled: settled,
                  onSelect: () => setVoiding(true),
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  tone: 'danger',
                  // Refused server-side once money has touched it; disabled
                  // here so the operator is not offered a button that will be
                  // refused a moment later.
                  disabled: invoice.amountPaid > 0,
                  onSelect: () => setDeleting(true),
                },
              ]}
            />
          </div>
        }
      />


      <div className="max-w-[900px] space-y-4">
        {/**
         * Payment information, leading the page.
         *
         * The two figures an operator opens an invoice to check are what it is
         * for and what has arrived — so they are the first thing on the screen,
         * at a size that can be read across a desk, with the history that
         * produced them directly underneath.
         */}
        <Panel
          title="Payment information"
          description="The paid total and the status are recomputed from the rows below."
          action={
            settled ? (
              <Badge tone="ok" size="sm">
                Fully paid
              </Badge>
            ) : (
              <Button size="xs" icon={Plus} onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="eyebrow text-ink-400">Invoice total</p>
              <p className="tnum mt-1.5 font-display text-2xl font-bold leading-none text-ink-900">
                {money(invoice.amount)}
              </p>
            </div>
            <div className="rounded-lg border border-ok/25 bg-ok-50 px-4 py-3">
              <p className="eyebrow text-ok">Total paid</p>
              <p className="tnum mt-1.5 font-display text-2xl font-bold leading-none text-ok">
                {money(invoice.amountPaid)}
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border px-4 py-3',
                settled ? 'border-line bg-surface' : 'border-danger/25 bg-danger-50',
              )}
            >
              <p className={cn('eyebrow', settled ? 'text-ink-400' : 'text-danger')}>Balance</p>
              <p
                className={cn(
                  'tnum mt-1.5 font-display text-2xl font-bold leading-none',
                  settled ? 'text-ink-900' : 'text-danger',
                )}
              >
                {money(invoice.balance)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="eyebrow mb-2 flex items-center gap-1.5 text-ink-400">
              <History className="size-3.5 text-brand" strokeWidth={2.25} aria-hidden="true" />
              Payment history
            </p>

            {invoice.payments.length === 0 ? (
              <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm text-ink-500">
                Nothing recorded against this invoice yet.
              </p>
            ) : (
              /* A table, not a list of lines. Payments are a ledger — the same
                 four facts on every row — and a ledger is read down its columns.
                 The list forced the eye to re-find the amount on each line. */
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full table-fixed text-left">
                  <thead>
                    <tr className="border-b border-line bg-surface-2">
                      <th scope="col" className="w-[26%] px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">
                        Date
                      </th>
                      <th scope="col" className="w-[18%] px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-ink-400">
                        Amount
                      </th>
                      <th scope="col" className="w-[18%] px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">
                        Method
                      </th>
                      <th scope="col" className="w-[28%] px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">
                        Reference
                      </th>
                      <th scope="col" className="w-[10%] px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-ink-400">
                        <span className="sr-only">Reverse</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line">
                    {invoice.payments.map((payment, index) => {
                      const reversal = payment.amount < 0;
                      const reversed = Boolean(payment.reversedAt);
                      const forgiven = payment.method === 'void';

                      return (
                        <tr key={`${payment.at}-${index}`} className={cn(reversed && 'bg-surface-2/60')}>
                          <td className="tnum px-3 py-2.5 text-sm text-ink-500">
                            {dateTime(payment.at)}
                          </td>

                          <td
                            className={cn(
                              'tnum px-3 py-2.5 text-right font-display text-md font-bold',
                              // Three different facts, three different weights:
                              // money in is plain, a reversal is red because it
                              // takes money back, and a void is grey because it
                              // was never money at all — it is forgiveness.
                              reversal ? 'text-danger' : forgiven ? 'text-ink-400' : 'text-ink-900',
                              reversed && 'line-through opacity-60',
                            )}
                          >
                            {money(payment.amount)}
                          </td>

                          <td className="px-3 py-2.5">
                            {payment.method && (
                              <Badge
                                tone={reversal ? 'danger' : forgiven ? 'neutral' : 'info'}
                                size="sm"
                              >
                                {payment.method}
                              </Badge>
                            )}
                          </td>

                          <td className="truncate px-3 py-2.5 font-mono text-xs text-ink-400">
                            {payment.reference || '—'}
                          </td>

                          <td className="px-3 py-2.5 text-right">
                            {/* Only a real, un-reversed payment can be reversed.
                                A void and a reversal are already corrections —
                                offering to undo them would be a second way to
                                reach the same state. */}
                            {!reversal && !reversed && !forgiven && (
                              <button
                                type="button"
                                onClick={() => setReversing(index)}
                                aria-label={`Reverse the ${money(payment.amount)} payment`}
                                className="-m-1 rounded-sm p-1 text-ink-300 transition-colors hover:text-danger active:scale-[0.97]"
                              >
                                <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            )}
                            {reversed && (
                              <span className="text-2xs font-medium text-ink-400">Reversed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Details">
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Account</dt>
              <dd className="min-w-0 truncate">
                {invoice.userId ? (
                  <Link
                    to={`/admin/clients/${invoice.userId}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {account}
                  </Link>
                ) : (
                  <span className="text-ink-900">{account}</span>
                )}
              </dd>
            </div>

            {/* The company, where it exists, is a detail about the account
                rather than its name (§0) — so it is a row here, not the title. */}
            {invoice.businessName && invoice.businessName !== account && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Business</dt>
                <dd className="min-w-0 truncate text-ink-900">{invoice.businessName}</dd>
              </div>
            )}

            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Order</dt>
              <dd>
                {invoice.orderNumber ? (
                  <Link
                    to={`/admin/orders/${invoice.orderNumber}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {invoice.orderNumber}
                  </Link>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Terms</dt>
              <dd className="uppercase text-ink-900">{invoice.terms}</dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Issued</dt>
              <dd className="tnum text-ink-900">{date(invoice.issuedAt)}</dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Due</dt>
              <dd className="tnum text-ink-900">
                {invoice.dueDate ? date(invoice.dueDate) : '—'}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel
          title="Change history"
          description="Every recorded action on this invoice, newest first."
        >
          {entries.length === 0 ? (
            <p className="text-sm text-ink-500">
              Nothing recorded since this invoice was raised.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {entries.map((entry) => (
                <li key={entry.id ?? `${entry.at}-${entry.action}`} className="flex gap-2.5">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900">
                      {entry.description ?? entry.action}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {[entry.actor?.name ?? entry.actorName, dateTime(entry.at ?? entry.createdAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/**
         * The life cycle, last on the page.
         *
         * It is a summary of everything above it — where the record ended up
         * after the payments, edits and voids the rest of the screen details —
         * so it reads as a conclusion rather than a heading. Quote and purchase
         * order do the same, which is the whole point: one placement, one
         * component, one thing to learn.
         */}
        <ProcessStrip
          title="Life cycle of an invoice"
          successOnLast
          steps={INVOICE_LIFECYCLE}
          current={invoice.status === 'overdue' ? 'unpaid' : invoice.status}
          stoppedTone={invoice.status === 'void' ? 'warn' : undefined}
          caption={
            invoice.status === 'void'
              ? 'Voided — the balance was forgiven and the invoice goes no further.'
              : 'Status follows the payments recorded above; there is nothing to set by hand.'
          }
        />
      </div>

      <RecordPaymentModal
        open={paying}
        invoice={invoice}
        isPending={recordInvoicePayment.isPending}
        error={recordInvoicePayment.error?.message}
        onClose={() => setPaying(false)}
        onSubmit={(values) =>
          recordInvoicePayment.mutate(
            { number: invoice.number, ...values },
            { onSuccess: () => setPaying(false) },
          )
        }
      />

      <EditInvoiceModal
        open={editing}
        invoice={invoice}
        isPending={updateInvoice.isPending}
        error={updateInvoice.error?.message}
        onClose={() => setEditing(false)}
        onSubmit={(values) =>
          updateInvoice.mutate(
            { number: invoice.number, ...values },
            { onSuccess: () => setEditing(false) },
          )
        }
      />

      {/* Emailing reaches a real customer, so it is confirmed rather than sent
          on a single click. The outcome is a toast: the server says whether the
          transport accepted it, and "sent" and "tried to send" are different
          facts the operator has to be able to tell apart. */}
      <ConfirmDialog
        open={emailing}
        onClose={() => setEmailing(false)}
        onConfirm={() =>
          emailInvoice.mutate(
            { number: invoice.number },
            {
              onSuccess: (result) => {
                setEmailing(false);
                if (result?.delivered === false) {
                  toast.error(
                    'Nothing was sent',
                    `The mail server refused the message to ${result.to}. Check the mail settings.`,
                  );
                } else {
                  toast.ok('Invoice sent', `${invoice.number} is on its way to ${result?.to ?? account}.`);
                }
              },
              onError: (mailError) => {
                setEmailing(false);
                toast.error('Nothing was sent', mailError.message);
              },
            },
          )
        }
        title={`Email ${invoice.number}?`}
        body={`The invoice document goes to ${invoice.email ?? account} — the same page the print view renders.`}
        tone="info"
        confirmLabel="Send invoice"
        loading={emailInvoice.isPending}
      />

      {/* Reversing a payment, not deleting it: both the payment and its
          reversal stay on the record. */}
      <ConfirmDialog
        open={reversing !== null}
        onClose={() => setReversing(null)}
        onConfirm={() =>
          reverseInvoicePayment.mutate(
            { number: invoice.number, index: reversing },
            {
              onSuccess: () => {
                setReversing(null);
                toast.ok('Payment reversed', 'The balance and status have been recalculated.');
              },
              onError: (reverseError) => {
                setReversing(null);
                toast.error('Could not reverse that payment', reverseError.message);
              },
            },
          )
        }
        title="Reverse this payment?"
        body="A reversing entry is added for the same amount. The original payment stays on the history, struck through, so the record still shows the money arrived and was taken back."
        consequence="The balance goes back up, the line of credit is re-drawn, and any commission this payment earned is reversed."
        tone="danger"
        confirmLabel="Reverse payment"
        loading={reverseInvoicePayment.isPending}
      />

      <ConfirmDialog
        open={voiding}
        onClose={() => setVoiding(false)}
        onConfirm={() =>
          voidInvoice.mutate(
            { number: invoice.number, reason: 'Voided from the invoice screen' },
            { onSuccess: () => setVoiding(false) },
          )
        }
        title={`Void ${invoice.number}?`}
        body="The outstanding balance is forgiven and stops counting against the account's line of credit. The invoice stays in the record."
        consequence="Any referral commission this invoice earned is reversed."
        tone="danger"
        confirmLabel="Void invoice"
        loading={voidInvoice.isPending}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          deleteInvoice.mutate(
            { number: invoice.number },
            {
              onSuccess: () => {
                setDeleting(false);
                navigate('/admin/invoices');
              },
            },
          )
        }
        title={`Delete ${invoice.number}?`}
        body="The invoice is removed and the balance it reserved is released back to the account's line of credit."
        consequence="This cannot be undone. An invoice with a payment against it is a void, not a delete — the customer holds a receipt for it."
        tone="danger"
        confirmLabel="Delete invoice"
        loading={deleteInvoice.isPending}
      />
    </>
  );
}

/** Recording money against this invoice. Overpayment is refused server-side. */
function RecordPaymentModal({ open, invoice, onClose, onSubmit, isPending, error }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      amountDollars: (invoice.balance / 100).toFixed(2),
      method: 'card',
      reference: '',
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Record a payment on ${invoice.number}`}>
      <form
        onSubmit={handleSubmit((values) =>
          // `amountDollars`, not cents: `invoicePaymentSchema` coerces the
          // dollar figure itself, and converting here would hand the server a
          // number a hundred times too large.
          onSubmit({
            amountDollars: values.amountDollars,
            method: values.method,
            reference: values.reference || undefined,
          }),
        )}
        className="space-y-4"
      >
        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Amount"
            inputMode="decimal"
            suffix="CAD"
            hint={`${money(invoice.balance)} outstanding`}
            error={errors.amountDollars?.message}
            data-autofocus
            {...register('amountDollars', { required: 'Enter an amount.' })}
          />
          <SelectField control={control} name="method" label="Method" options={PAYMENT_METHODS} />
        </div>

        <Input
          label="Reference"
          placeholder="Cheque number, transfer id…"
          hint="Optional. Shown on the payment history."
          {...register('reference')}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            Record payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Editing an invoice: the clerical fields only.
 *
 * The amount is absent because it is derived from what was billed — see
 * `invoiceUpdateSchema`. Changing what was billed is a void plus a new
 * invoice, which leaves both documents where an audit can see them.
 */
function EditInvoiceModal({ open, invoice, onClose, onSubmit, isPending, error }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : '',
      poNumber: invoice.poNumber ?? '',
      note: invoice.note ?? '',
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${invoice.number}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {error}
          </p>
        )}

        <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-ink-500">
          The amount is not editable here — it is what was billed. To change what
          this invoice charges for, void it and raise a new one, so both
          documents stay in the record.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Due date"
            type="date"
            error={errors.dueDate?.message}
            data-autofocus
            {...register('dueDate')}
          />
          <Input label="PO number" placeholder="Supplier reference" {...register('poNumber')} />
        </div>

        <Input label="Note" placeholder="Shown on the invoice document." {...register('note')} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdminInvoiceDetailPage;
