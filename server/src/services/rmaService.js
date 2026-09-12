import mongoose from 'mongoose';

import { RMA_STATUSES, RMA_OPEN_STATUSES } from '../models/Rma.js';
import { displayNameOf } from '../utils/displayName.js';
/**
 * Models come from the request's business, not from a module-level import
 * (SAAS_PLATFORM §4.1).
 *
 * `db()` reads the connection out of async-local context, which
 * `middleware/businessDb.js` opened for this request — so `db().Rma` is the
 * `Rma` collection of *this* business's database. Importing the model directly
 * would bind it to the default connection and quietly serve the wrong business
 * once the split is on.
 *
 * The constants above are plain arrays and stay imported: they describe the
 * schema rather than reaching a database.
 */
import { db } from '../db/models.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import storeCredit from './storeCreditService.js';
import { applyStockMovement } from './purchaseService.js';
import notificationService from './notificationService.js';
import * as warrantyService from './warrantyService.js';

/**
 * RMA / returns (ERP rework §6.3, phase 7).
 *
 * Two invariants meet in this file and neither bends for it:
 *
 *   - **`storeCreditService` is the only place a store-credit balance moves**
 *     (invariant 5). An RMA refund is not an exception to that rule — it is the
 *     case the rule was written for. `resolveRma` calls `refundOrder` and reads
 *     the result; it never posts a ledger row itself.
 *   - **`applyStockMovement` is the only place `Product.stock` moves** (phase 5).
 *     Restocking an accepted return goes through it, typed `return`, so a
 *     quantity that reappeared on the shelf has a document behind it.
 *
 * The status ladder is a real workflow, not a label. A part is requested,
 * approved, sent back, received, inspected, then resolved — and resolving
 * something that has not physically arrived is exactly the mistake the ladder
 * exists to prevent, so the transitions below are enforced rather than trusted.
 */

/**
 * Forward-only, with two deliberate escapes.
 *
 * `rejected` is reachable from every open rung: a return can be refused the
 * moment it is understood, not only after it has been shipped back. And
 * `resolved` is reachable only from `inspecting` — the whole point of an
 * inspection step is that the resolution follows it.
 */
