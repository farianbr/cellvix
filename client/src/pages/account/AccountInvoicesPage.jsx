import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CreditCard, Download, FileText, Receipt, Search, Wallet } from 'lucide-react';
import cn from '@/lib/cn';
import { apiUrl } from '@/lib/api';
import { money, moneyCompact, date, relativeDays } from '@/lib/format';
import Panel, { StatTile, PanelEmpty } from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Skeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PaymentModal from '@/components/payment/PaymentModal';
import { useInvoices, useStoreCredit, useAccountMutations } from '@/hooks/useAccount';
import { pressable } from '@/lib/motion';

/**
 * Billing, in two panels.
 *
 * The split is the point. An invoice is now raised only against money that
 * actually arrived, so a record is either an **amount due** — payable, ageing
 * towards its due date — or an **invoice**, which is settled by definition.
 * That makes a status column redundant: which panel a row is in already says
 * everything a status badge used to, and a table of invoices every one of which
 * reads "paid" is a column of noise.
 *
 * `?pay=INV-…` opens the payment sheet on that record straight away. The
 * printable document links here with it, so "I am looking at what I owe" and
 * "I have paid it" are one click apart.
 */

/** The printable copy — the same document that was emailed when the order was placed. */
function InvoiceDocumentLink({ number, className }) {
  return (
    <a
      href={apiUrl(`/invoices/${number}/document`)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        pressable,
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-50',
        className,
      )}
    >
      <Download className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
      PDF
      <span className="sr-only"> for {number}</span>
    </a>
  );
}

