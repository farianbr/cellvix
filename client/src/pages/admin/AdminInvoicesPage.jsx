import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { AlertCircle, Ban, Download, FileText, Plus, Receipt, Wallet } from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import { apiUrl } from '@/lib/api';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { TERMS } from '@/components/admin/ApproveClientForm';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminInvoices, useAdminUsers, useAdminMutations } from '@/hooks/useAdmin';
import useCreateParam from '@/hooks/useCreateParam';
import downloadExport from '@/lib/exportDownload';

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
        <p className="mt-0.5 text-[12.5px] text-ink-500">{invoice.displayName ?? invoice.businessName}</p>
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

/**
 * A standalone invoice — one raised against an account for something no order
 * covers: a restocking fee, a repair, an agreed adjustment (§7.2).
 *
 * It has no line items, and that is the model rather than an omission: an
 * invoice stores a single `amount`, so a reference and a note carry what it is
 * for. An invoice reading only "$240" is one nobody can reconcile six weeks
 * later, which is why the reference is asked for rather than tucked away.
 *
 * **A blank due date is not empty, it is "use the terms".** The hint says so,
 * because a date field that silently fills itself in after submission looks
 * like the form ignored what was typed.
 */
function InvoiceForm({ clients, defaultUser, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: {
      // `defaultUser` is how the customer profile raises an invoice against the
      // account already on screen (`?new=1&client=<id>`): it pre-picks the
      // client instead of forking a second, near-identical form that would
      // eventually disagree with this one about terms or due dates.
      user: defaultUser ?? clients[0]?.id ?? '',
      amountDollars: '',
      terms: 'prepaid',
      issuedAt: todayIso(),
      dueDate: '',
      reference: '',
      notes: '',
    },
  });

  const terms = watch('terms');

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          user: values.user,
          amount: Math.round(Number(values.amountDollars || 0) * 100),
          terms: values.terms,
          issuedAt: values.issuedAt || undefined,
          dueDate: values.dueDate || undefined,
          reference: values.reference || undefined,
          notes: values.notes || undefined,
        }),
      )}
      className="space-y-4"
    >
      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          control={control}
          name="user"
          label="Client"
          options={clients.map((client) => ({ value: client.id, label: client.displayName ?? client.businessName }))}
        />
        <Input
          label="Amount"
          inputMode="decimal"
          suffix="CAD"
          {...register('amountDollars')}
        />
      </div>

      <Input
        label="Reference"
        placeholder="Restocking fee, bench repair, agreed adjustment…"
        hint="What this invoice is for. It is the only description the invoice carries."
        {...register('reference')}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField control={control} name="terms" label="Payment terms" options={TERMS} />
        <Input label="Issued" type="date" {...register('issuedAt')} />
        <Input
          label="Due"
          type="date"
          hint={terms === 'prepaid' ? 'Blank means on issue.' : `Blank uses ${terms}.`}
          {...register('dueDate')}
        />
      </div>

      <Textarea label="Notes" rows={2} {...register('notes')} />

      {terms !== 'prepaid' && (
        <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-500">
          On terms, this draws on the client's line of credit until it is paid — the same as an
          invoice raised by an order.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Raise invoice
        </Button>
      </div>
    </form>
  );
}

export function AdminInvoicesPage() {
  const [query, setQuery] = useState('');
  const [paying, setPaying] = useState(null);
  const [voiding, setVoiding] = useState(null);
  // Holds the void reason until the invoice number has been retyped. Voiding is
  // the one invoice action with no matching un-void.
  const [voidConfirm, setVoidConfirm] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // Opened directly by `+ Create` (§7.2), which arrives with `?new=1`.
  // `client` seeds the form when the customer profile sends us here to raise
  // an invoice against the account already on screen.
  const [creating, setCreating, createSeed] = useCreateParam(true, false, ['client']);

  const status = searchParams.get('status') ?? 'all';

  const { data, isLoading } = useAdminInvoices({ status, q: query || undefined });
  // Any client can be invoiced — unlike an order, this does not need approval:
  // a pending account can still owe money for a repair.
  const { data: clientData } = useAdminUsers({});
  const { recordInvoicePayment, voidInvoice, createInvoice } = useAdminMutations();

  const clients = clientData?.users ?? [];

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
        action={
          <Button onClick={() => setCreating(true)} icon={Plus} disabled={!clients.length}>
            New invoice
          </Button>
        }
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
          onExport={(format) => downloadExport('invoices', format, { status, q: query || undefined })}
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
            // Reported on the confirm step, where the void is actually sent.
            error={voidConfirm ? undefined : voidInvoice.error?.message}
            onCancel={() => setVoiding(null)}
            onSubmit={(values) => setVoidConfirm(values)}
          />
        )}
      </Modal>

      {/* A void cannot be undone from the admin panel: the invoice stays on the
          record as void and a replacement has to be raised by hand. The number
          is retyped so the operator confirms which invoice they are killing. */}
      <ConfirmDialog
        open={Boolean(voidConfirm)}
        onClose={() => setVoidConfirm(null)}
        onConfirm={() =>
          voidInvoice.mutate(
            { number: voiding.number, reason: voidConfirm.reason },
            {
              onSuccess: () => {
                setVoidConfirm(null);
                setVoiding(null);
              },
            },
          )
        }
        title="Void this invoice?"
        body={
          voiding
            ? `Invoice ${voiding.number} for ${voiding.displayName ?? voiding.businessName} will be marked void.`
            : ''
        }
        consequence="There is no un-void. Billing this customer again means raising a replacement invoice."
        confirmPhrase={voiding?.number}
        confirmPhraseLabel="the invoice number"
        confirmLabel="Void invoice"
        loading={voidInvoice.isPending}
        error={voidInvoice.error?.message}
      />

      <Modal
        open={Boolean(creating)}
        onClose={() => setCreating(false)}
        title="New invoice"
        size="lg"
        align="top"
      >
        {creating && (
          <InvoiceForm
            clients={clients}
            defaultUser={createSeed.client}
            isPending={createInvoice.isPending}
            error={createInvoice.error?.message}
            onCancel={() => setCreating(false)}
            onSubmit={(values) =>
              createInvoice.mutate(values, {
                onSuccess: (payload) => {
                  setCreating(false);
                  // Straight to the invoice — the next thing an operator does is
                  // send it or record what has already been paid against it.
                  if (payload?.invoice?.number) {
                    navigate(`/admin/invoices/${payload.invoice.number}`);
                  }
                },
              })
            }
          />
        )}
      </Modal>
    </>
  );
}

export default AdminInvoicesPage;
