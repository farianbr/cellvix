import mongoose from 'mongoose';

/**
 * The scheduling board's data model (ERP rework §6.15 category 4, §6b U1–U2,
 * phase 11e).
 *
 * **The model is real; the screens do not write to it yet.** §6b rule 3 is
 * explicit about why — "real data model from day one, so turning a channel on
 * later is a service swap, not a migration". The Calendar and Appointments
 * screens render their full chrome against this and it ships empty.
 *
 * **What Cellvix schedules is still assumed, not settled** (§12 Q1). A
 * wholesaler has no repair calendar, but it does have pickups, deliveries and
 * RMA drop-offs, and the same weekly board serves them. That reading is what
 * `kind` encodes below — and it is the one thing here worth re-confirming before
 * the board is wired, because it is the field the rest of the shape hangs off.
 *
 * Deliberately conservative until then: `relatedTo` is a loose
 * `{ kind, id }` rather than four optional refs, so attaching an appointment to
 * an RMA or an order later does not need a schema change.
 */

const APPOINTMENT_KINDS = [
  { value: 'pickup', label: 'Customer pickup' },
  { value: 'delivery', label: 'Local delivery' },
  { value: 'rma_dropoff', label: 'RMA drop-off' },
  { value: 'other', label: 'Other' },
];

const APPOINTMENT_STATUSES = [
  { value: 'unscheduled', label: 'Unscheduled', tone: 'neutral' },
  { value: 'scheduled', label: 'Scheduled', tone: 'info' },
  { value: 'in_progress', label: 'In progress', tone: 'warn' },
  { value: 'done', label: 'Done', tone: 'ok' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
];

const appointmentSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: APPOINTMENT_KINDS.map((k) => k.value),
      default: 'pickup',
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    notes: { type: String, trim: true, maxlength: 2000 },

    /**
     * Null while unscheduled — which is the whole point of the tray beside the
     * weekly board. An appointment exists before anybody has decided when it
     * happens, and a required date would mean inventing one.
     */
    startAt: { type: Date, default: null, index: true },
    endAt: { type: Date, default: null },

    status: {
      type: String,
      enum: APPOINTMENT_STATUSES.map((s) => s.value),
      default: 'unscheduled',
      index: true,
    },

    // Who it is for, and who is handling it. Both optional: a delivery slot can
    // be blocked out before it is assigned to anybody.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null, index: true },

    /**
     * The record this is about, if any.
     *
     * A loose pair rather than four nullable refs, so attaching appointments to
     * a record type nobody has thought of yet is a value change rather than a
     * migration. `kind` is a string for the same reason `AuditLog.entity.id` is.
     */
    relatedTo: {
      kind: { type: String, default: '' },
      id: { type: String, default: '' },
      label: { type: String, default: '' },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// The weekly board reads a date window filtered by staff; the tray reads
// everything unscheduled.
appointmentSchema.index({ startAt: 1, status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export { APPOINTMENT_KINDS, APPOINTMENT_STATUSES, Appointment };
export default Appointment;