export function AccountInvoicesPage() {
  const { data, isLoading } = useInvoices();
  const { data: credit } = useStoreCredit();
  const { payInvoice, payOffCredit } = useAccountMutations();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  // The record being paid, or 'all' for the whole line of credit.
  const [paying, setPaying] = useState(null);
  const [payError, setPayError] = useState(null);
  const [confirmPayAll, setConfirmPayAll] = useState(false);

  const due = data?.due ?? [];
  const settled = data?.settled ?? [];
  const storeCredit = credit?.balance ?? 0;

  // Arriving from the printable document's Pay button. Consumed once and
  // stripped from the URL, so a refresh does not reopen a sheet for an invoice
  // that has since been paid.
  const payParam = searchParams.get('pay');
  useEffect(() => {
    if (!payParam || !data) return;
    const match = due.find((invoice) => invoice.number === payParam);
    if (match) setPaying(match);
    setSearchParams(
      (params) => {
        params.delete('pay');
        return params;
      },
      { replace: true },
    );
  }, [payParam, data, due, setSearchParams]);

  const filteredSettled = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return settled;

    return settled.filter(
      // Invoice number, the order it bills, or the amount as it is printed —
      // "2,110" finds the invoice a buyer is holding a statement line for.
      (invoice) =>
        invoice.number.toLowerCase().includes(needle) ||
        invoice.orderNumber?.toLowerCase().includes(needle) ||
        invoice.reference?.toLowerCase().includes(needle) ||
        money(invoice.amount).toLowerCase().includes(needle),
    );
  }, [settled, query]);

  const outstanding = data?.totals?.outstanding ?? 0;
  const payingAll = paying === 'all';
  const payAmount = payingAll ? outstanding : (paying?.balance ?? 0);
  const busy = payInvoice.isPending || payOffCredit.isPending;

  function handlePay(values) {
    setPayError(null);
    const mutation = payingAll ? payOffCredit : payInvoice;
    const input = payingAll ? values : { number: paying.number, ...values };

    mutation.mutate(input, {
      onSuccess: () => setPaying(null),
      onError: (error) =>
        setPayError(
          error?.message ?? 'That payment could not be completed. Nothing has been charged.',
        ),
    });
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { totals } = data;

  return (
    <div className="space-y-4">
      {/* Two up on a phone — three stacked tiles pushed the list itself below
          the fold on every screen under 640px. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Outstanding"
          value={moneyCompact(totals.outstanding)}
          hint={
            totals.dueCount > 0
              ? `${totals.dueCount} ${totals.dueCount === 1 ? 'amount' : 'amounts'} to pay`
              : 'Nothing to pay'
          }
          tone={totals.outstanding > 0 ? 'brand' : 'ok'}
          icon={Wallet}
        />
        <StatTile
          label="Overdue"
          value={moneyCompact(totals.overdue)}
          hint={totals.overdue > 0 ? 'Past the due date' : 'Nothing past due'}
          tone={totals.overdue > 0 ? 'danger' : 'ok'}
        />
        <StatTile
          label="Invoiced to date"
          value={moneyCompact(totals.billed)}
          hint={`${settled.length} ${settled.length === 1 ? 'document' : 'documents'}`}
          icon={FileText}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* ---- amounts due ------------------------------------------------- */}
      {due.length > 0 && (
        <Panel
          title="Amounts due"
          description="Paid in full, an amount becomes an invoice you can file."
          action={
            // Only worth offering when there is more than one thing to clear —
            // with a single amount this button and its row's Pay button do the
            // same thing, and two buttons for one action is a choice nobody
            // asked for.
            due.length > 1 ? (
              <Button size="sm" icon={CreditCard} onClick={() => setConfirmPayAll(true)}>
                Pay all · {money(outstanding)}
              </Button>
            ) : null
          }
          flush
        >
          <ul className="divide-y divide-line">
            {due.map((invoice) => (
              <li
                key={invoice.number}
                className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-36 flex-1">
                  <span className="font-mono text-sm font-medium text-ink-900">
                    {invoice.number}
                  </span>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Due {date(invoice.dueDate)}
                    <span
                      className={cn(
                        'ml-1',
                        invoice.status === 'overdue' ? 'font-medium text-danger' : 'text-ink-400',
                      )}
                    >
                      ({relativeDays(invoice.dueDate)})
                    </span>
                  </p>
                  {invoice.orderNumber && (
                    <Link
                      to={`/account/orders/${invoice.orderNumber}`}
                      className="mt-0.5 inline-block font-mono text-xs text-brand hover:underline"
                    >
                      {invoice.orderNumber}
                    </Link>
                  )}
                </div>

                <div className="text-right">
                  <p className="tnum font-display text-lg font-bold text-ink-900">
                    {money(invoice.balance)}
                  </p>
                  {invoice.balance !== invoice.amount && (
                    <p className="tnum text-xs text-ink-400">of {money(invoice.amount)}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <InvoiceDocumentLink number={invoice.number} />
                  <Button size="sm" onClick={() => setPaying(invoice)}>
                    Pay
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ---- invoices & receipts ---------------------------------------- */}
      <Panel
        title="Invoices & receipts"
        description={
          query ? `${filteredSettled.length} of ${settled.length} shown` : 'Every document, settled'
        }
        flush
      >
        <div className="border-b border-line p-4 sm:px-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Invoice number, order number or amount…"
            icon={Search}
            aria-label="Search invoices"
          />
        </div>

        {filteredSettled.length === 0 ? (
          <PanelEmpty
            icon={FileText}
            title={settled.length ? 'Nothing matches that' : 'No invoices yet'}
            body={
              settled.length
                ? 'Try a different invoice or order number.'
                : 'An invoice is issued and emailed to you once an order is paid in full.'
            }
          />
        ) : (
          <>
            {/* ---- table from lg ---------------------------------------- */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line">
                    {['Document', 'Order', 'Issued', 'Paid', 'Amount', ''].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="eyebrow px-4 py-2.5 text-ink-400 first:pl-5"
                      >
                        {heading || <span className="sr-only">Download</span>}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-line">
                  {filteredSettled.map((invoice) => (
                    <tr key={invoice.number} className="transition-colors hover:bg-surface-2">
                      <td className="py-3 pl-5 pr-4">
                        <span className="flex items-center gap-2">
                          {invoice.kind === 'receipt' && (
                            <Receipt
                              className="size-3.5 shrink-0 text-ink-300"
                              strokeWidth={2.25}
                              aria-label="Receipt"
                            />
                          )}
                          <span className="font-mono text-sm font-medium text-ink-900">
                            {invoice.number}
                          </span>
                        </span>
                        {invoice.reference && (
                          <span className="mt-0.5 block text-xs text-ink-400">
                            {invoice.reference}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {invoice.orderNumber ? (
                          <Link
                            to={`/account/orders/${invoice.orderNumber}`}
                            className="font-mono text-sm text-brand hover:underline"
                          >
                            {invoice.orderNumber}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-ink-500">
                        {date(invoice.issuedAt)}
                      </td>

                      <td className="px-4 py-3 text-sm text-ink-500">
                        {invoice.settledAt ? date(invoice.settledAt) : '—'}
                      </td>

                      <td className="tnum px-4 py-3 text-sm font-medium text-ink-900">
                        {money(invoice.amount)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <InvoiceDocumentLink number={invoice.number} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- list below lg -----------------------------------------
                The table was a 640px-wide horizontal scroller on a phone: the
                two columns that matter started off-screen. */}
            <ul className="divide-y divide-line lg:hidden">
              {filteredSettled.map((invoice) => (
                <li key={invoice.number} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {invoice.kind === 'receipt' && (
                        <Receipt
                          className="size-3.5 shrink-0 text-ink-300"
                          strokeWidth={2.25}
                          aria-label="Receipt"
                        />
                      )}
                      <span className="font-mono text-sm font-medium text-ink-900">
                        {invoice.number}
                      </span>
                    </span>

                    <p className="mt-1 text-xs text-ink-500">
                      {invoice.reference ? `${invoice.reference} · ` : ''}
                      {date(invoice.settledAt ?? invoice.issuedAt)}
                    </p>

                    {invoice.orderNumber && (
                      <Link
                        to={`/account/orders/${invoice.orderNumber}`}
                        className="mt-1 inline-block font-mono text-xs text-brand hover:underline"
                      >
                        {invoice.orderNumber}
                      </Link>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tnum text-md font-semibold text-ink-900">
                      {money(invoice.amount)}
                    </p>
                    <InvoiceDocumentLink number={invoice.number} className="-mr-2 mt-0.5" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <PaymentModal
        open={Boolean(paying)}
        onClose={() => {
          setPaying(null);
          setPayError(null);
        }}
        amount={payAmount}
        storeCredit={storeCredit}
        loading={busy}
        error={payError}
        title={payingAll ? 'Pay everything outstanding' : `Pay ${paying?.number ?? ''}`}
        description={
          payingAll
            ? `${due.length} amounts, settled oldest first in a single charge.`
            : 'Paid in full, this becomes an invoice you can file.'
        }
        onSubmit={handlePay}
      />

      {/* A single charge for the whole balance is worth a beat before it
          happens — the row-level Pay button is not, because its amount is right
          there next to it. */}
      <ConfirmDialog
        open={confirmPayAll}
        onClose={() => setConfirmPayAll(false)}
        title="Pay everything outstanding?"
        body={`${money(outstanding)} across ${due.length} amounts will be settled oldest first, in one charge.`}
        confirmLabel="Continue to payment"
        // Paying a bill you owe is not a destructive act — the default danger
        // styling would dress a routine payment up as something to fear.
        tone="info"
        onConfirm={() => {
          setConfirmPayAll(false);
          setPayError(null);
          setPaying('all');
        }}
      />
    </div>
  );
}

export default AccountInvoicesPage;
