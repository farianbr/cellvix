const mongoose = require('mongoose');

const {
  default: Ticket,
  TICKET_STATUSES,
  TICKET_OPEN_STATUSES,
} = require('../models/Ticket.js');
const { default: User } = require('../models/User.js');
const { default: Settings } = require('../models/Settings.js');
const { default: ApiError } = require('../utils/ApiError.js');
const { likeRegex } = require('../utils/regex.js');

/**
 * Repair tickets (Sales § Ticket).
 *
 * A ticket tracks one device from intake to collection. Two things are worth
 * knowing before editing this file:
 *
 *   - **The customer is free-typed, not an account.** A repair is a walk-in.
 *     Search therefore hits `customerName` and `customerPhone` directly rather
 *     than resolving a `User` first, which is why this list is one query where
 *     `rmaService.listRmas` needs two.
 *   - **Status moves are unrestricted, and every move is recorded.** A repair
 *     genuinely goes backwards — parts arrive wrong, a fix does not hold — so
 *     the `timeline` is the control rather than a transition table. See the
 *     note on the model.
 *
 * Money here is integer cents and is an estimate, not an invoice: nothing in
 * this file moves a balance. Billing a completed repair is a separate step
 * through the invoice path, which is the only thing that may.
 */

/**
 * Two different questions, deliberately two lists.
 *
 * `CLOSED_STATUSES` is when the record stops changing, so it is what stamps
 * `closedAt`. `SETTLED_STATUSES` is when the *repair* stops being the shop's
 * problem, which happens one rung earlier: a device sitting on the pickup shelf
 * is finished work, and an Age column that keeps escalating it is nagging about
 * something no technician can act on. The SLA measures the bench, so it reads
 * the second list — and `TICKET_OPEN_STATUSES` on the model is the same
 * reading, which is what keeps the sidebar badge and this column agreeing.
 */
