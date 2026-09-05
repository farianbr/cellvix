import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  ClipboardList,
  FileSignature,
  FileText,
  History,
  Mail,
  Phone,
  Receipt,
  Smartphone,
  Stethoscope,
  Trash2,
  Wrench,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, dateTime, count as formatCount } from '@/lib/format';
import { TICKET_STATUSES, TICKET_STATUS_LABELS } from '@shared/schemas/admin';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import { useAdminTicket, useAdminMutations } from '@/hooks/useAdmin';
import { pressable, pressableSurface } from '@/lib/motion';

/**
 * One repair, from drop-off to invoice.
 *
 * **The screen the panel was missing.** Tickets had a list and a form but no
 * detail view, so the only way to read a job was to open the edit form — which
 * shows every field as an input and answers none of the questions an operator
 * actually arrives with: where is this up to, what did we quote, what has been
 * paid, and what happens next.
 *
 * The order of the page is the order of those questions. Stage first, because
 * it is the one thing that changes daily and the one thing a customer rings
 * about. Then the money already taken, then the fault and the work, then the
 * history. The lifecycle strip at the foot is the map — it says where this
 * ticket sits in a process that outlives any one screen.
 */

/** The tones the status ladder reads in. Open states warm, terminal ones cool. */
const STATUS_TONES = {
  diagnosis: 'info',
  accepted: 'info',
  waiting_for_parts: 'warn',
  ready_to_repair: 'info',
  processing: 'warn',
  retention_policy: 'warn',
  ready_to_pickup: 'ok',
  completed: 'ok',
  cancelled: 'danger',
};

const DEPOSIT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit card' },
  { value: 'debit', label: 'Debit card' },
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const TERMS = [
  { value: 'prepaid', label: 'Prepaid — due on issue' },
  { value: 'net15', label: 'Net 15' },
  { value: 'net30', label: 'Net 30' },
  { value: 'net60', label: 'Net 60' },
];

/**
 * The four stations a repair passes through, as a map rather than a control.
 *
 * Not `StepIndicator`: that marks a position the user is moving through in a
 * form. This is a reference — the real ladder has nine statuses, and collapsing
 * them to four here would lie about where the ticket is. It says what the
 * process IS; the Move Stage control above says where this one sits.
 */
const LIFECYCLE = [
  { key: 'diagnosis', label: 'Diagnosis', icon: Stethoscope },
  { key: 'processing', label: 'In repair', icon: Wrench },
  { key: 'ready_to_pickup', label: 'Ready to pickup', icon: ClipboardList },
  { key: 'invoiced', label: 'Invoiced', icon: Receipt },
];

