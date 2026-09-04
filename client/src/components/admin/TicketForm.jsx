import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import {
  AlertCircle,
  ClipboardCheck,
  Info,
  Lock,
  Plus,
  Smartphone,
  StickyNote,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  CONDITION_GRADES,
  CONDITION_PARTS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_SOURCES,
} from '@shared/schemas/admin';
import { PROVINCES } from '@shared/schemas/checkout';
import cn from '@/lib/cn';
import { money, titleize } from '@/lib/format';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import SelectField from '@/components/ui/SelectField';

/**
 * Taking a repair in at the counter.
 *
 * **The form is the intake sheet**, not a thin wrapper over the ticket record.
 * A shop takes in a device by writing down what came in, what state it was in,
 * what the customer says is wrong, and what the job is expected to cost — and
 * every one of those is evidence later. So the form is sectioned the way that
 * conversation actually goes: who, what devices, what notes, what it costs.
 *
 * ## The parts that are not obvious
 *
 * **Condition is graded before work starts.** It is the shop's protection: a
 * customer who says the back camera worked when they handed the phone over is
 * answered by the row they were shown at drop-off, not by anybody's memory.
 * `untested` is a real answer and is deliberately distinct from `not present`.
 *
 * **The total is a preview.** Every figure below the lines is computed here for
 * the operator to see, and computed *again* on the server from the same lines
 * (§5.3). Nothing this form calculates is trusted — a client that could set the
 * price of the work would be setting the price of the work.
 *
 * **Short intake still works.** Every field except the customer is optional, so
 * a walk-in can be booked in under a minute and priced properly later. That is
 * the case this form exists to serve; the long version is for when the counter
 * already knows the job.
 */

const STATUS_OPTIONS = TICKET_STATUSES.map((value) => ({
  value,
  label: TICKET_STATUS_LABELS[value],
}));
const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((value) => ({ value, label: titleize(value) }));
const SOURCE_OPTIONS = TICKET_SOURCES.map((value) => ({ value, label: titleize(value) }));
const CONDITION_OPTIONS = [{ value: '', label: '— select —' }, ...CONDITION_GRADES];

/** One blank device. Only the model is required, so the rest starts empty. */
const emptyDevice = () => ({
  category: '',
  brand: '',
  series: '',
  model: '',
  serial: '',
  passcode: '',
  problem: '',
  solution: '',
  notes: '',
  condition: {},
  services: [],
  parts: [],
});

const emptyLine = () => ({ name: '', description: '', priceDollars: '', qty: 1 });

/** A titled slab. The form is long, and unbroken it reads as one wall of inputs. */
function Section({ icon: Icon, title, hint, children, className }) {
  return (
    <section className={cn('rounded-[12px] border border-line bg-surface p-4', className)}>
      <h3 className="mb-3 flex items-center gap-2 border-b border-line pb-2.5 font-display text-[13.5px] font-bold text-ink-900">
        <Icon className="size-4 shrink-0 text-brand" strokeWidth={2} aria-hidden="true" />
        {title}
        {hint && <span className="font-normal text-[12px] text-ink-400">{hint}</span>}
      </h3>
      {children}
    </section>
  );
}

/**
 * The priced lines on one device — services performed, or parts fitted.
 *
 * One component for both because they are the same thing on an invoice: a
 * description and a price. They are separate arrays only because a technician
 * thinks about them separately.
 */
