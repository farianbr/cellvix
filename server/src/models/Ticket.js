import mongoose from 'mongoose';

/**
 * A repair ticket — a device brought in, diagnosed, worked on, collected.
 *
 * **The customer is free-typed, not an account reference.** A repair walks in
 * off the street; requiring an approved Cellvix business account before a
 * ticket can be opened would make the counter unusable. `customerName` and
 * `customerPhone` are the record, and the phone is what an operator searches
 * by, so it is indexed alongside the ticket number.
 *
 * The status list is a vocabulary, not a ladder. Unlike `Rma`, a repair does
 * not move in one direction: a device goes back to `waiting_for_parts` from
 * `processing` when the wrong screen arrives, and a technician who marks
 * something ready by mistake must be able to walk it back. Enforcing an order
 * here would cost more in workarounds than it would prevent in mistakes, so
 * `ticketService` accepts any status and records every move in `timeline`
 * instead — the audit trail is the control, not the transition table.
 */
const TICKET_STATUSES = [
  'diagnosis',
  'accepted',
  'waiting_for_parts',
  'ready_to_repair',
  'processing',
  'retention_policy',
  'ready_to_pickup',
  'completed',
  'cancelled',
];

/** Everything before pickup is live work, and ages against the SLA. */
const TICKET_OPEN_STATUSES = TICKET_STATUSES.filter(
  (status) => !['completed', 'cancelled', 'ready_to_pickup'].includes(status),
);

const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

/** Where the ticket came from. A kiosk intake is flagged in the list. */
const TICKET_SOURCES = ['counter', 'kiosk', 'web', 'phone'];

/**
 * How a component tested at drop-off.
 *
 * Recorded **before** work starts, because it is the shop's protection: a
 * customer who says the camera worked when they handed it over is answered by
 * the row they signed, not by memory. `untested` is a real answer and is
 * distinct from `not_present` — one is a thing nobody checked, the other is a
 * thing that was already missing.
 */
const CONDITION_GRADES = ['working', 'faulty', 'not_present', 'untested'];

/** The components a counter checks. One row each on the intake form. */
const CONDITION_PARTS = [
  'screen',
  'battery',
  'chargingPort',
  'backGlass',
  'frontCamera',
  'backCamera',
  'loudSpeaker',
  'earSpeaker',
];

/**
 * One line of work or one part fitted, priced.
 *
 * Services and parts are the same shape because they are the same thing on an
 * invoice — a description and a price. They are kept in separate arrays only so
 * the intake form can group them the way a technician thinks about them.
 */
const ticketLineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 300 },
    // Integer cents, like every other amount in this system.
    priceCents: { type: Number, default: 0, min: 0 },
    qty: { type: Number, default: 1, min: 1 },
    // Set when the line came from the catalogue rather than being typed.
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { _id: false },
);

/**
 * One device on a ticket.
 *
 * A ticket used to carry a single device inline. A customer bringing in two
 * handsets then needed two tickets, which split one job — one drop-off, one
 * collection, one invoice — into two records that had to be kept in step by
 * hand. The device is its own subdocument now, and a ticket holds a list.
 */