const CLOSED_STATUSES = ['completed', 'cancelled'];
const SETTLED_STATUSES = [...CLOSED_STATUSES, 'ready_to_pickup'];

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value ?? ''));
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function endOfDay(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;
  const last = await Ticket.findOne({ ticketNumber: new RegExp(`^${prefix}`) })
    .sort({ ticketNumber: -1 })
    .select('ticketNumber')
    .lean();

  const sequence = last ? Number(last.ticketNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(5, '0')}`;
}

/**
 * Age in whole days, and whether it has passed the SLA.
 *
 * **Age stops when the ticket closes**, at `closedAt` rather than `updatedAt` —
 * editing a note on a repair finished last month must not make it look like it
 * finished today. Only live work carries the warning, because a row that always
 * shouts is a row an operator learns to ignore.
 */
function ageOf(ticket, slaDays) {
  const closed = CLOSED_STATUSES.includes(ticket.status);
  const until = closed ? new Date(ticket.closedAt ?? ticket.updatedAt) : new Date();
  const days = Math.max(0, Math.floor((until - new Date(ticket.createdAt)) / 86_400_000));

  // Waiting on a customer to collect is not an overdue repair, so the warning
  // reads `SETTLED_STATUSES` while the greyed-out treatment reads `closed` —
  // a ticket on the pickup shelf still shows its live age, just without the
  // escalation.
  const settled = SETTLED_STATUSES.includes(ticket.status);

  return { days, overSla: !settled && days > slaDays, closed };
}

function shapeTechnician(technician) {
  if (!technician) return null;
  if (!technician.contactName && !technician.businessName) {
    return { id: technician.toString(), name: null, email: null };
  }
  return {
    id: technician._id.toString(),
    name: technician.contactName ?? technician.businessName ?? null,
    email: technician.email ?? null,
  };
}

function shapeTicket(ticket, slaDays) {
  const age = ageOf(ticket, slaDays);

  return {
    id: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber,

    customer: {
      name: ticket.customerName,
      phone: ticket.customerPhone,
      email: ticket.customerEmail ?? null,
      userId: ticket.user ? (ticket.user._id ?? ticket.user).toString() : null,
    },

    device: {
      brand: ticket.deviceBrand ?? null,
      model: ticket.deviceModel ?? null,
      serial: ticket.deviceSerial ?? null,
    },
    issue: ticket.issue,

    status: ticket.status,
    priority: ticket.priority,
    source: ticket.source,

    technician: shapeTechnician(ticket.technician),

    estimateCents: ticket.estimateCents ?? 0,
    finalCents: ticket.finalCents ?? 0,

    notes: ticket.notes ?? null,

    timeline: (ticket.timeline ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at,
      note: entry.note ?? null,
    })),

    age: age.days,
    overSla: age.overSla,
    closed: age.closed,

    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt ?? null,
  };
}

/**
 * Who a ticket can be assigned to: staff and admins, never buyers.
 *
 * Returned alongside the list because `/admin/staff` is admin-only — a sales
 * user who is allowed to see tickets must still be able to filter them by
 * technician, and asking them to call an endpoint they cannot reach is not a
 * filter, it is an empty dropdown.
 */
async function listTechnicians() {
  const staff = await User.find({ role: { $in: ['staff', 'admin'] }, lockedAt: null })
    .select('contactName businessName email')
    .sort({ contactName: 1 })
    .lean();

  return staff.map((person) => ({
    id: person._id.toString(),
    name: person.contactName ?? person.businessName ?? person.email,
  }));
}

// ---- read -------------------------------------------------------------------

/**
 * The ticket list behind `/admin/tickets`.
 *
 * `counts` covers every pill and is computed over the whole collection, not the
 * filtered page — a pill showing the count of what the current filter already
 * excludes would be useless. `open` and `overdue` are readings of age, so they
 * are counted from the open rows rather than asked of Mongo.
 */
async function listTickets({ status, q, priority, technician, from, to, limit, page } = {}) {
  const settings = await Settings.load();
  const slaDays = settings?.operations?.ticketSlaDays ?? 7;

  const query = {};

  if (status === 'open') query.status = { $in: TICKET_OPEN_STATUSES };
  else if (status === 'overdue') query.status = { $in: TICKET_OPEN_STATUSES };
  else if (status && status !== 'all') query.status = String(status);

  if (priority && priority !== 'all') query.priority = String(priority);

  if (technician === 'unassigned') query.technician = null;
  else if (technician && technician !== 'all' && isObjectId(technician)) {
    query.technician = technician;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = toDate(from);
    if (to) query.createdAt.$lte = endOfDay(to);
  }

  if (q) {
    const rx = likeRegex(q);
    query.$or = [
      { ticketNumber: rx },
      { customerName: rx },
      { customerPhone: rx },
      { deviceModel: rx },
      { deviceBrand: rx },
      { deviceSerial: rx },
      { issue: rx },
    ];
  }

  // Per-page is an operator preference on the filter menu, so it is clamped
  // rather than trusted — an unbounded `limit` is a denial of service with a
  // friendly name.
  const perPage = Math.min(Math.max(Number(limit) || 25, 5), 200);
  const currentPage = Math.max(Number(page) || 1, 1);

  const [rows, total] = await Promise.all([
    Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .populate('technician', 'contactName businessName email')
      .lean(),
    Ticket.countDocuments(query),
  ]);

  let shaped = rows.map((ticket) => shapeTicket(ticket, slaDays));

  // `overdue` is a reading of age, so it cannot be a Mongo filter — it is
  // applied after shaping, on the same computation the Age column shows.
  if (status === 'overdue') shaped = shaped.filter((ticket) => ticket.overSla);

  const [statusRows, openRows] = await Promise.all([
    Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.find({ status: { $in: TICKET_OPEN_STATUSES } })
      .select('createdAt status updatedAt closedAt')
      .lean(),
  ]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.all = statusRows.reduce((sum, row) => sum + row.count, 0);
  counts.open = openRows.length;
  counts.overdue = openRows.filter((row) => ageOf(row, slaDays).overSla).length;

  return {
    tickets: shaped,
    counts,
    slaDays,
    // The technician picker rides along with the list rather than coming from
    // `/admin/staff`, which is admin-only: a sales user who can see tickets
    // must be able to filter them by who is holding one.
    technicians: await listTechnicians(),
    page: currentPage,
    perPage,
    total,
    totalPages: Math.max(Math.ceil(total / perPage), 1),
  };
}

async function getTicket(id) {
  const settings = await Settings.load();
  const slaDays = settings?.operations?.ticketSlaDays ?? 7;

  const query = isObjectId(id) ? { _id: id } : { ticketNumber: String(id) };
  const ticket = await Ticket.findOne(query)
    .populate('technician', 'contactName businessName email')
    .lean();

  if (!ticket) throw ApiError.notFound('Ticket not found.', 'TICKET_NOT_FOUND');

  return { ticket: shapeTicket(ticket, slaDays) };
}

// ---- write ------------------------------------------------------------------

/** Resolves an optional technician id to a staff user, or refuses it. */
async function resolveTechnician(technicianId) {
  if (technicianId === undefined) return undefined;
  if (!technicianId) return null;

  const staff = await User.findById(technicianId).select('_id').lean();
  if (!staff) throw ApiError.badRequest('That technician does not exist.', 'TECHNICIAN_NOT_FOUND');

  return staff._id;
}

async function createTicket(body, createdBy) {
  const technician = await resolveTechnician(body.technician);
  const settings = await Settings.load();
  const status = body.status ?? 'diagnosis';

  const ticket = await Ticket.create({
    ticketNumber: await nextTicketNumber(),

    customerName: body.customerName,
    customerPhone: body.customerPhone,
    customerEmail: body.customerEmail || undefined,

    deviceBrand: body.deviceBrand,
    deviceModel: body.deviceModel,
    deviceSerial: body.deviceSerial,
    issue: body.issue,

    status,
    priority: body.priority ?? 'normal',
    source: body.source ?? 'counter',

    technician: technician ?? null,

    estimateCents: Math.round((body.estimateDollars ?? 0) * 100),

    notes: body.notes,

    timeline: [{ status, at: new Date(), note: 'Opened.', by: createdBy }],
    createdBy,
  });

  return { ticket: shapeTicket(ticket.toObject(), settings?.operations?.ticketSlaDays ?? 7) };
}

/**
 * Move a ticket's status.
 *
 * Any status to any status by design (see the file header) — but never
 * silently: each move appends to `timeline`. `closedAt` is stamped the first
 * time the ticket closes and cleared if it is reopened, so age measures the
 * work rather than the last edit.
 */
async function setTicketStatus(id, body, actor) {
  if (!TICKET_STATUSES.includes(body.status)) {
    throw ApiError.badRequest('That is not a ticket status.', 'TICKET_STATUS_INVALID');
  }

  const ticket = await Ticket.findById(id);
  if (!ticket) throw ApiError.notFound('Ticket not found.', 'TICKET_NOT_FOUND');

  const wasClosed = CLOSED_STATUSES.includes(ticket.status);
  const isClosed = CLOSED_STATUSES.includes(body.status);

  ticket.status = body.status;
  if (isClosed && !wasClosed) ticket.closedAt = new Date();
  if (!isClosed && wasClosed) ticket.closedAt = null;

  ticket.timeline.push({ status: body.status, at: new Date(), note: body.note, by: actor });
  await ticket.save();

  const settings = await Settings.load();
  return { ticket: shapeTicket(ticket.toObject(), settings?.operations?.ticketSlaDays ?? 7) };
}

/**
 * Edit a ticket's details.
 *
 * Status is deliberately not editable here — it moves through
 * `setTicketStatus`, which is the only path that keeps the timeline honest.
 */
async function updateTicket(id, body) {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw ApiError.notFound('Ticket not found.', 'TICKET_NOT_FOUND');

  const assignable = [
    'customerName',
    'customerPhone',
    'customerEmail',
    'deviceBrand',
    'deviceModel',
    'deviceSerial',
    'issue',
    'priority',
    'source',
    'notes',
  ];

  for (const field of assignable) {
    if (body[field] !== undefined) ticket[field] = body[field];
  }

  if (body.technician !== undefined) ticket.technician = await resolveTechnician(body.technician);
  if (body.estimateDollars !== undefined) {
    ticket.estimateCents = Math.round(body.estimateDollars * 100);
  }
  if (body.finalDollars !== undefined) ticket.finalCents = Math.round(body.finalDollars * 100);

  await ticket.save();

  const settings = await Settings.load();
  return { ticket: shapeTicket(ticket.toObject(), settings?.operations?.ticketSlaDays ?? 7) };
}

async function deleteTicket(id) {
  const ticket = await Ticket.findByIdAndDelete(id).lean();
  if (!ticket) throw ApiError.notFound('Ticket not found.', 'TICKET_NOT_FOUND');
  return { deleted: true, ticketNumber: ticket.ticketNumber };
}

// --- CommonJS exports -------------------------------------------------
exports.listTickets = listTickets;
exports.getTicket = getTicket;
exports.createTicket = createTicket;
exports.setTicketStatus = setTicketStatus;
exports.updateTicket = updateTicket;
exports.deleteTicket = deleteTicket;
exports.shapeTicket = shapeTicket;