function LineEditor({ control, register, name, label, addLabel }) {
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="mt-3">
      <p className="eyebrow mb-2 text-ink-400">{label}</p>

      {fields.length === 0 && (
        <p className="mb-2 text-[12px] text-ink-400">Nothing added yet.</p>
      )}

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_90px_80px_auto]">
            <Input
              placeholder="Name"
              aria-label={`${label} name`}
              {...register(`${name}.${index}.name`)}
            />
            <Input
              placeholder="Description (optional)"
              aria-label={`${label} description`}
              {...register(`${name}.${index}.description`)}
            />
            <Input
              placeholder="0.00"
              inputMode="decimal"
              aria-label={`${label} price`}
              {...register(`${name}.${index}.priceDollars`)}
            />
            <Input
              placeholder="Qty"
              inputMode="numeric"
              aria-label={`${label} quantity`}
              {...register(`${name}.${index}.qty`)}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove this ${label.toLowerCase()} line`}
              className="flex size-9 shrink-0 items-center justify-center self-end rounded-[8px] border border-line text-ink-400 transition-colors hover:border-danger/40 hover:text-danger active:scale-[0.97]"
            >
              <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        size="xs"
        variant="outline"
        icon={Plus}
        className="mt-2"
        onClick={() => append(emptyLine())}
      >
        {addLabel}
      </Button>
    </div>
  );
}

/** One device block: what it is, what is wrong, how it tested, what it costs. */
function DeviceBlock({ control, register, index, canRemove, onRemove }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface-2/50 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-display text-[13px] font-bold text-ink-900">
          <Smartphone className="size-3.5 text-brand" strokeWidth={2} aria-hidden="true" />
          Device #{index + 1}
        </p>
        {canRemove && (
          <Button type="button" size="xs" variant="outline" icon={Trash2} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Category" placeholder="Smartphone" {...register(`devices.${index}.category`)} />
        <Input label="Brand" placeholder="Apple" {...register(`devices.${index}.brand`)} />
        <Input label="Device / Series" placeholder="iPhone 15" {...register(`devices.${index}.series`)} />
        <Input label="Model" required placeholder="iPhone 15 Pro" {...register(`devices.${index}.model`)} />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input label="Serial number" placeholder="e.g. IMEI or S/N" {...register(`devices.${index}.serial`)} />
        <Input
          label="Passcode / PIN"
          placeholder="For testing (optional)"
          hint="Never printed on a customer document."
          {...register(`devices.${index}.passcode`)}
        />
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        <Textarea label="Problem" rows={2} placeholder="What's wrong with this device…" {...register(`devices.${index}.problem`)} />
        <Textarea label="Solution" rows={2} placeholder="How it was / will be fixed…" {...register(`devices.${index}.solution`)} />
        <Textarea label="Notes" rows={2} placeholder="Anything else about this device…" {...register(`devices.${index}.notes`)} />
      </div>

      {/* Graded at drop-off — see the note at the top of this file. */}
      <div className="mt-3">
        <p className="eyebrow mb-2 flex items-center gap-1.5 text-ink-400">
          <ClipboardCheck className="size-3.5 text-brand" strokeWidth={2} aria-hidden="true" />
          Device condition <span className="normal-case tracking-normal">(at drop-off)</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CONDITION_PARTS.map((part) => (
            <SelectField
              key={part.key}
              control={control}
              name={`devices.${index}.condition.${part.key}`}
              label={part.label}
              options={CONDITION_OPTIONS}
            />
          ))}
        </div>
      </div>

      <LineEditor
        control={control}
        register={register}
        name={`devices.${index}.services`}
        label="Services for this device"
        addLabel="Add service"
      />
      <LineEditor
        control={control}
        register={register}
        name={`devices.${index}.parts`}
        label="Parts required for this device"
        addLabel="Add part"
      />
    </div>
  );
}

/**
 * The running total.
 *
 * Recomputed on every keystroke from the lines above, and **recomputed again by
 * the server** from the same lines when the form is submitted. This is a
 * preview so the counter can quote a figure while the customer is standing
 * there; it is never the number that gets stored.
 */
function useTicketTotal(control) {
  const devices = useWatch({ control, name: 'devices' }) ?? [];
  const discount = Number(useWatch({ control, name: 'discountDollars' }) ?? 0) || 0;
  const taxRate = Number(useWatch({ control, name: 'taxRate' }) ?? 0) || 0;

  const gross = devices.reduce((sum, device) => {
    const lines = [...(device?.services ?? []), ...(device?.parts ?? [])];
    return (
      sum +
      lines.reduce(
        (n, line) => n + (Number(line?.priceDollars) || 0) * (Number(line?.qty) || 1),
        0,
      )
    );
  }, 0);

  // A discount can never exceed the work — the server clamps it the same way.
  const applied = Math.min(discount, gross);
  const subtotal = gross - applied;
  const tax = subtotal * (taxRate / 100);

  return {
    gross: Math.round(gross * 100),
    discount: Math.round(applied * 100),
    subtotal: Math.round(subtotal * 100),
    tax: Math.round(tax * 100),
    total: Math.round((subtotal + tax) * 100),
  };
}

export function TicketForm({ ticket, seed, technicians = [], onSubmit, onCancel, isPending, error }) {
  const editing = Boolean(ticket);

  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      customerName: ticket?.customer.name ?? seed?.name ?? '',
      customerPhone: ticket?.customer.phone ?? seed?.phone ?? '',
      customerEmail: ticket?.customer.email ?? seed?.email ?? '',

      devices: ticket?.devices?.length
        ? ticket.devices.map((device) => ({
            ...emptyDevice(),
            ...device,
            condition: device.condition ?? {},
            services: (device.services ?? []).map((line) => ({
              ...line,
              priceDollars: String((line.priceCents ?? 0) / 100),
            })),
            parts: (device.parts ?? []).map((line) => ({
              ...line,
              priceDollars: String((line.priceCents ?? 0) / 100),
            })),
          }))
        : [
            {
              ...emptyDevice(),
              // An older ticket has no `devices`, so its legacy columns seed the
              // first block rather than opening an empty form over real data.
              brand: ticket?.device?.brand ?? '',
              model: ticket?.device?.model ?? '',
              serial: ticket?.device?.serial ?? '',
              problem: ticket?.issue ?? '',
            },
          ],

      status: ticket?.status ?? 'diagnosis',
      priority: ticket?.priority ?? 'normal',
      source: ticket?.source ?? 'counter',
      technician: ticket?.technician?.id ?? '',
      dueDate: ticket?.dueDate ? new Date(ticket.dueDate).toISOString().slice(0, 10) : '',

      clientNotes: ticket?.clientNotes ?? '',
      technicianNotes: ticket?.technicianNotes ?? '',
      notes: ticket?.notes ?? '',

      discountDollars: ticket ? String((ticket.discountCents ?? 0) / 100) : '',
      discountCode: ticket?.discountCode ?? '',
      province: ticket?.province ?? '',
      taxRate: ticket?.taxRate ?? 5,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'devices' });
  const totals = useTicketTotal(control);

  const technicianOptions = [
    { value: '', label: 'Unassigned' },
    ...technicians.map((person) => ({ value: person.id, label: person.name })),
  ];

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          ...values,
          // A blank grade means "not recorded", which is not the same fact as
          // `untested` — so empty keys are dropped rather than sent as ''.
          devices: values.devices.map((device) => ({
            ...device,
            condition: Object.fromEntries(
              Object.entries(device.condition ?? {}).filter(([, grade]) => grade),
            ),
          })),
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

      <Section icon={Info} title="Basic information">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Customer name" required {...register('customerName')} />
          <Input label="Phone" required placeholder="+1 780 555 0134" {...register('customerPhone')} />
        </div>
        <Input
          label="Email"
          type="email"
          hint="Optional — used only if the shop emails a receipt."
          containerClassName="mt-2"
          {...register('customerEmail')}
        />

        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {!editing && (
            <SelectField control={control} name="status" label="Status" options={STATUS_OPTIONS} />
          )}
          <SelectField control={control} name="priority" label="Priority" options={PRIORITY_OPTIONS} />
          <Input label="Est. completion" type="date" {...register('dueDate')} />
          <SelectField
            control={control}
            name="technician"
            label="Assign technician"
            options={technicianOptions}
          />
          <SelectField control={control} name="source" label="Source" options={SOURCE_OPTIONS} />
        </div>
      </Section>

      <Section icon={Wrench} title="Devices & services">
        <div className="space-y-3">
          {fields.map((field, index) => (
            <DeviceBlock
              key={field.id}
              control={control}
              register={register}
              index={index}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          icon={Plus}
          className="mt-3"
          onClick={() => append(emptyDevice())}
        >
          Add device
        </Button>
      </Section>

      <Section icon={StickyNote} title="Notes">
        <div className="grid gap-2 lg:grid-cols-2">
          <Textarea
            label="Client notes"
            rows={2}
            hint="Visible to the customer on the printed ticket."
            placeholder="Visible to client…"
            {...register('clientNotes')}
          />
          <Textarea
            label="Technician notes"
            rows={2}
            hint="Also printed — technical detail the customer may keep."
            placeholder="Technician notes…"
            {...register('technicianNotes')}
          />
        </div>

        {/* The one field that must never reach a customer document, marked as
            such rather than left to be remembered. */}
        <div className="mt-2 rounded-[10px] border border-warn/30 bg-warn-50/50 p-3">
          <Textarea
            label={
              <span className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-warn" strokeWidth={2} aria-hidden="true" />
                Internal notes
                <span className="text-[11px] font-normal text-warn">
                  confidential — never printed
                </span>
              </span>
            }
            rows={2}
            placeholder="Not on any customer document…"
            {...register('notes')}
          />
        </div>
      </Section>

      <Section icon={ClipboardCheck} title="Ticket summary">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Discount (CAD)"
            inputMode="decimal"
            hint="Applied before tax."
            {...register('discountDollars')}
          />
          <Input label="Discount code" placeholder="e.g. SUMMER10" {...register('discountCode')} />
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <SelectField
            control={control}
            name="province"
            label="Province"
            options={[{ value: '', label: '— pick province —' }, ...PROVINCES]}
          />
          <Input
            label="Tax rate (%)"
            inputMode="decimal"
            hint="0 = tax exempt."
            {...register('taxRate')}
          />
        </div>

        {/* A preview. The server recomputes all of this from the lines — see
            the note at the top of this file. */}
        <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Services &amp; parts</dt>
            <dd className="tnum text-ink-900">{money(totals.gross)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Discount</dt>
              <dd className="tnum text-danger">−{money(totals.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Tax</dt>
            <dd className="tnum text-ink-900">{money(totals.tax)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2">
            <dt className="font-display font-bold text-ink-900">Total</dt>
            <dd className="tnum font-display text-[17px] font-bold text-ink-900">
              {money(totals.total)}
            </dd>
          </div>
        </dl>

        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-400">
          An estimate, not an invoice. Nothing here moves a balance — billing a finished repair is
          a separate step.
        </p>
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {editing ? 'Save ticket' : 'Create ticket'}
        </Button>
      </div>
    </form>
  );
}

export default TicketForm;
