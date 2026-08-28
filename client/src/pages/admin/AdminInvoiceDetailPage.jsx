import { Link, useParams } from 'react-router';
import { ArrowLeft, FileText, Printer } from 'lucide-react';

import cn from '@/lib/cn';
import Panel, { StatTile } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminInvoice } from '@/hooks/useAdmin';
import { apiUrl } from '@/lib/api';
import { money, date, dateTime } from '@/lib/format';

/**
 * One invoice (§4b.6, phase 12).
 *
 * The endpoint and every write behind it landed in phase 4 — recording a
 * payment, voiding, rendering the document — but the screen never did, so the
 * route rendered a stub. Global search made that visible: an invoice hit
 * navigated straight into "not built yet".
 *
 * **Read-only here, deliberately.** Payments are recorded and invoices voided
 * from the Invoices list, which already holds those dialogs and the rules that
 * go with them — overpayment refused, status recomputed from the payment rows.
 * A second set of write controls would be a second place for those rules to
 * drift out of step.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/invoices/:number'], icon: adminIcon('FileText') };

const STATUS_TONE = {
  paid: 'ok',
  partial: 'info',
  unpaid: 'neutral',
  overdue: 'danger',
  void: 'neutral',
};

export function AdminInvoiceDetailPage() {
  const { number } = useParams();
  const { data, isLoading, error } = useAdminInvoice(number);

  if (isLoading) return <p className="text-[13px] text-ink-500">Loading invoice…</p>;

  if (error) {
    return (
      <>
        <PageHeader icon={ADMIN_PAGE.icon} title="Invoice not found" />
        <p className="text-[13px] text-ink-500">
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

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={invoice.number}
        description={`Issued ${date(invoice.issuedAt)} to ${invoice.businessName}.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/invoices"
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-600 transition-colors hover:border-ink-300 hover:bg-surface-2"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden="true" />
              All invoices
            </Link>
            <button
              type="button"
              onClick={() =>
                window.open(apiUrl(`/admin/invoices/${invoice.number}/document`), '_blank', 'noopener')
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
            >
              <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Document
            </button>
          </div>
        }
      />

      <div className="max-w-[860px] space-y-4">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Invoiced" value={money(invoice.amount)} />
          <StatTile label="Paid" value={money(invoice.amountPaid)} tone="ok" />
          <StatTile
            label="Balance"
            value={money(invoice.balance)}
            tone={invoice.balance > 0 ? 'warn' : 'neutral'}
          />
          <StatTile
            label="Status"
            value={invoice.status}
            tone={STATUS_TONE[invoice.status] ?? 'neutral'}
            hint={invoice.dueDate ? `Due ${date(invoice.dueDate)}` : null}
          />
        </div>

        <Panel title="Details">
          <dl className="grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Account</dt>
              <dd className="min-w-0 truncate">
                {invoice.userId ? (
                  <Link
                    to={`/admin/clients/${invoice.userId}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {invoice.businessName}
                  </Link>
                ) : (
                  <span className="text-ink-900">{invoice.businessName}</span>
                )}
              </dd>
            </div>

            {invoice.contactName && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Contact</dt>
                <dd className="text-ink-900">{invoice.contactName}</dd>
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
              <dd className="text-ink-900 uppercase">{invoice.terms}</dd>
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
          title="Payments"
          description="Recorded from the Invoices list. The paid total and status are recomputed from these rows."
        >
          {invoice.payments.length === 0 ? (
            <p className="text-[13px] text-ink-500">Nothing recorded against this invoice yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {invoice.payments.map((payment, index) => (
                <li
                  key={`${payment.at}-${index}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0"
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <span
                      className={cn(
                        'tnum font-display text-[14px] font-bold',
                        // A void is forgiveness, not money in — coloured
                        // differently so a glance at the list does not read it
                        // as a payment received.
                        payment.method === 'void' ? 'text-ink-400' : 'text-ink-900',
                      )}
                    >
                      {money(payment.amount)}
                    </span>
                    {payment.method && (
                      <Badge tone={payment.method === 'void' ? 'neutral' : 'info'}>
                        {payment.method}
                      </Badge>
                    )}
                    {payment.reference && (
                      <span className="truncate font-mono text-[12px] text-ink-400">
                        {payment.reference}
                      </span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-[12.5px] text-ink-500">
                    {dateTime(payment.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default AdminInvoiceDetailPage;