const TRANSITIONS = {
  requested: ['approved', 'rejected'],
  approved: ['in_transit', 'rejected'],
  in_transit: ['received', 'rejected'],
  received: ['inspecting', 'rejected'],
  inspecting: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

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

async function nextRmaNumber() {
  const year = new Date().getFullYear();
  const prefix = `RMA-${year}-`;
  const last = await db().Rma.findOne({ rmaNumber: new RegExp(`^${prefix}`) })
    .sort({ rmaNumber: -1 })
    .select('rmaNumber')
    .lean();

  const sequence = last ? Number(last.rmaNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(5, '0')}`;
}

/**
 * Age in whole days, and whether it has passed the SLA.
 *
 * **Age stops when the RMA closes.** A return resolved in two days should not
 * still be accruing age six months later — the Age column drives the operator's
 * day, and a resolved row shouting for attention teaches them to ignore it.
 */
function ageOf(rma, slaDays) {
  const closed = ['resolved', 'rejected'].includes(rma.status);
  const until = closed ? new Date(rma.updatedAt) : new Date();
  const days = Math.max(0, Math.floor((until - new Date(rma.createdAt)) / 86_400_000));

  return { days, overSla: !closed && days > slaDays, closed };
}

function shapeRma(rma, slaDays) {
  const age = ageOf(rma, slaDays);

  return {
    id: rma._id.toString(),
    rmaNumber: rma.rmaNumber,
    /**
     * The account, labelled by the PERSON (§0).
     *
     * The gate was `businessName` existing — so a sole trader, who is allowed
     * to have none, fell to the else branch and lost their id along with their
     * name, rendering as a dash nothing could link to. The gate is now "did the
     * populate run", which is the question that was actually being asked.
     */
    user: rma.user?._id
      ? {
          id: rma.user._id.toString(),
          displayName: displayNameOf(rma.user),
          businessName: rma.user.businessName ?? null,
          contactName: rma.user.contactName ?? null,
          email: rma.user.email ?? null,
        }
      : {
          id: rma.user?.toString() ?? null,
          displayName: '—',
          businessName: null,
          contactName: null,
          email: null,
        },
    order: rma.order
      ? {
          id: (rma.order._id ?? rma.order).toString(),
          orderNumber: rma.order.orderNumber ?? rma.orderNumber ?? null,
        }
      : null,
    orderNumber: rma.orderNumber ?? rma.order?.orderNumber ?? null,
    status: rma.status,
    items: (rma.items ?? []).map((item) => ({
      product: item.product?.toString() ?? null,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      reason: item.reason ?? null,
      condition: item.condition ?? null,
      disposition: item.disposition,
      unitPrice: item.unitPrice ?? 0,
      restocked: Boolean(item.restockedAt),
    })),
    itemCount: (rma.items ?? []).length,
    qty: (rma.items ?? []).reduce((sum, item) => sum + item.qty, 0),
    reason: rma.reason ?? null,
    resolution: rma.resolution,
    refundAmount: rma.refundAmount ?? 0,
    inspectionNotes: rma.inspectionNotes ?? null,
    attachments: rma.attachments ?? [],
    age: age.days,
    overSla: age.overSla,
    closed: age.closed,
    timeline: (rma.timeline ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at,
      note: entry.note ?? null,
    })),
    createdAt: rma.createdAt,
    updatedAt: rma.updatedAt,
  };
}

/**
 * The value of the lines being returned, from the prices the order actually
 * charged. This is a **proposal**, not a decision — the operator can refund
 * less, and `resolveRma` still checks it against what the order has left to
 * refund.
 */
function proposedRefund(rma) {
  return (rma.items ?? []).reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);
}

// ---- read -------------------------------------------------------------------

async function listRmas({ q, status, from, to, user, business } = {}) {
  const settings = await db().Settings.load();
  const slaDays = settings?.operations?.rmaSlaDays ?? 14;

  const query = {};

  // One customer's returns, for their profile tab. The screen already had the
  // tab; it rendered a "coming in phase 7" placeholder while the feature was
  // built and shipping, so an operator on a customer with five returns was
  // told the feature did not exist yet.
  if (user) query.user = user;
  // Scoped to the business the panel is switched to, when it is switched to one.
  // Resolved by `resolveBusinessScope` rather than read from the query string,
  // because a staff member's own business is binding and must not be widened by
  // editing a URL.
  if (business) query.business = business;

  if (status === 'open') query.status = { $in: RMA_OPEN_STATUSES };
  else if (status === 'overdue') query.status = { $in: RMA_OPEN_STATUSES };
  else if (status && status !== 'all') query.status = String(status);

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = toDate(from);
    if (to) query.createdAt.$lte = endOfDay(to);
  }

  if (q) {
    const rx = likeRegex(q);
    const users = await db().User.find({ $or: [{ businessName: rx }, { email: rx }] })
      .select('_id')
      .lean();
    query.$or = [
      { rmaNumber: rx },
      { orderNumber: rx },
      { user: { $in: users.map((user) => user._id) } },
    ];
  }

  const rmas = await db().Rma.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('user', 'businessName contactName email')
    .populate('order', 'orderNumber')
    .lean();

  let shaped = rmas.map((rma) => shapeRma(rma, slaDays));

  // `overdue` is a reading of age, so it cannot be a Mongo filter — it is
  // applied after shaping, on the same computation the Age column shows.
  if (status === 'overdue') shaped = shaped.filter((rma) => rma.overSla);

  const [statusRows, openRows] = await Promise.all([
    db().Rma.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    db().Rma.find({ status: { $in: RMA_OPEN_STATUSES } }).select('createdAt status updatedAt').lean(),
  ]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.all = statusRows.reduce((sum, row) => sum + row.count, 0);
  counts.open = openRows.length;
  counts.overdue = openRows.filter((row) => ageOf(row, slaDays).overSla).length;

  return {
    rmas: shaped,
    counts,
    slaDays,
    totals: {
      refunded: shaped.reduce((sum, rma) => sum + rma.refundAmount, 0),
      unitsReturned: shaped.reduce((sum, rma) => sum + rma.qty, 0),
    },
  };
}

async function getRma(id) {
  const settings = await db().Settings.load();
  const slaDays = settings?.operations?.rmaSlaDays ?? 14;

  const query = isObjectId(id) ? { _id: id } : { rmaNumber: String(id) };
  const rma = await db().Rma.findOne(query)
    .populate('user', 'businessName contactName email phone storeCredit tier')
    // `timeline` and `items` are needed for the warranty answer below: cover
    // runs from the delivery entry, and the grade is snapshotted on the line.
    .populate('order', 'orderNumber total refundedTotal status createdAt timeline items')
    .lean();

  if (!rma) throw ApiError.notFound('RMA not found.', 'RMA_NOT_FOUND');

  const shaped = shapeRma(rma, slaDays);

  /**
   * Warranty per returned line.
   *
   * Reported, never enforced: an out-of-warranty return is a normal commercial
   * decision — goodwill, or a failure the relationship covers even though the
   * warranty does not — and the operator makes it with the fact in front of
   * them rather than being blocked by it (see warrantyService).
   *
   * Matched by SKU against the order's own lines, because the RMA line carries
   * the quantity returned while the grade lives on what was sold.
   */
  const soldBySku = new Map((rma.order?.items ?? []).map((item) => [item.sku, item]));

  const warranty = (rma.items ?? []).map((line) => ({
    sku: line.sku,
    name: line.name,
    ...warrantyService.coverFor({
      settings,
      grade: soldBySku.get(line.sku)?.grade,
      tier: rma.user?.tier ?? 'standard',
      order: rma.order,
    }),
  }));

  return {
    rma: shaped,
    warranty,
    // What a refund resolution would propose, and what the order can actually
    // take — shown together so an operator is never asked to guess.
    refund: {
      proposed: proposedRefund(rma),
      orderTotal: rma.order?.total ?? 0,
      alreadyRefunded: rma.order?.refundedTotal ?? 0,
      refundable: (rma.order?.total ?? 0) - (rma.order?.refundedTotal ?? 0),
    },
    storeCredit: rma.user?.storeCredit ?? 0,
  };
}

// ---- write ------------------------------------------------------------------

/**
 * Open an RMA against an order.
 *
 * Lines are matched against the order's own lines: a return for a part that was
 * never on the order, or for more units than were sold, is refused. Prices are
 * snapshotted from the order so a refund can be proposed without re-reading a
 * catalogue that has since moved.
 */
async function createRma(body, createdBy) {
  const order = await db().Order.findOne({ orderNumber: body.orderNumber }).lean();
  if (!order) throw ApiError.badRequest('That order number does not exist.', 'ORDER_NOT_FOUND');

  const bySku = new Map((order.items ?? []).map((item) => [item.sku, item]));

  // What has already been claimed on this order, so two RMAs cannot between
  // them return more than was sold.
  const existing = await db().Rma.find({ order: order._id, status: { $ne: 'rejected' } })
    .select('items')
    .lean();

  const claimed = new Map();
  for (const rma of existing) {
    for (const item of rma.items ?? []) {
      claimed.set(item.sku, (claimed.get(item.sku) ?? 0) + item.qty);
    }
  }

  const items = body.items.map((line) => {
    const sold = bySku.get(line.sku);
    if (!sold) {
      throw ApiError.badRequest(
        `${line.sku} was not on ${order.orderNumber}.`,
        'ITEM_NOT_ON_ORDER',
      );
    }

    const alreadyClaimed = claimed.get(line.sku) ?? 0;
    const returnable = sold.qty - alreadyClaimed;
    if (line.qty > returnable) {
      throw ApiError.badRequest(
        `${line.sku}: ${sold.qty} were sold and ${alreadyClaimed} already claimed, so only ${returnable} can be returned.`,
        'QTY_EXCEEDS_ORDER',
      );
    }

    return {
      product: sold.product,
      sku: sold.sku,
      name: sold.name,
      qty: line.qty,
      reason: line.reason,
      disposition: 'pending',
      unitPrice: sold.unitPrice,
    };
  });

  const rma = await db().Rma.create({
    rmaNumber: await nextRmaNumber(),
    user: order.user,
    order: order._id,
    orderNumber: order.orderNumber,
    status: 'requested',
    items,
    reason: body.reason,
    resolution: 'pending',
    createdBy,
    timeline: [{ status: 'requested', at: new Date(), note: 'Return requested.' }],
  });

  // A return starts an SLA clock the moment it is filed (§6.3), so it is the
  // one record here where a day spent unnoticed is a day already spent.
  await notificationService.emit({
    type: 'new_rma',
    severity: 'warn',
    title: `Return ${rma.rmaNumber} requested`,
    detail: `Order ${order.orderNumber} · ${items.length} item${items.length === 1 ? '' : 's'}`,
    entity: { kind: 'rma', id: rma._id.toString(), label: rma.rmaNumber },
    href: `/admin/rma/${rma._id}`,
  });

  return getRma(rma._id.toString());
}

/**
 * Move an RMA along its ladder.
 *
 * `resolved` is deliberately NOT reachable here — resolving decides what
 * happens to money and stock, so it has its own endpoint that takes the
 * decision with it. A status route that could silently resolve an RMA would be
 * a status route that moves money.
 */
async function setRmaStatus(id, { status, note }) {
  const query = isObjectId(id) ? { _id: id } : { rmaNumber: String(id) };
  const rma = await db().Rma.findOne(query);
  if (!rma) throw ApiError.notFound('RMA not found.', 'RMA_NOT_FOUND');

  if (status === 'resolved') {
    throw ApiError.badRequest(
      'Resolving an RMA decides a refund or a replacement — use the resolve action so that decision is recorded with it.',
      'USE_RESOLVE',
    );
  }

  const allowed = TRANSITIONS[rma.status] ?? [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `A ${rma.status.replace('_', ' ')} RMA cannot become ${status.replace('_', ' ')}.`,
      'RMA_TRANSITION_INVALID',
    );
  }

  rma.status = status;
  rma.timeline.push({ status, at: new Date(), note });
  await rma.save();

  return getRma(rma._id.toString());
}

/** Inspection findings — the per-item condition and disposition. */
async function inspectRma(id, { items, inspectionNotes }) {
  const query = isObjectId(id) ? { _id: id } : { rmaNumber: String(id) };
  const rma = await db().Rma.findOne(query);
  if (!rma) throw ApiError.notFound('RMA not found.', 'RMA_NOT_FOUND');

  if (['resolved', 'rejected'].includes(rma.status)) {
    throw ApiError.badRequest(
      `${rma.rmaNumber} is ${rma.status} — its inspection is closed.`,
      'RMA_CLOSED',
    );
  }

  for (const line of items ?? []) {
    const item = rma.items.find((candidate) => candidate.sku === line.sku);
    if (!item) continue;
    if (line.condition !== undefined) item.condition = line.condition;
    if (line.disposition !== undefined) item.disposition = line.disposition;
  }

  if (inspectionNotes !== undefined) rma.inspectionNotes = inspectionNotes;

  rma.timeline.push({ status: rma.status, at: new Date(), note: 'Inspection updated.' });
  await rma.save();

  return getRma(rma._id.toString());
}

/**
 * Resolve: refund, replace or reject — and restock what inspection kept.
 *
 * **The refund goes through `storeCreditService.refundOrder`** (invariant 5),
 * which owns the refundable cap, writes the ledger row, updates the order's
 * running refund total and appends to the order's timeline. Nothing here posts
 * a balance by hand.
 *
 * **Restocking goes through `applyStockMovement`**, typed `return`, and only
 * for lines inspection marked `restock` — a customer can be refunded for a part
 * that is scrapped, and conflating the two is how a warehouse ends up with
 * phantom inventory. `restockedAt` guards against a second resolve putting the
 * same units back twice.
 */
async function resolveRma(id, { resolution, amountDollars, note }, adminId) {
  const query = isObjectId(id) ? { _id: id } : { rmaNumber: String(id) };
  const rma = await db().Rma.findOne(query);
  if (!rma) throw ApiError.notFound('RMA not found.', 'RMA_NOT_FOUND');

  if (['resolved', 'rejected'].includes(rma.status)) {
    throw ApiError.badRequest(`${rma.rmaNumber} is already ${rma.status}.`, 'RMA_CLOSED');
  }
  if (rma.status !== 'inspecting') {
    // The inspection step is the point. Resolving before it means deciding on
    // goods nobody has looked at — and often on goods that have not arrived.
    throw ApiError.badRequest(
      `${rma.rmaNumber} is ${rma.status.replace('_', ' ')} — it has to be inspected before it can be resolved.`,
      'RMA_NOT_INSPECTED',
    );
  }

  const restocked = [];
  let refund = null;

  if (resolution === 'refund') {
    const amount = Math.round(Number(amountDollars) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw ApiError.badRequest('Enter an amount to refund.', 'INVALID_AMOUNT');
    }

    // `refundOrder` owns the refundable cap and the ledger write. It throws
    // REFUND_TOO_LARGE if this exceeds what the order has left, which is the
    // check that must not be duplicated here — one rule, one place.
    const posted = await storeCredit.refundOrder(
      rma.orderNumber,
      { amount, note: note || `RMA ${rma.rmaNumber}` },
      adminId,
    );

    // `refundOrder` returns `{ balance, entry, refundedTotal, orderTotal }` —
    // the ledger row is `entry`, and its id is what links this RMA to the
    // movement it caused.
    rma.refundAmount = amount;
    rma.creditTransaction = posted.entry?.id ?? undefined;
    refund = {
      amount,
      balance: posted.balance,
      entry: posted.entry,
      refundedTotal: posted.refundedTotal,
      orderTotal: posted.orderTotal,
    };
  }

  // Restock what inspection kept, once. A line already restocked is skipped
  // rather than counted again.
  for (const item of rma.items) {
    if (item.disposition !== 'restock' || item.restockedAt || !item.product) continue;

    const qtyAfter = await applyStockMovement({
      product: item.product,
      type: 'return',
      qtyChange: item.qty,
      reference: { kind: 'rma', id: rma._id, label: rma.rmaNumber },
      note: note || `Returned on ${rma.rmaNumber}`,
      createdBy: adminId,
    });

    item.restockedAt = new Date();
    restocked.push({ sku: item.sku, qty: item.qty, qtyAfter });
  }

  rma.resolution = resolution;
  rma.status = resolution === 'reject' ? 'rejected' : 'resolved';
  rma.timeline.push({
    status: rma.status,
    at: new Date(),
    note:
      note ||
      {
        refund: `Refunded to store credit.`,
        replace: 'Replacement to be shipped.',
        reject: 'Return rejected.',
      }[resolution],
  });

  await rma.save();

  const result = await getRma(rma._id.toString());
  // Named rather than implied: an operator who restocked nothing should be able
  // to see that they restocked nothing.
  return { ...result, restocked, refund };
}

export { listRmas, getRma, createRma, setRmaStatus, inspectRma, resolveRma, RMA_STATUSES };