export function AdminTicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useAdminTicket(id);

  const {
    setTicketStatus,
    recordTicketDeposit,
    removeTicketDeposit,
    convertTicketToInvoice,
    deleteTicket,
  } = useAdminMutations();

  const [converting, setConverting] = useState(false);
  const [removingDeposit, setRemovingDeposit] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const ticket = data?.ticket;
  useSetRecordLabel(ticket?.ticketNumber);

  if (error) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Ticket" />
        <Panel>
          <PanelEmpty
            icon={AlertCircle}
            title="That ticket could not be opened"
            body={error.message}
          />
        </Panel>
      </>
    );
  }

  if (isLoading || !ticket) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const invoiced = Boolean(ticket.invoice);
  const balance = Math.max(0, (ticket.finalCents || ticket.estimateCents || 0) - ticket.depositTotal);

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title={ticket.ticketNumber}
        badge={
          <>
            <Badge tone={STATUS_TONES[ticket.status] ?? 'neutral'} size="sm">
              {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
            </Badge>
            <Badge tone={ticket.priority === 'urgent' ? 'danger' : 'neutral'} size="sm">
              {ticket.priority}
            </Badge>
            {ticket.overSla && (
              <Badge tone="warn" size="sm">
                {formatCount(ticket.age)} days
              </Badge>
            )}
          </>
        }
        action={
          <>
            <Link to={`/admin/tickets/${ticket.id}/edit`}>
              <Button size="sm" variant="outline" icon={FileText}>
                Edit
              </Button>
            </Link>
            {invoiced ? (
              <Link to={`/admin/invoices/${ticket.invoice.number ?? ticket.invoice.id}`}>
                <Button size="sm" icon={Receipt}>
                  View invoice
                </Button>
              </Link>
            ) : (
              <Button size="sm" icon={Receipt} onClick={() => setConverting(true)}>
                Convert to invoice
              </Button>
            )}
          </>
        }
      />

      {/* Where it came from, when it came from somewhere. A ticket raised off a
          quote is the same job the customer already agreed a price for, and
          losing that link makes the estimate look like it appeared by itself. */}
      {ticket.quote && (
        <Link
          to={`/admin/quotes/${ticket.quote.id}`}
          className={cn(
            pressableSurface,
            'group mb-4 flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 hover:border-line-strong',
          )}
        >
          <FileSignature className="size-4 shrink-0 text-brand" strokeWidth={2} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-ink-600">
            Created from quote{' '}
            <span className="font-mono font-medium text-ink-900">{ticket.quote.quoteNumber}</span>
          </p>
          <ArrowRight
            className="size-3.5 shrink-0 text-ink-300 transition-transform duration-fast ease-entrance group-hover:translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <StageCard
            ticket={ticket}
            disabled={invoiced}
            isPending={setTicketStatus.isPending}
            error={setTicketStatus.error?.message}
            onMove={(values) => setTicketStatus.mutate({ id: ticket.id, ...values })}
          />

          <DepositCard
            ticket={ticket}
            invoiced={invoiced}
            isPending={recordTicketDeposit.isPending}
            error={recordTicketDeposit.error?.message}
            onRecord={(values) => recordTicketDeposit.mutate({ id: ticket.id, ...values })}
            onRemove={setRemovingDeposit}
          />

          <Panel icon={Stethoscope} title="Reported fault">
            <p className="whitespace-pre-wrap text-sm text-ink-700">{ticket.issue}</p>
          </Panel>

          <WorkCard ticket={ticket} balance={balance} />

          <Panel icon={History} title="Timeline" flush={ticket.timeline?.length > 0}>
            {(ticket.timeline ?? []).length === 0 ? (
              <p className="text-sm text-ink-400">No history yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...ticket.timeline].reverse().map((entry, index) => (
                  <li key={index} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">
                        {TICKET_STATUS_LABELS[entry.status] ?? entry.status}
                      </p>
                      {entry.note && (
                        <p className="mt-0.5 text-sm text-ink-500">{entry.note}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-ink-400">{dateTime(entry.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <CustomerCard ticket={ticket} />
        </div>
      </div>

      <Lifecycle ticket={ticket} invoiced={invoiced} />

      {!invoiced && (
        <button
          type="button"
          onClick={() => setCancelling(true)}
          className={cn(
            pressable,
            'mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger-50 px-4 py-2.5 text-sm font-semibold text-danger hover:border-danger/50',
          )}
        >
          <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
          Cancel ticket
        </button>
      )}

      <ConvertModal
        open={converting}
        ticket={ticket}
        balance={balance}
        isPending={convertTicketToInvoice.isPending}
        error={convertTicketToInvoice.error?.message}
        onClose={() => setConverting(false)}
        onConfirm={(values) =>
          convertTicketToInvoice.mutate(
            { id: ticket.id, ...values },
            {
              onSuccess: (payload) => {
                setConverting(false);
                if (payload?.invoice?.number) {
                  navigate(`/admin/invoices/${payload.invoice.number}`);
                }
              },
            },
          )
        }
      />

      <ConfirmDialog
        open={Boolean(removingDeposit)}
        onClose={() => setRemovingDeposit(null)}
        onConfirm={() =>
          removeTicketDeposit.mutate(
            { id: ticket.id, depositId: removingDeposit.id },
            { onSuccess: () => setRemovingDeposit(null) },
          )
        }
        title="Remove this deposit?"
        body={`${money(removingDeposit?.amount ?? 0)} taken by ${removingDeposit?.method ?? 'cash'} will no longer be held against this ticket. Use this only for a deposit recorded in error.`}
        tone="danger"
        confirmLabel="Remove deposit"
        loading={removeTicketDeposit.isPending}
        error={removeTicketDeposit.error?.message}
      />

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() =>
          setTicketStatus.mutate(
            { id: ticket.id, status: 'cancelled', note: 'Ticket cancelled.' },
            { onSuccess: () => setCancelling(false) },
          )
        }
        title={`Cancel ${ticket.ticketNumber}?`}
        body="The job stops here and the ticket closes. Its history is kept, and any deposit taken stays recorded against it — refund that separately."
        tone="danger"
        confirmLabel="Cancel ticket"
        loading={setTicketStatus.isPending}
        error={setTicketStatus.error?.message}
      />
    </>
  );
}

/**
 * Move the job to its next stage.
 *
 * The **next** status is preselected, because advancing one rung is what
 * happens nine times in ten and pre-picking it turns the common case into one
 * click. Every other status stays available: a repair genuinely goes backwards
 * — a device on the bench returns to `waiting_for_parts` when a part turns out
 * to be wrong — and a control that only moved forward would make an operator
 * lie about where the job is.
 */
function StageCard({ ticket, disabled, isPending, error, onMove }) {
  const currentIndex = TICKET_STATUSES.indexOf(ticket.status);
  const next = TICKET_STATUSES[currentIndex + 1];

  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: { status: next ?? ticket.status, note: '' },
  });

  const chosen = watch('status');

  return (
    <Panel icon={ArrowRight} title="Move stage">
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      {disabled ? (
        <p className="text-sm text-ink-500">
          This ticket has been invoiced, so its stage is settled. Changes now belong on the invoice.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit((values) => onMove({ status: values.status, note: values.note || undefined }))}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
        >
          <SelectField
            control={control}
            name="status"
            label="Move to"
            options={TICKET_STATUSES.filter((status) => status !== ticket.status).map((status) => ({
              value: status,
              label:
                status === next
                  ? `${TICKET_STATUS_LABELS[status]} (next)`
                  : TICKET_STATUS_LABELS[status],
            }))}
          />
          <Input label="Note" placeholder="Stage change note…" {...register('note')} />
          <Button type="submit" size="sm" icon={ArrowRight} loading={isPending}>
            {TICKET_STATUS_LABELS[chosen] ?? 'Move'}
          </Button>
        </form>
      )}
    </Panel>
  );
}

/**
 * Money taken before the invoice exists.
 *
 * A repair is quoted, the customer pays something at the counter, and the
 * invoice is not raised until the work is done — so the payment has nowhere to
 * live. The hint says what happens to it, because "deposit" alone does not
 * explain why it is being recorded on a ticket rather than against a bill.
 */
function DepositCard({ ticket, invoiced, isPending, error, onRecord, onRemove }) {
  const { register, handleSubmit, control, reset } = useForm({
    defaultValues: { amountDollars: '', method: 'cash', note: '' },
  });

  return (
    <Panel
      icon={Banknote}
      title="Deposit"
      action={
        ticket.depositTotal > 0 && (
          <span className="tnum font-display text-md font-bold text-ink-900">
            {money(ticket.depositTotal)} held
          </span>
        )
      }
      flush={ticket.deposits.length > 0}
    >
      {ticket.deposits.length > 0 && (
        <ul className="divide-y divide-line border-b border-line">
          {ticket.deposits.map((deposit) => (
            <li key={deposit.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <p className="min-w-0 flex-1 text-sm text-ink-500">{dateTime(deposit.at)}</p>
              <p className="tnum shrink-0 text-sm font-semibold text-ink-900">
                {money(deposit.amount)}
              </p>
              <p className="w-24 shrink-0 text-right text-xs capitalize text-ink-500">
                {deposit.method}
              </p>
              {!invoiced && (
                <button
                  type="button"
                  onClick={() => onRemove(deposit)}
                  aria-label="Remove this deposit"
                  className={cn(
                    pressable,
                    'flex size-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger',
                  )}
                >
                  <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={cn(ticket.deposits.length > 0 && 'p-4 sm:p-5')}>
        {invoiced ? (
          <p className="text-sm text-ink-500">
            This ticket is invoiced. Record any further payment against the invoice.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-500">
              Customer paid before the invoice exists? Record it here — it carries over as a payment
              when this ticket becomes an invoice.
            </p>

            {error && (
              <p className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                {error}
              </p>
            )}

            <form
              onSubmit={handleSubmit((values) => {
                onRecord(values);
                reset({ amountDollars: '', method: values.method, note: '' });
              })}
              className="grid gap-3 sm:grid-cols-[120px_minmax(0,160px)_minmax(0,1fr)_auto] sm:items-end"
            >
              <Input
                label="Amount"
                required
                inputMode="decimal"
                placeholder="0.00"
                {...register('amountDollars')}
              />
              <SelectField control={control} name="method" label="Method" options={DEPOSIT_METHODS} />
              <Input label="Note" placeholder="optional" {...register('note')} />
              <Button type="submit" size="sm" loading={isPending}>
                Record
              </Button>
            </form>
          </>
        )}
      </div>
    </Panel>
  );
}

/** The devices, what was done to each, and what it comes to. */
function WorkCard({ ticket, balance }) {
  const devices = ticket.devices ?? [];
  const gross = devices.reduce(
    (sum, device) =>
      sum +
      [...(device.services ?? []), ...(device.parts ?? [])].reduce(
        (n, line) => n + (line.priceCents ?? 0) * (line.qty ?? 1),
        0,
      ),
    0,
  );

  return (
    <Panel icon={Wrench} title="Services and parts">
      {devices.length === 0 ? (
        <p className="text-sm text-ink-400">Nothing priced yet.</p>
      ) : (
        <div className="space-y-4">
          {devices.map((device, index) => {
            const lines = [
              ...(device.services ?? []).map((line) => ({ ...line, kind: 'Service' })),
              ...(device.parts ?? []).map((line) => ({ ...line, kind: 'Part' })),
            ];

            return (
              <div key={index}>
                <p className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold text-ink-900">
                  <Smartphone className="size-3.5 text-brand" strokeWidth={2.25} aria-hidden="true" />
                  {[device.brand, device.series, device.model].filter(Boolean).join(' ') ||
                    `Device ${index + 1}`}
                </p>

                {device.serial && (
                  <p className="mb-2 font-mono text-2xs text-ink-400">Serial {device.serial}</p>
                )}

                {lines.length === 0 ? (
                  <p className="text-sm text-ink-400">Nothing priced on this device.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {lines.map((line, lineIndex) => (
                      <li
                        key={lineIndex}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <span className="w-14 shrink-0 text-2xs uppercase tracking-wide text-ink-400">
                          {line.kind}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-ink-900">{line.name}</span>
                        <span className="tnum w-10 shrink-0 text-right text-ink-500">
                          ×{line.qty ?? 1}
                        </span>
                        <span className="tnum w-24 shrink-0 text-right font-medium text-ink-900">
                          {money((line.priceCents ?? 0) * (line.qty ?? 1))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* The arithmetic, in the order the server applies it. */}
      <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
        <Row label="Subtotal" value={money(gross - (ticket.discountCents ?? 0))} />
        {ticket.discountCents > 0 && (
          <Row label="Discount" value={`− ${money(ticket.discountCents)}`} />
        )}
        <Row
          label={`Tax${ticket.taxRate ? ` (${ticket.taxRate}%)` : ''}`}
          value={money(ticket.taxCents ?? 0)}
        />
        <div className="flex items-baseline justify-between border-t border-line pt-2 font-display text-md font-bold text-ink-900">
          <dt>Total</dt>
          <dd className="tnum">{money(ticket.finalCents || ticket.estimateCents || 0)}</dd>
        </div>
        {ticket.depositTotal > 0 && (
          <>
            <Row label="Deposit held" value={`− ${money(ticket.depositTotal)}`} />
            <div className="flex items-baseline justify-between pt-1 text-sm font-semibold text-ink-900">
              <dt>Still to pay</dt>
              <dd className="tnum">{money(balance)}</dd>
            </div>
          </>
        )}
      </dl>
    </Panel>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between text-ink-600">
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}

/** Who it belongs to and what came in. */
function CustomerCard({ ticket }) {
  return (
    <Panel
      icon={ClipboardList}
      title="Customer"
      action={
        ticket.customer.userId && (
          <Link
            to={`/admin/clients/${ticket.customer.userId}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700"
          >
            View
            <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          </Link>
        )
      }
    >
      <p className="font-display text-md font-bold text-ink-900">{ticket.customer.name}</p>

      <div className="mt-2 space-y-1.5 text-sm text-ink-600">
        {ticket.customer.phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0 text-ink-300" strokeWidth={2.25} aria-hidden="true" />
            {ticket.customer.phone}
          </p>
        )}
        {ticket.customer.email && (
          <p className="flex min-w-0 items-center gap-1.5">
            <Mail className="size-3.5 shrink-0 text-ink-300" strokeWidth={2.25} aria-hidden="true" />
            <span className="truncate">{ticket.customer.email}</span>
          </p>
        )}
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-line pt-3 text-sm">
        <Detail label="Technician" value={ticket.technician?.name ?? 'Unassigned'} />
        <Detail label="Source" value={ticket.source} />
        <Detail label="Created" value={date(ticket.createdAt)} />
        {ticket.closedAt && <Detail label="Completed" value={date(ticket.closedAt)} />}
        {ticket.dueDate && <Detail label="Due" value={date(ticket.dueDate)} />}
      </dl>
    </Panel>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="eyebrow text-ink-400">{label}</dt>
      <dd className="mt-0.5 capitalize text-ink-900">{value}</dd>
    </div>
  );
}

/**
 * The four stations a repair passes through.
 *
 * A map of the process, not a control and not a claim about this ticket's exact
 * rung — the real ladder has nine statuses. The station the ticket is nearest
 * is marked so the strip answers "roughly where are we" at a glance, which is
 * the question somebody scanning has.
 */
function Lifecycle({ ticket, invoiced }) {
  const reached = invoiced
    ? 3
    : ['ready_to_pickup', 'completed'].includes(ticket.status)
      ? 2
      : ['processing', 'ready_to_repair', 'waiting_for_parts'].includes(ticket.status)
        ? 1
        : 0;

  return (
    <section className="mt-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-4 text-center font-display text-md font-bold text-ink-900">
        Life cycle of a ticket
      </h2>

      <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
        {LIFECYCLE.map((station, index) => {
          const done = index <= reached;

          return (
            <li key={station.key} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2',
                  done ? 'border-brand/30 bg-brand-50' : 'border-line bg-surface',
                )}
              >
                <station.icon
                  className={cn('size-4 shrink-0', done ? 'text-brand' : 'text-ink-300')}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-sm font-semibold',
                    done ? 'text-brand-700' : 'text-ink-400',
                  )}
                >
                  {station.label}
                </span>
              </div>

              {index < LIFECYCLE.length - 1 && (
                <span className="text-ink-300" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Raising the invoice.
 *
 * Only the terms are asked. Everything billed comes off the ticket, because
 * that is where the job was priced — a form that let the operator restate the
 * lines here would be a second place for them to differ. The summary states
 * what will be carried so the conversion is not a leap of faith.
 */
function ConvertModal({ open, ticket, balance, isPending, error, onClose, onConfirm }) {
  const { handleSubmit, control } = useForm({ defaultValues: { terms: 'prepaid' } });

  return (
    <Modal open={open} onClose={onClose} title="Convert to invoice" size="md" align="top">
      <form onSubmit={handleSubmit(onConfirm)} className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="rounded-md bg-surface-2 p-3.5">
          <p className="eyebrow mb-2 text-ink-400">What carries over</p>
          <dl className="space-y-1.5 text-sm">
            <Row
              label={`${formatCount(ticket.devices?.length ?? 0)} device${(ticket.devices?.length ?? 0) === 1 ? '' : 's'}, priced as invoiced`}
              value={money(ticket.finalCents || ticket.estimateCents || 0)}
            />
            {ticket.depositTotal > 0 && (
              <Row label="Deposit, as a payment" value={`− ${money(ticket.depositTotal)}`} />
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-1.5 font-semibold text-ink-900">
              <dt>Balance on the new invoice</dt>
              <dd className="tnum">{money(balance)}</dd>
            </div>
          </dl>
        </div>

        <SelectField control={control} name="terms" label="Payment terms" options={TERMS} />

        <p className="rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-500">
          The ticket stays as the record of the work. It cannot be invoiced twice, and any deposit
          on it becomes a payment against the new invoice.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={Receipt} loading={isPending}>
            Create invoice
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdminTicketDetailPage;
