import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { AlertCircle, Ban, Download, FileText, Receipt, Wallet } from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import { apiUrl } from '@/lib/api';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminInvoices, useAdminMutations } from '@/hooks/useAdmin';

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/invoices'], icon: adminIcon('FileText') };

/**
 * `overdue` is derived from the due date rather than stored, so it sits
 * alongside the real statuses as a filter without ever being written to a row.
 * The dashboard links straight here with `?status=overdue`.
 */
const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_TONES = { paid: 'ok', partial: 'warn', unpaid: 'neutral', overdue: 'danger' };

const METHODS = [
  { value: 'e-transfer', label: 'e-Transfer' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit-card', label: 'Credit card' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day westward. */
function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Record a payment.
 *
 * The form sends an amount, a date, a method and a reference. It never sends a
 * status or a running total: the server recomputes `amountPaid` and the status
 * from the payment rows, which is the only way the header can be trusted to
 * agree with the rows beneath it.
 */
function PaymentForm({ invoice, onSubmit, onCancel, isPending, error }) {
  const outstanding = invoice.balance;
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      amountDollars: (outstanding / 100).toFixed(2),
      at: todayIso(),
      method: 'e-transfer',
      reference: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-[11px] bg-surface-2 p-3.5">
        <p className="font-mono text-[13px] font-medium text-ink-900">{invoice.number}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-500">{invoice.businessName}</p>
        <p className="tnum mt-1.5 text-[12.5px] text-ink-500">
          {money(invoice.amount)} invoiced · {money(invoice.amountPaid)} paid ·{' '}
          <span className="font-medium text-ink-900">{money(outstanding)} outstanding</span>
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Amount" inputMode="decimal" suffix="CAD" {...register('amountDollars')} />
        <Input label="Received on" type="date" max={todayIso()} {...register('at')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField control={control} name="method" label="Method" options={METHODS} />
        <Input label="Reference" placeholder="Cheque no. or transfer id" {...register('reference')} />
      </div>

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-500">
        The invoice status is recalculated from its payments — record the amount received, not the
        new balance.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={outstanding <= 0}>
          Record payment
        </Button>
      </div>
    </form>
  );
}

/** Voiding forgives the balance and keeps the row, so the reason is required. */
function VoidForm({ invoice, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit } = useForm({ defaultValues: { reason: '' } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="rounded-[10px] bg-warn-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-warn">
        Voiding writes off the {money(invoice.balance)} still outstanding on {invoice.number}. The
        invoice stays on the account with the reason attached — it is not deleted.
      </p>

      {error && (
        <p className="flex items-start gap-2 text-[12.5px] text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Input
        label="Reason"
        placeholder="Duplicate of INV-2026-00041"
        {...register('reason')}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={isPending}>
          Void invoice
        </Button>
      </div>
    </form>
  );
}

export function AdminInvoicesPage() {
  const [query, setQuery] = useState('');
  const [paying, setPaying] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') ?? 'all';

  const { data, isLoading } = useAdminInvoices({ status, q: query || undefined });
  const { recordInvoicePayment, voidInvoice } = useAdminMutations();

  const invoices = data?.invoices ?? [];
  const counts = data?.counts ?? {};
  const totals = data?.totals ?? {};

  function setStatus(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  }

  const columns = [
    {
      key: 'number',
      header: 'Invoice',
      priority: 1,
      render: (invoice) => (
        <>
          <span className="block whitespace-nowrap font-mono text-[12.5px] font-medium text-ink-900">
            {invoice.number}
          </span>
          {invoice.orderNumber && (
            <span className="block whitespace-nowrap text-[11px] text-ink-400">
              {invoice.orderNumber}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'businessName',
      header: 'Client',
      priority: 2,
      className: 'max-w-[180px] truncate',
    },
    {
      key: 'issuedAt',
      header: 'Issued',
      priority: 3,
      render: (invoice) => (
        <span className="text-[12.5px] text-ink-500">{date(invoice.issuedAt)}</span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due',
      priority: 2,
      render: (invoice) =>
        invoice.dueDate ? (
          <span
            className={`text-[12.5px] ${invoice.status === 'overdue' ? 'font-medium text-danger' : 'text-ink-500'}`}
          >
            {date(invoice.dueDate)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
    {
      key: 'terms',
      header: 'Terms',
      priority: 3,
      render: (invoice) => (
        <span className="text-[12.5px] text-ink-500">{invoice.terms.replace('net', 'Net ')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      render: (invoice) => (
        <Badge tone={STATUS_TONES[invoice.status]} size="sm">
          {invoice.status === 'partial' ? 'partly paid' : invoice.status}
        </Badge>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      priority: 1,
      align: 'right',
      className: 'tnum',
      render: (invoice) => (
        <>
          <span
            className={`text-[13px] font-medium ${invoice.balance > 0 ? 'text-ink-900' : 'text-ok'}`}
          >
            {money(invoice.balance)}
          </span>
          <span className="block text-[11px] text-ink-400">of {money(invoice.amount)}</span>
        </>
      ),
    },
  ];

  const rowMenu = [
    {
      key: 'pay',
      label: 'Record payment',
      icon: Wallet,
      disabled: (invoice) => invoice.balance <= 0,
      onSelect: setPaying,
    },
    {
      key: 'document',
      label: 'Open document',
      icon: Download,
      // Rendered by the same renderer as the buyer's copy, so what an admin
      // reads over the phone is exactly what the customer is looking at.
      onSelect: (invoice) =>
        window.open(apiUrl(`/admin/invoices/${invoice.number}/document`), '_blank', 'noopener'),
    },
    {
      key: 'void',
      label: 'Void invoice',
      icon: Ban,
      tone: 'danger',
      disabled: (invoice) => invoice.balance <= 0,
      onSelect: setVoiding,
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <KpiRow
        tiles={[
          {
            key: 'billed',
            label: 'Invoiced',
            value: money(totals.billed ?? 0),
            hint: `${formatCount(invoices.length)} shown`,
            tone: 'brand',
            icon: Receipt,
          },
          {
            key: 'paid',
            label: 'Paid',
            value: money(totals.paid ?? 0),
            hint: 'Received against these invoices',
            tone: 'ok',
            icon: Wallet,
          },
          {
            key: 'outstanding',
            label: 'Outstanding',
            value: money(totals.outstanding ?? 0),
            hint: 'Still owed on these invoices',
            tone: (totals.outstanding ?? 0) > 0 ? 'warn' : 'ok',
            icon: FileText,
          },
          {
            key: 'overdue',
            label: 'Overdue',
            value: formatCount(counts.overdue ?? 0),
            hint: 'Past their due date, unpaid',
            tone: (counts.overdue ?? 0) > 0 ? 'danger' : 'ok',
            icon: AlertCircle,
          },
        ]}
      />

      <Panel flush>
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Invoice number, business or email…"
          pills={PILLS.map((pill) => ({ ...pill, count: counts[pill.value] }))}
          activePill={status}
          onPillChange={setStatus}
          onExport={(format) =>
            window.alert(
              `Export to ${format} arrives in phase 12. It will carry the current filters: ` +
                `status "${status}"${query ? `, search "${query}"` : ''}.`,
            )
          }
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={invoices.length}
            noun={invoices.length === 1 ? 'invoice' : 'invoices'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={invoices}
          rowKey={(invoice) => invoice.number}
          rowMenu={rowMenu}
          loading={isLoading}
          defaultSort={{ key: 'issuedAt', direction: 'desc' }}
          empty={
            <PanelEmpty
              icon={FileText}
              title="No invoices match"
              body="Try a different filter or search."
            />
          }
        />
      </Panel>

      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title="Record a payment"
        size="md"
        align="top"
      >
        {paying && (
          <PaymentForm
            invoice={paying}
            isPending={recordInvoicePayment.isPending}
            error={recordInvoicePayment.error?.message}
            onCancel={() => setPaying(null)}
            onSubmit={(values) =>
              recordInvoicePayment.mutate(
                { number: paying.number, ...values },
                { onSuccess: () => setPaying(null) },
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title="Void invoice"
        size="md"
        align="top"
      >
        {voiding && (
          <VoidForm
            invoice={voiding}
            isPending={voidInvoice.isPending}
            error={voidInvoice.error?.message}
            onCancel={() => setVoiding(null)}
            onSubmit={(values) =>
              voidInvoice.mutate(
                { number: voiding.number, reason: values.reason },
                { onSuccess: () => setVoiding(null) },
              )
            }
          />
        )}
      </Modal>
    </>
  );
}

export default AdminInvoicesPage;
