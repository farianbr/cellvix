import mongoose from 'mongoose';

import Ticket, {
  TICKET_STATUSES,
  TICKET_OPEN_STATUSES,
} from '../models/Ticket.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import orderBuilder from './orderBuilder.js';
import creditService from './creditService.js';
import Settings from '../models/Settings.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';

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

    // The richer intake shape. Absent on tickets taken before it existed, so
    // every consumer has to tolerate an empty list here.
    devices: (ticket.devices ?? []).map((device) => ({
      category: device.category ?? null,
      brand: device.brand ?? null,
      series: device.series ?? null,
      model: device.model ?? null,
      serial: device.serial ?? null,
      passcode: device.passcode ?? null,
      problem: device.problem ?? null,
      solution: device.solution ?? null,
      notes: device.notes ?? null,
      condition: device.condition ? Object.fromEntries(device.condition) : {},
      services: device.services ?? [],
      parts: device.parts ?? [],
    })),

    clientNotes: ticket.clientNotes ?? null,
    technicianNotes: ticket.technicianNotes ?? null,

    discountCents: ticket.discountCents ?? 0,
    discountCode: ticket.discountCode ?? null,
    taxRate: ticket.taxRate ?? 0,
    taxCents: ticket.taxCents ?? 0,
    province: ticket.province ?? null,
    dueDate: ticket.dueDate ?? null,

    estimateCents: ticket.estimateCents ?? 0,
    finalCents: ticket.finalCents ?? 0,

    /**
     * Money already taken, and what is left to bill.
     *
     * `depositTotal` is summed here rather than stored, for the same reason
     * every other total is: a stored sum is one that can disagree with the rows
     * it was summed from.
     */
    deposits: (ticket.deposits ?? []).map((deposit) => ({
      id: deposit._id?.toString() ?? null,
      amount: deposit.amount,
      at: deposit.at,
      method: deposit.method ?? 'cash',
      note: deposit.note ?? null,
    })),
    depositTotal: (ticket.deposits ?? []).reduce((sum, deposit) => sum + (deposit.amount ?? 0), 0),

    /** The invoice this became, if it has been converted. */
    invoice: ticket.invoice
      ? {
          id: (ticket.invoice._id ?? ticket.invoice).toString(),
          number: ticket.invoice.number ?? null,
        }
      : null,

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
async function listTickets({
  status,
  q,
  priority,
  technician,
  user,
  from,
  to,
  limit,
  page,
  outlet,
} = {}) {
  const settings = await Settings.load();
  const slaDays = settings?.operations?.ticketSlaDays ?? 7;

  const query = {};

  // Scoped to the outlet the panel is switched to, when it is switched to one.
  // Resolved by `resolveOutletScope` rather than read from the query string,
  // because a staff member's own outlet is binding.
  if (outlet) query.outlet = outlet;

  if (status === 'open') query.status = { $in: TICKET_OPEN_STATUSES };
  else if (status === 'overdue') query.status = { $in: TICKET_OPEN_STATUSES };
  else if (status && status !== 'all') query.status = String(status);

  if (priority && priority !== 'all') query.priority = String(priority);

  // The customer profile's Tickets tab. Only tickets actually linked to an
  // account — a walk-in repair carries no `user` and belongs to nobody's list.
  if (user && isObjectId(user)) query.user = user;

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

/** Dollars in, integer cents out. One place, so rounding cannot differ by caller. */
function toCents(dollars) {
  return Math.round(Number(dollars ?? 0) * 100);
}

/** A priced line as the model stores it. */
function shapeLineIn(line) {
  return {
    name: line.name,
    description: line.description || undefined,
    priceCents: toCents(line.priceDollars),
    qty: line.qty ?? 1,
    product: line.product || null,
  };
}

/**
 * The ticket's money, computed **from the lines** rather than trusted.
 *
 * The intake form shows a running total, but that is a preview like any other
 * (§5.3): the figure that gets stored is summed here from the services and
 * parts actually on the devices, then discounted and taxed. A client that sent
 * its own total would be setting the price of the work.
 */
function priceTicket(devices, { discountCents = 0, taxRate = 0 } = {}) {
  const gross = devices.reduce(
    (sum, device) =>
      sum +
      [...(device.services ?? []), ...(device.parts ?? [])].reduce(
        (n, line) => n + line.priceCents * (line.qty ?? 1),
        0,
      ),
    0,
  );

  // A discount can never exceed the work: a negative subtotal would tax
  // backwards and print a credit note that nobody raised.
  const discount = Math.min(discountCents, gross);
  const subtotal = gross - discount;
  const taxCents = Math.round(subtotal * (taxRate / 100));

  return { gross, discount, subtotal, taxCents, total: subtotal + taxCents };
}

/**
 * The devices as the model stores them, with the legacy single-device fields
 * mirrored from the first one.
 *
 * Both shapes are written on every ticket: the list screen, the search index
 * and every row that predates this all read `deviceBrand`/`deviceModel`, and
 * leaving those blank would empty the Device column on the tickets list.
 */
function shapeDevicesIn(devices = []) {
  return devices.map((device) => ({
    category: device.category || undefined,
    brand: device.brand || undefined,
    series: device.series || undefined,
    model: device.model,
    serial: device.serial || undefined,
    passcode: device.passcode || undefined,
    problem: device.problem || undefined,
    solution: device.solution || undefined,
    notes: device.notes || undefined,
    condition: device.condition && Object.keys(device.condition).length ? device.condition : undefined,
    services: (device.services ?? []).map(shapeLineIn),
    parts: (device.parts ?? []).map(shapeLineIn),
  }));
}

async function createTicket(body, createdBy) {
  const technician = await resolveTechnician(body.technician);
  const settings = await Settings.load();
  const status = body.status ?? 'diagnosis';

  const devices = shapeDevicesIn(body.devices);
  const priced = priceTicket(devices, {
    discountCents: toCents(body.discountDollars),
    taxRate: body.taxRate ?? 0,
  });

  // The first device also fills the legacy single-device columns — see the note
  // on `devices` in the model. A ticket taken on the short form has no devices
  // array at all, so those columns are the only record of what came in.
  const lead = devices[0];

  const ticket = await Ticket.create({
    ticketNumber: await nextTicketNumber(),

    customerName: body.customerName,
    customerPhone: body.customerPhone,
    customerEmail: body.customerEmail || undefined,
    // Set only when the ticket was raised against a known account — a walk-in
    // has none, and `null` is the model's own default for that.
    user: body.user || null,

    devices,
    deviceBrand: lead?.brand ?? body.deviceBrand,
    deviceModel: lead?.model ?? body.deviceModel,
    deviceSerial: lead?.serial ?? body.deviceSerial,
    // `issue` is required on the model and is what every list and search reads,
    // so a multi-device ticket falls back to the first device's problem.
    issue: body.issue || lead?.problem || 'Intake',

    status,
    priority: body.priority ?? 'normal',
    source: body.source ?? 'counter',

    technician: technician ?? null,

    /**
     * The estimate is the **priced work** when there is any, and the typed
     * figure otherwise.
     *
     * A counter that has listed three services and two parts has already said
     * what the job costs; asking them to total it themselves into a separate
     * box is asking for a number that disagrees with the lines beside it. The
     * short form — no devices, just an estimate — still works, which is what
     * keeps a thirty-second walk-in intake possible.
     */
    estimateCents: devices.length ? priced.total : toCents(body.estimateDollars),

    discountCents: priced.discount,
    discountCode: body.discountCode || undefined,
    taxRate: body.taxRate ?? 0,
    taxCents: priced.taxCents,
    province: body.province || undefined,
    dueDate: body.dueDate ? new Date(`${body.dueDate}T00:00:00`) : null,

    notes: body.notes,
    clientNotes: body.clientNotes || undefined,
    technicianNotes: body.technicianNotes || undefined,

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

/**
 * Record money taken before there is an invoice to take it against.
 *
 * A repair is quoted, the customer leaves a deposit, and the invoice does not
 * exist until the work is finished. The payment is held on the ticket and
 * carried onto the invoice when it converts — see `convertToInvoice`.
 *
 * Amounts are integer cents and the caller sends dollars, converted here rather
 * than in the controller so every path through this file agrees about units.
 */
async function recordDeposit(id, { amountDollars, method = 'cash', note } = {}, actor) {
  const amount = Math.round(Number(amountDollars ?? 0) * 100);
  if (!(amount > 0)) {
    throw ApiError.badRequest('Enter a deposit amount.', 'DEPOSIT_EMPTY');
  }

  const query = isObjectId(id) ? { _id: id } : { ticketNumber: String(id) };
  const ticket = await Ticket.findOne(query);
  if (!ticket) throw ApiError.notFound('Ticket not found.', 'TICKET_NOT_FOUND');

  if (ticket.invoice) {
    // Once it is an invoice, a payment belongs on the invoice — recording it
    // here would leave two records of one payment and no way to reconcile them.
    throw ApiError.badRequest(
      'This ticket is already invoiced. Record the payment against the invoice.',
      'TICKET_ALREADY_INVOICED',
    );
  }

  ticket.deposits.push({ amount, method, note: note || undefined, by: actor?._id ?? null });
  await ticket.save();

  const settings = await Settings.load();
  return { ticket: shapeTicket(ticket.toObject(), settings?.operations?.ticketSlaDays ?? 7) };
}

/** Remove a deposit that was recorded in error. */
async function removeDeposit(id, depositId) {
  const query = isObjectId(id) ? { _id: id } : { ticketNumber: String(id) };
  const ticket = await Ticket.findOne(query);
  if (!ticket) throw ApiError.notFound('Ticket not found.', 'TICKET_NOT_FOUND');

  if (ticket.invoice) {
    throw ApiError.badRequest(
      'This ticket is already invoiced. Reverse the payment on the invoice instead.',
      'TICKET_ALREADY_INVOICED',
    );
  }

  const before = ticket.deposits.length;
  ticket.deposits = ticket.deposits.filter((deposit) => String(deposit._id) !== String(depositId));
  if (ticket.deposits.length === before) {
    throw ApiError.notFound('Deposit not found.', 'DEPOSIT_NOT_FOUND');
  }

  await ticket.save();
  const settings = await Settings.load();
  return { ticket: shapeTicket(ticket.toObject(), settings?.operations?.ticketSlaDays ?? 7) };
}

/**
 * Turn a finished repair into the invoice that bills it.
 *
 * **The ticket is the source of truth for what is billed.** Its devices,
 * services and parts become the invoice's lines, and its tax rate and discount
 * come across with them — the operator priced the job once, on the ticket, and
 * re-keying it onto an invoice is how the two end up disagreeing.
 *
 * **Deposits become payments.** Money already taken is recorded against the new
 * invoice at the amount and method it was taken at, so the balance due is what
 * is actually still owed rather than the full total.
 *
 * Converting **once** is enforced by `ticket.invoice`: a second conversion would
 * bill the customer twice for one repair, which is the worst thing this function
 * could do. The link is also what the detail screen reads to show where the
 * ticket went.
 */
async function convertToInvoice(id, { terms = 'prepaid' } = {}, actor) {
  const query = isObjectId(id) ? { _id: id } : { ticketNumber: String(id) };
  const ticket = await Ticket.findOne(query).populate('user');
  if (!ticket) throw ApiError.notFound('Ticket not found.', 'TICKET_NOT_FOUND');

  if (ticket.invoice) {
    throw ApiError.badRequest(
      `${ticket.ticketNumber} has already been invoiced.`,
      'TICKET_ALREADY_INVOICED',
    );
  }
  if (!ticket.user) {
    // A walk-in with no account cannot be invoiced: an invoice is raised
    // against somebody, and there is nobody to raise it against.
    throw ApiError.badRequest(
      'Attach a customer to this ticket before invoicing it.',
      'TICKET_NO_CUSTOMER',
    );
  }

  const totals = priceTicket(ticket.devices, {
    discountCents: ticket.discountCents ?? 0,
    taxRate: ticket.taxRate ?? 0,
  });
  if (!(totals.total > 0)) {
    throw ApiError.badRequest(
      'Add a service or a part before invoicing this ticket.',
      'TICKET_EMPTY',
    );
  }

  // The devices come across whole — the invoice's own `devices` array has the
  // same shape, so the document reproduces the job rather than summarising it.
  const devices = (ticket.devices ?? []).map((device) => ({
    category: device.category,
    brand: device.brand,
    series: device.series,
    model: device.model,
    serial: device.serial,
    problem: device.problem,
    solution: device.solution,
    notes: device.notes,
    services: (device.services ?? []).map(toInvoiceLine),
    parts: (device.parts ?? []).map(toInvoiceLine),
  }));

  const issuedAt = new Date();
  const dueDate = new Date(issuedAt);
  dueDate.setDate(dueDate.getDate() + (orderBuilder.TERMS_DAYS[terms] ?? 0));

  const invoice = await Invoice.create({
    number: await orderBuilder.nextInvoiceNumber('CVX'),
    kind: 'due',
    user: ticket.user._id,
    outlet: ticket.outlet ?? null,
    amount: totals.total,
    amountPaid: 0,
    issuedAt,
    dueDate,
    terms,
    status: 'unpaid',
    reference: `Repair ${ticket.ticketNumber}`,

    devices,
    subtotalCents: totals.subtotal + totals.discount,
    discountCents: totals.discount,
    taxPercent: ticket.taxRate ?? 0,
    taxCents: totals.taxCents,
    province: ticket.province ?? undefined,

    customerNotes: ticket.clientNotes || undefined,
    technicianNotes: ticket.technicianNotes || undefined,

    // Deposits ride across as real payments, so the invoice opens showing what
    // is still owed rather than the full amount.
    payments: (ticket.deposits ?? []).map((deposit) => ({
      amount: deposit.amount,
      at: deposit.at,
      method: deposit.method ?? 'cash',
      reference: `Deposit on ${ticket.ticketNumber}`,
    })),
  });

  // `amountPaid` and `status` are derived from those payments rather than
  // assumed — an invoice fully covered by deposits is already settled.
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  invoice.amountPaid = paid;
  if (paid >= invoice.amount) {
    invoice.status = 'paid';
    invoice.settledAt = new Date();
  } else if (paid > 0) {
    invoice.status = 'partial';
  }
  await invoice.save();

  ticket.invoice = invoice._id;
  ticket.finalCents = totals.total;
  ticket.timeline.push({
    status: ticket.status,
    at: new Date(),
    note: `Converted to invoice ${invoice.number}.`,
    by: actor?._id ?? null,
  });
  await ticket.save();

  // Terms draw on the line of credit, so the balance has to move with them.
  if (terms !== 'prepaid') await creditService.syncBalance(ticket.user._id);

  const settings = await Settings.load();
  return {
    ticket: shapeTicket(ticket.toObject(), settings?.operations?.ticketSlaDays ?? 7),
    invoice: { id: invoice._id.toString(), number: invoice.number },
  };
}

/** A ticket line as the invoice stores one. Cents stay cents. */
function toInvoiceLine(line) {
  return {
    name: line.name,
    description: line.description || undefined,
    priceCents: line.priceCents ?? 0,
    qty: line.qty ?? 1,
    product: line.product || undefined,
  };
}

export {
  nextTicketNumber,
  priceTicket,
  listTickets,
  getTicket,
  createTicket,
  setTicketStatus,
  updateTicket,
  deleteTicket,
  recordDeposit,
  removeDeposit,
  convertToInvoice,
  shapeTicket,
};
