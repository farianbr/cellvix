const { asyncHandler } = require('../utils/ApiError.js');
const {
  default: Appointment,
  APPOINTMENT_KINDS, APPOINTMENT_STATUSES,
} = require('../models/Appointment.js');
const { default: User } = require('../models/User.js');

/**
 * The scheduling board (§6.15 category 4 — **UI only, §6b U1–U2**, phase 11e).
 *
 * **Read-only, and there is deliberately no write route.** §6b rule 4: nothing
 * fakes success. A `POST` here would accept a booking the business has not
 * decided the shape of yet (§12 Q1) and store it against a model that may still
 * change — so the dialog on the screen is disabled rather than wired to an
 * endpoint that would quietly work.
 *
 * The collection ships empty, so both screens render their real chrome around
 * nothing. That is §6b rule 3 working as intended: turning this on later is a
 * service being written, not a migration.
 */

const list = asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  const filter = {};
  if (from || to) {
    filter.startAt = {};
    if (from) filter.startAt.$gte = new Date(from);
    if (to) filter.startAt.$lte = new Date(to);
  }

  const [scheduled, unscheduled, staff] = await Promise.all([
    Appointment.find(filter).sort({ startAt: 1 }).lean(),
    // The tray beside the board: everything with no date yet.
    Appointment.find({ startAt: null, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).lean(),
    // Who the board can be filtered by. Read live rather than hard-coded so the
    // filter is right the moment a staff account is added.
    User.find({ role: { $in: ['admin', 'staff'] } }).select('contactName businessName email').lean(),
  ]);

  const shape = (row) => ({
    id: row._id.toString(),
    kind: row.kind,
    title: row.title,
    notes: row.notes ?? '',
    startAt: row.startAt,
    endAt: row.endAt,
    status: row.status,
    staff: row.staff ? row.staff.toString() : null,
    relatedTo: row.relatedTo ?? null,
  });

  res.json({
    appointments: scheduled.map(shape),
    unscheduled: unscheduled.map(shape),
    staff: staff.map((person) => ({
      id: person._id.toString(),
      name: person.contactName || person.businessName || person.email,
    })),
    kinds: APPOINTMENT_KINDS,
    statuses: APPOINTMENT_STATUSES,
    // Stated by the server rather than assumed by the screen, so the notice and
    // the capability cannot drift apart.
    wired: false,
  });
});

// --- CommonJS exports -------------------------------------------------
exports.list = list;