const ticketDeviceSchema = new mongoose.Schema(
  {
    category: { type: String, trim: true, maxlength: 60 },
    brand: { type: String, trim: true, maxlength: 60 },
    series: { type: String, trim: true, maxlength: 120 },
    model: { type: String, trim: true, maxlength: 120 },
    // The serial or IMEI as read off the device. Not unique: the same handset
    // can come back a second time, and that history is worth keeping.
    serial: { type: String, trim: true, maxlength: 80 },
    // Stored so a technician can actually get into the device. Never rendered
    // on a customer-facing document.
    passcode: { type: String, trim: true, maxlength: 60 },

    problem: { type: String, trim: true, maxlength: 500 },
    solution: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 500 },

    // Component-by-component state at drop-off. A `Map` rather than eight named
    // fields so a shop that checks a ninth component does not need a migration.
    condition: {
      type: Map,
      of: { type: String, enum: CONDITION_GRADES },
      default: undefined,
    },

    services: [ticketLineSchema],
    parts: [ticketLineSchema],
  },
  { _id: false },
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true }, // TKT-2026-00001

    // --- who ---------------------------------------------------------------
    // Free-typed on purpose (see the note above). `user` is an optional
    // convenience link for the case where the walk-in happens to be a known
    // account; nothing reads it as authority.
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    customerPhone: { type: String, required: true, trim: true, maxlength: 40, index: true },
    customerEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /** The shop whose bench holds the device. */
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null, index: true },


    // --- what --------------------------------------------------------------
    deviceBrand: { type: String, trim: true, maxlength: 60 },
    deviceModel: { type: String, trim: true, maxlength: 120 },
    // The serial or IMEI as read off the device. Not unique: the same handset
    // can come back a second time, and that history is worth keeping.
    deviceSerial: { type: String, trim: true, maxlength: 80 },
    issue: { type: String, required: true, trim: true, maxlength: 500 },

    /**
     * The devices on this ticket.
     *
     * The three `device*` fields above are the **legacy single-device shape**
     * and are still written for every ticket, because the list screen, the
     * search index and every existing row read them. `devices[0]` mirrors them;
     * a second device only ever exists here.
     */
    devices: [ticketDeviceSchema],

    // --- notes, by audience -------------------------------------------------
    // Three fields rather than one, because they have different readers and one
    // of them must never be printed. `notes` above is the legacy field and is
    // kept as the internal one.
    clientNotes: { type: String, trim: true, maxlength: 2000 },
    technicianNotes: { type: String, trim: true, maxlength: 2000 },

    // --- money ---------------------------------------------------------------
    // The counter's quoted discount and the tax applied, both integer cents.
    // `estimateCents` above stays the headline figure the list column shows.
    discountCents: { type: Number, default: 0, min: 0 },
    discountCode: { type: String, trim: true, maxlength: 40 },
    // The rate this ticket was quoted at, as a percentage. Stored rather than
    // read from settings at render time: a ticket quoted at 5% must still say
    // 5% after the shop changes its default.
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxCents: { type: Number, default: 0, min: 0 },
    province: { type: String, trim: true, maxlength: 2 },

    /** Promised completion, shown on the intake receipt. */
    dueDate: { type: Date, default: null },

    // --- state -------------------------------------------------------------
    status: { type: String, enum: TICKET_STATUSES, default: 'diagnosis', index: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'normal', index: true },
    source: { type: String, enum: TICKET_SOURCES, default: 'counter' },

    // A staff User, unlike the customer — a technician is an account, because
    // the assignment is what a workload report is counted from.
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // --- money -------------------------------------------------------------
    // Integer cents, like everywhere else in the codebase. These are the
    // counter's estimate and its outcome; neither is an invoice, and neither
    // moves a balance on its own.
    estimateCents: { type: Number, default: 0, min: 0 },
    finalCents: { type: Number, default: 0, min: 0 },

    notes: { type: String, trim: true, maxlength: 2000 },

    // Set once, the first time the ticket reaches a closed status, so age stops
    // accruing at the moment the work actually finished rather than at whatever
    // later edit happened to touch the document.
    closedAt: { type: Date, default: null },

    /**
     * Money taken before there is an invoice to take it against.
     *
     * A repair is quoted, the customer leaves a deposit, and the invoice does
     * not exist until the work is done — so the payment has nowhere to live.
     * Recorded here and **carried onto the invoice as a payment** when the
     * ticket converts, which is the only reason to hold it on the ticket at
     * all: a deposit that did not follow the money would have to be re-keyed,
     * and a re-keyed payment is one that eventually gets keyed twice.
     */
    deposits: [
      {
        amount: { type: Number, required: true },
        at: { type: Date, default: Date.now },
        method: { type: String, default: 'cash' },
        note: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    /** The invoice this ticket became, once it has become one. */
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },

    timeline: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        _id: false,
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ technician: 1, createdAt: -1 });
ticketSchema.index({ customerName: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

export { CONDITION_GRADES, CONDITION_PARTS, TICKET_STATUSES, TICKET_OPEN_STATUSES, TICKET_PRIORITIES, TICKET_SOURCES, Ticket };
export default Ticket;
