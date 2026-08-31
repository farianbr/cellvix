const mongoose = require('mongoose');

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

    // --- what --------------------------------------------------------------
    deviceBrand: { type: String, trim: true, maxlength: 60 },
    deviceModel: { type: String, trim: true, maxlength: 120 },
    // The serial or IMEI as read off the device. Not unique: the same handset
    // can come back a second time, and that history is worth keeping.
    deviceSerial: { type: String, trim: true, maxlength: 80 },
    issue: { type: String, required: true, trim: true, maxlength: 500 },

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

// --- CommonJS exports -------------------------------------------------
exports.TICKET_STATUSES = TICKET_STATUSES;
exports.TICKET_OPEN_STATUSES = TICKET_OPEN_STATUSES;
exports.TICKET_PRIORITIES = TICKET_PRIORITIES;
exports.TICKET_SOURCES = TICKET_SOURCES;
exports.Ticket = Ticket;
exports.default = Ticket;
