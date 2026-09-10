import Supplier from '../models/Supplier.js';
import PurchaseOrder, { DELIVERY_STATUSES } from '../models/PurchaseOrder.js';
import ApiError from '../utils/ApiError.js';
import * as notificationService from './notificationService.js';
import * as supplierMail from './supplierMail.js';
import { renderProformaHtml } from './proformaDocument.js';

/**
 * Supplier bidding on a purchase order — ask several, negotiate, confirm one
 * (§6.8a, re-ruled 2026-09-11).
 *
 * This is what `rfqService` used to be. A `Rfq` document asked the question and
 * a `PurchaseOrder` recorded the answer, which meant one purchase lived in two
 * records and "who did we ask, and what did we pay" needed both of them open.
 * The PO now carries its own bids and the RFQ is gone.
 *
 * **Five rules survive that move unchanged**, because none of them was ever
 * about the RFQ record — they are what makes buying from several suppliers at
 * once fair and auditable:
 *
 *   1. **One supplier never learns another's price.** `shapeForSupplier` returns
 *      that supplier's own bid and nothing else — no rank, no gap to the leader.
 *      Enforced by the serializer rather than by remembering to filter.
 *   2. **An incomplete bid never ranks best.** A supplier who could not fill
 *      every line has a smaller total for a smaller order.
 *   3. **A quoted price is the supplier's; every total is ours.** The one
 *      payload in this app where a price is accepted and kept — and lines are
 *      still matched against the PO's own SKUs, with every subtotal recomputed
 *      against **our** `qtyOrdered` (§8, invariant 8).
 *   4. **Supplier credentials live on `Supplier`, behind their own cookie.**
 *      See `middleware/supplierAuth.js`.
 *   5. **Money never moves here.** Confirming a supplier copies their prices on
 *      to the PO lines; paying and receiving stay in `purchaseService`, so a PO
 *      that came through bidding is indistinguishable downstream from one
 *      raised by hand.
 */

// ---- money ------------------------------------------------------------------

/**
 * Totals for one bid, from the supplier's unit costs and **our** quantities.
 *
 * A supplier sending a quantity is not an error to reject, it is a number to
 * ignore: the total being compared has to be for what we asked for, or the
 * comparison ranks two different orders against each other.
 *
 * Lines marked `available: false` contribute nothing — "cannot supply" is not a
 * price of zero, and counting it as one would make the supplier who can fill
 * least look cheapest.
 */
function recomputeBid(bid, qtyBySku) {
  bid.subtotal = (bid.lines ?? [])
    .filter((line) => line.available !== false)
    .reduce((sum, line) => sum + (line.unitCost ?? 0) * (qtyBySku.get(line.sku) ?? 0), 0);
  bid.total = bid.subtotal + (bid.tax ?? 0) + (bid.shipping ?? 0);
  return bid;
}

function qtyMap(po) {
  return new Map((po.items ?? []).map((item) => [item.sku, item.qtyOrdered]));
}

function findBid(po, supplierId) {
  return (po.bids ?? []).find(
    (candidate) => String(candidate.supplier?._id ?? candidate.supplier) === String(supplierId),
  );
}

// ---- serialising ------------------------------------------------------------

/**
 * The admin's view: every bid, every price, and which one leads.
 *
 * `isBest` is derived here rather than stored, for the same reason a PO's
 * overdue flag is: it is a reading of the current answers, and a stored copy
 * would be wrong the moment a late bid arrives.
 */
function shapeBids(po) {
  const lineQty = qtyMap(po);
  const lineCount = (po.items ?? []).length;

  const bids = (po.bids ?? []).map((bid) => {
    const lines = (bid.lines ?? []).map((line) => ({
      sku: line.sku,
      unitCost: line.unitCost,
      available: line.available !== false,
      note: line.note ?? null,
      qty: lineQty.get(line.sku) ?? 0,
      lineTotal:
        line.available === false ? 0 : (line.unitCost ?? 0) * (lineQty.get(line.sku) ?? 0),
    }));

    const quotedLines = lines.filter((line) => line.available).length;

    return {
      id: bid._id.toString(),
      supplier: bid.supplier?.name
        ? {
            id: bid.supplier._id.toString(),
            name: bid.supplier.name,
            email: bid.supplier.email ?? null,
            componentTypes: bid.supplier.componentTypes ?? [],
          }
        : {
            id: String(bid.supplier ?? ''),
            name: bid.supplierName ?? '—',
            email: null,
            componentTypes: [],
          },
      status: bid.status,
      sentAt: bid.sentAt ?? null,
      viewedAt: bid.viewedAt ?? null,
      quotedAt: bid.quotedAt ?? null,
      lines,
      subtotal: bid.subtotal ?? 0,
      tax: bid.tax ?? 0,
      shipping: bid.shipping ?? 0,
      total: bid.total ?? 0,
      leadTimeDays: bid.leadTimeDays ?? null,
      validUntil: bid.validUntil ?? null,
      note: bid.note ?? null,
      declineReason: bid.declineReason ?? null,
      proforma: bid.proforma ? shapeProforma(bid.proforma) : null,
      negotiations: (bid.negotiations ?? []).map((round) => ({
        id: round._id?.toString() ?? null,
        round: round.round,
        askedTotal: round.askedTotal ?? null,
        askedLines: (round.askedLines ?? []).map((line) => ({
          sku: line.sku,
          unitCost: line.unitCost,
        })),
        theirCounter: round.theirCounter ?? null,
        note: round.note ?? null,
        at: round.at,
        channels: round.channels ?? [],
        respondedAt: round.respondedAt ?? null,
      })),
      delivery: bid.delivery
        ? {
            status: bid.delivery.status ?? 'pending',
            carrier: bid.delivery.carrier ?? null,
            trackingNumber: bid.delivery.trackingNumber ?? null,
            dispatchedAt: bid.delivery.dispatchedAt ?? null,
            expectedAt: bid.delivery.expectedAt ?? null,
            deliveredAt: bid.delivery.deliveredAt ?? null,
            note: bid.delivery.note ?? null,
          }
        : null,
      // Whether this supplier priced every requested line. The comparison sorts
      // on total, and a partial answer sorted beside a complete one is how the
      // cheapest-looking bid turns out not to cover the order.
      complete: quotedLines === lineCount && quotedLines > 0,
      quotedLines,
    };
  });

  // Cheapest complete answer first. Ties keep insertion order, which is the
  // order they were invited in.
  const ranked = bids
    .filter((bid) => bid.status === 'quoted' && bid.complete)
    .sort((a, b) => a.total - b.total);
  const bestId = ranked[0]?.id ?? null;

  return bids.map((bid) => ({ ...bid, isBest: bid.id === bestId }));
}

function shapeProforma(proforma) {
  return {
    number: proforma.number ?? null,
    revision: proforma.revision ?? 1,
    issuedAt: proforma.issuedAt ?? null,
    validUntil: proforma.validUntil ?? null,
    subtotal: proforma.subtotal ?? 0,
    tax: proforma.tax ?? 0,
    shipping: proforma.shipping ?? 0,
    total: proforma.total ?? 0,
    paymentTerms: proforma.paymentTerms ?? null,
    bankDetails: proforma.bankDetails ?? null,
    note: proforma.note ?? null,
    acceptedAt: proforma.acceptedAt ?? null,
    history: (proforma.history ?? []).map((entry) => ({
      revision: entry.revision,
      total: entry.total,
      issuedAt: entry.issuedAt,
      supersededAt: entry.supersededAt,
    })),
  };
}

/**
 * The portal's view: this supplier's own bid, and **nothing about any other**.
 *
 * Rule 1, enforced by the serializer rather than by remembering to filter at
 * each call site. Nothing here names another supplier, counts how many were
 * asked, or says where this bid ranks.
 */
function shapeForSupplier(po, supplierId) {
  const bid = findBid(po, supplierId);
  if (!bid) return null;

  const closed = Boolean(po.closesAt && new Date(po.closesAt) < new Date());
  const isWinner = String(po.confirmedBid ?? '') === String(bid._id);

  // What the supplier is told, which is not our internal status: a PO confirmed
  // to somebody else reads as `closed` to them, and `draft` is never visible
  // because a draft has not been sent.
  let state = 'open';
  if (po.status === 'cancelled') state = 'cancelled';
  else if (['confirmed', 'partial', 'received'].includes(po.status)) {
    state = isWinner ? 'won' : 'closed';
  } else if (closed) state = 'closed';

  return {
    id: po._id.toString(),
    poNumber: po.poNumber,
    title: po.title ?? null,
    state,
    items: (po.items ?? []).map((item) => ({
      sku: item.sku,
      name: item.name,
      qty: item.qtyOrdered,
    })),
    myBid: {
      status: bid.status,
      lines: (bid.lines ?? []).map((line) => ({
        sku: line.sku,
        unitCost: line.unitCost,
        available: line.available !== false,
        note: line.note ?? null,
      })),
      subtotal: bid.subtotal ?? 0,
      tax: bid.tax ?? 0,
      shipping: bid.shipping ?? 0,
      total: bid.total ?? 0,
      leadTimeDays: bid.leadTimeDays ?? null,
      validUntil: bid.validUntil ?? null,
      note: bid.note ?? null,
      quotedAt: bid.quotedAt ?? null,
      proforma: bid.proforma ? shapeProforma(bid.proforma) : null,
      // Their own negotiation history. What we asked them for is theirs to see;
      // what we asked anybody else is not.
      negotiations: (bid.negotiations ?? []).map((round) => ({
        round: round.round,
        askedTotal: round.askedTotal ?? null,
        askedLines: (round.askedLines ?? []).map((line) => ({
          sku: line.sku,
          unitCost: line.unitCost,
        })),
        note: round.note ?? null,
        at: round.at,
        respondedAt: round.respondedAt ?? null,
      })),
      delivery: isWinner && bid.delivery
        ? {
            status: bid.delivery.status ?? 'pending',
            carrier: bid.delivery.carrier ?? null,
            trackingNumber: bid.delivery.trackingNumber ?? null,
            dispatchedAt: bid.delivery.dispatchedAt ?? null,
            expectedAt: bid.delivery.expectedAt ?? null,
            deliveredAt: bid.delivery.deliveredAt ?? null,
            note: bid.delivery.note ?? null,
          }
        : null,
    },
    closesAt: po.closesAt ?? null,
    closed,
    expectedDate: po.expectedDate ?? null,
    createdAt: po.createdAt,
  };
}

// ---- the supplier picker ----------------------------------------------------

/**
 * Who can be asked for a price on these component types.
 *
 * **The tag is what makes bidding possible.** A purchasing clerk asks "who
 * sells batteries", not "which of forty suppliers do I remember"; a supplier
 * who could have quoted and was never asked is the failure this prevents.
 */
async function suppliersForComponentTypes(componentTypes = []) {
  const types = (Array.isArray(componentTypes) ? componentTypes : [componentTypes])
    .map((type) => String(type ?? '').trim())
    .filter(Boolean);

  if (!types.length) return { suppliers: [], componentTypes: [] };

  const suppliers = await Supplier.find({
    isActive: true,
    componentTypes: { $in: types },
  })
    .sort({ name: 1 })
    .select(
      'name code email contactName componentTypes paymentTerms ordersCount totalSpent portalInviteAt',
    )
    .lean();

  return {
    componentTypes: types,
    suppliers: suppliers.map((supplier) => ({
      id: supplier._id.toString(),
      name: supplier.name,
      code: supplier.code ?? null,
      email: supplier.email ?? null,
      contactName: supplier.contactName ?? null,
      componentTypes: supplier.componentTypes ?? [],
      // Which of the requested types this supplier actually covers. A supplier
      // tagged for batteries only, on an order covering batteries and screens,
      // is worth asking — and worth showing as the partial match they are.
      matched: (supplier.componentTypes ?? []).filter((type) => types.includes(type)),
      paymentTerms: supplier.paymentTerms,
      ordersCount: supplier.ordersCount ?? 0,
      totalSpent: supplier.totalSpent ?? 0,
      // Whether they can actually answer online. A supplier with no portal
      // access can still be asked — the mail carries the line list — but the
      // screen should say so rather than let a clerk expect a price that has
      // nowhere to be typed.
      hasPortal: Boolean(supplier.portalInviteAt),
    })),
  };
}

// ---- admin: invite, send, negotiate, confirm --------------------------------

async function loadPo(id, { populate = true } = {}) {
  const query = PurchaseOrder.findById(id);
  if (populate) query.populate('bids.supplier', 'name email componentTypes contactConsent preferredChannel');
  const po = await query;
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');
  return po;
}

/**
 * Add suppliers to a purchase order.
 *
 * Additive and idempotent: a supplier already on the order is skipped rather
 * than duplicated or reset, because re-running the picker after adding one line
 * must not wipe the prices already collected.
 */
async function inviteSuppliers(id, { supplierIds = [] } = {}) {
  const po = await loadPo(id, { populate: false });

  if (['confirmed', 'partial', 'received', 'cancelled'].includes(po.status)) {
    throw ApiError.badRequest(
      `${po.poNumber} has already been decided.`,
      'PO_ALREADY_DECIDED',
    );
  }

  const ids = [...new Set(supplierIds.map(String))];
  const existing = new Set((po.bids ?? []).map((bid) => String(bid.supplier)));
  const wanted = ids.filter((supplierId) => !existing.has(supplierId));

  if (!wanted.length) return { added: 0, po: await getBidBoard(po._id) };

  const suppliers = await Supplier.find({ _id: { $in: wanted }, isActive: true })
    .select('name email')
    .lean();

  suppliers.forEach((supplier) => {
    po.bids.push({
      supplier: supplier._id,
      supplierName: supplier.name,
      status: 'invited',
      // Sent immediately if the order is already out; otherwise `sendPurchaseOrder`
      // stamps it, so a draft never claims to have been sent.
      sentAt: po.status === 'draft' ? undefined : new Date(),
    });
  });

  await po.save();

  // Mail only the ones added to an order already out with others.
  if (po.status !== 'draft') {
    await Promise.all(
      suppliers.map((supplier) => sendInvitationSafely(po, supplier)),
    );
  }

  return { added: suppliers.length, po: await getBidBoard(po._id) };
}

async function removeSupplier(id, supplierId) {
  const po = await loadPo(id, { populate: false });

  const bid = findBid(po, supplierId);
  if (!bid) throw ApiError.notFound('That supplier is not on this order.', 'BID_NOT_FOUND');

  if (bid.status === 'confirmed') {
    throw ApiError.badRequest(
      'That supplier is confirmed for this order — cancel the order instead.',
      'BID_CONFIRMED',
    );
  }

  bid.deleteOne();
  await po.save();

  return { po: await getBidBoard(po._id) };
}

/**
 * `draft → sent`: the order goes out to everybody on it.
 *
 * Mail failures never fail the send. A supplier whose mail bounced is still on
 * the order and can still be chased; refusing the whole send because one
 * address is dead would hold up the other four.
 */
async function sendPurchaseOrder(id, { note } = {}) {
  const po = await loadPo(id, { populate: false });

  if (po.status !== 'draft') {
    throw ApiError.badRequest(`${po.poNumber} has already been sent.`, 'PO_ALREADY_SENT');
  }
  if (!po.items.length) {
    throw ApiError.badRequest('Add a line before sending this order.', 'PO_EMPTY');
  }
  if (!po.bids.length) {
    throw ApiError.badRequest(
      'Add at least one supplier before sending this order.',
      'PO_NO_SUPPLIERS',
    );
  }

  const now = new Date();
  po.status = 'sent';
  po.bids.forEach((bid) => {
    if (bid.status === 'invited' && !bid.sentAt) bid.sentAt = now;
  });
  po.timeline.push({
    status: 'sent',
    at: now,
    note: note ?? `Sent to ${po.bids.length} supplier(s).`,
  });

  await po.save();

  const suppliers = await Supplier.find({ _id: { $in: po.bids.map((bid) => bid.supplier) } })
    .select('name email')
    .lean();
  const results = await Promise.all(
    suppliers.map((supplier) => sendInvitationSafely(po, supplier)),
  );

  return {
    po: await getBidBoard(po._id),
    mailed: results.filter(Boolean).length,
    total: suppliers.length,
  };
}

/** Never lets a dead mailbox fail the thing being notified about. */
async function sendInvitationSafely(po, supplier) {
  try {
    const result = await supplierMail.sendPurchaseOrderInvitation({ supplier, po });
    return result?.delivered ?? false;
  } catch (error) {
    console.error(`  Purchase: invitation to ${supplier.name} failed — ${error.message}`);
    return false;
  }
}

/**
 * Push back on a supplier's price.
 *
 * Append-only. The supplier is mailed and, where they have consented, messaged
 * on their other channels — and `channels` records where it actually went,
 * never where we meant it to go.
 */
async function negotiate(id, supplierId, { askedTotal, askedLines, note } = {}, by) {
  const po = await loadPo(id, { populate: false });

  if (['confirmed', 'partial', 'received', 'cancelled'].includes(po.status)) {
    throw ApiError.badRequest(`${po.poNumber} has already been decided.`, 'PO_ALREADY_DECIDED');
  }

  const bid = findBid(po, supplierId);
  if (!bid) throw ApiError.notFound('That supplier is not on this order.', 'BID_NOT_FOUND');

  if (!['quoted', 'negotiating'].includes(bid.status)) {
    throw ApiError.badRequest(
      'There is nothing to negotiate yet — this supplier has not priced the order.',
      'BID_NOT_QUOTED',
    );
  }

  const round = (bid.negotiations?.length ?? 0) + 1;
  const supplier = await Supplier.findById(supplierId).lean();

  const channels = await notifySupplier(supplier, {
    subject: `We would like to revisit ${po.poNumber}`,
    po,
    askedTotal,
    note,
  });

  bid.negotiations.push({
    round,
    askedTotal: askedTotal != null ? Math.max(0, Math.round(askedTotal)) : undefined,
    askedLines: (askedLines ?? []).map((line) => ({
      sku: line.sku,
      unitCost: Math.max(0, Math.round(line.unitCost ?? 0)),
    })),
    theirCounter: bid.total ?? 0,
    note,
    at: new Date(),
    by,
    channels,
  });
  bid.status = 'negotiating';

  if (po.status === 'sent') po.status = 'negotiating';
  po.timeline.push({
    status: 'negotiating',
    at: new Date(),
    note: `Round ${round} with ${bid.supplierName ?? 'a supplier'}.`,
  });

  await po.save();
  return { po: await getBidBoard(po._id) };
}

/**
 * Email always, plus every channel the supplier has consented to.
 *
 * Email is the record — it is where the paperwork lands and what a dispute
 * reads back — so it goes regardless of what else does. The extra channels are
 * a courtesy on top, gated on consent (CASL, §6.13) and on the provider
 * actually being configured. Returns what genuinely went out.
 */
async function notifySupplier(supplier, payload) {
  if (!supplier) return [];

  const sent = [];

  try {
    const result = await supplierMail.sendNegotiationEmail({ supplier, ...payload });
    if (result?.delivered) sent.push('email');
  } catch (error) {
    console.error(`  Purchase: negotiation mail to ${supplier.name} failed — ${error.message}`);
  }

  // The preferred channel first, then anything else consented to. Both are
  // best-effort: an unconfigured provider is a logged no-op, never a throw.
  const consent = supplier.contactConsent ?? {};
  const extra = ['sms', 'whatsapp'].filter((channel) => consent[channel]);
  const ordered = supplier.preferredChannel && extra.includes(supplier.preferredChannel)
    ? [supplier.preferredChannel, ...extra.filter((c) => c !== supplier.preferredChannel)]
    : extra;

  for (const channel of ordered) {
    try {
      const delivered = await supplierMail.sendSupplierMessage({
        supplier,
        channel,
        ...payload,
      });
      if (delivered) sent.push(channel);
    } catch (error) {
      console.error(`  Purchase: ${channel} to ${supplier.name} failed — ${error.message}`);
    }
  }

  return sent;
}

/**
 * Pick the supplier this order is placed with.
 *
 * **This is where a bid becomes the purchase order.** The winner's unit costs
 * are copied on to the PO lines, `supplier` is set to them, and everything
 * downstream — receiving, the stock ledger, the `Expense` a payment writes,
 * the spend totals — then works exactly as it does for an order raised by
 * hand. Rule 5.
 *
 * Only lines the winner marked available are priced. A supplier who could fill
 * nine of ten lines gets an order for nine; the tenth is left unbought rather
 * than ordered from somebody who said they did not have it, and the response
 * names what was dropped so the clerk can raise a second order for them.
 */
async function confirmSupplier(id, { supplierId, expectedDate, note } = {}) {
  const po = await loadPo(id, { populate: false });

  if (['confirmed', 'partial', 'received'].includes(po.status)) {
    throw ApiError.badRequest(`${po.poNumber} is already confirmed.`, 'PO_ALREADY_CONFIRMED');
  }
  if (po.status === 'cancelled') {
    throw ApiError.badRequest(`${po.poNumber} is cancelled.`, 'PO_CANCELLED');
  }

  const bid = findBid(po, supplierId);
  if (!bid) throw ApiError.notFound('That supplier is not on this order.', 'BID_NOT_FOUND');
  if (!['quoted', 'negotiating'].includes(bid.status)) {
    throw ApiError.badRequest(
      'That supplier has not priced this order.',
      'BID_NOT_QUOTED',
    );
  }

  const priced = new Map(
    (bid.lines ?? [])
      .filter((line) => line.available !== false)
      .map((line) => [line.sku, line.unitCost ?? 0]),
  );

  const dropped = [];
  po.items.forEach((item) => {
    if (!priced.has(item.sku)) {
      dropped.push({ sku: item.sku, name: item.name });
      return;
    }
    item.unitCost = priced.get(item.sku);
    item.lineTotal = item.qtyOrdered * item.unitCost;
  });

  // Lines the winner cannot supply leave the order rather than sitting on it at
  // a price nobody quoted.
  if (dropped.length) {
    const droppedSkus = new Set(dropped.map((line) => line.sku));
    po.items = po.items.filter((item) => !droppedSkus.has(item.sku));
  }

  if (!po.items.length) {
    throw ApiError.badRequest(
      'That supplier cannot supply any line on this order.',
      'BID_SUPPLIES_NOTHING',
    );
  }

  const now = new Date();

  po.supplier = bid.supplier;
  po.confirmedBid = bid._id;
  po.confirmedAt = now;
  po.status = 'confirmed';
  po.shipping = bid.shipping ?? 0;
  po.tax = bid.tax ?? 0;
  if (expectedDate) po.expectedDate = new Date(expectedDate);

  po.subtotal = po.items.reduce((sum, item) => sum + item.lineTotal, 0);
  po.total = po.subtotal + (po.tax ?? 0) + (po.shipping ?? 0);

  bid.status = 'confirmed';
  bid.delivery = { ...(bid.delivery?.toObject?.() ?? bid.delivery ?? {}), status: 'pending' };
  if (bid.proforma && !bid.proforma.acceptedAt) bid.proforma.acceptedAt = now;

  // Both halves of the decision are written together, so an order can never
  // have two confirmed suppliers or a winner without losers.
  po.bids.forEach((other) => {
    if (String(other._id) !== String(bid._id) && other.status !== 'declined') {
      other.status = 'lost';
    }
  });

  po.timeline.push({
    status: 'confirmed',
    at: now,
    note: note ?? `Confirmed with ${bid.supplierName ?? 'supplier'}.`,
  });

  await po.save();

  return { po: await getBidBoard(po._id), dropped };
}

// ---- the portal side --------------------------------------------------------

/** Every order this supplier was asked to price. Their own bid, never another's. */
async function listForSupplier(supplierId) {
  const orders = await PurchaseOrder.find({
    'bids.supplier': supplierId,
    status: { $ne: 'draft' },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return {
    orders: orders.map((po) => shapeForSupplier(po, supplierId)).filter(Boolean),
  };
}

/** One order, as its supplier sees it. Marks it viewed on first open. */
async function getForSupplier(id, supplierId) {
  const po = await PurchaseOrder.findOne({
    _id: id,
    'bids.supplier': supplierId,
    status: { $ne: 'draft' },
  });
  if (!po) throw ApiError.notFound('Order not found.', 'PO_NOT_FOUND');

  const bid = findBid(po, supplierId);
  if (bid.status === 'invited') {
    bid.status = 'viewed';
    bid.viewedAt = new Date();
    await po.save();
  }

  return { order: shapeForSupplier(po.toObject(), supplierId) };
}

/**
 * A supplier prices the order.
 *
 * Rule 3 in full: the unit costs are theirs and are kept; every total is
 * recomputed from them against our quantities. Lines naming a SKU this order
 * does not contain are dropped rather than rejected — a supplier pasting an old
 * quote should not be met with a validation wall.
 */
async function submitBid(id, supplierId, body) {
  const po = await PurchaseOrder.findOne({
    _id: id,
    'bids.supplier': supplierId,
    status: { $ne: 'draft' },
  });
  if (!po) throw ApiError.notFound('Order not found.', 'PO_NOT_FOUND');

  assertBiddable(po);

  const bid = findBid(po, supplierId);
  const requested = qtyMap(po);

  const lines = (body.lines ?? [])
    .filter((line) => requested.has(line.sku))
    .map((line) => ({
      sku: line.sku,
      unitCost: Math.max(0, Math.round(line.unitCost ?? 0)),
      available: line.available !== false,
      note: line.note,
    }));

  if (!lines.length) {
    throw ApiError.badRequest('Price at least one line before sending your quote.', 'BID_EMPTY');
  }

  bid.lines = lines;
  bid.tax = Math.max(0, Math.round(body.tax ?? 0));
  bid.shipping = Math.max(0, Math.round(body.shipping ?? 0));
  bid.leadTimeDays = body.leadTimeDays;
  bid.validUntil = body.validUntil ? new Date(body.validUntil) : undefined;
  bid.note = body.note;
  bid.status = 'quoted';
  bid.quotedAt = new Date();

  recomputeBid(bid, requested);

  // A round that has been answered stops looking outstanding.
  const open = (bid.negotiations ?? []).filter((round) => !round.respondedAt);
  open.forEach((round) => {
    round.respondedAt = new Date();
    round.theirCounter = bid.total;
  });

  po.timeline.push({
    status: 'quoted',
    at: new Date(),
    note: `${bid.supplierName ?? 'A supplier'} sent a price.`,
  });
  await po.save();

  await notificationService.emit({
    type: 'po_quoted',
    severity: 'info',
    title: `${bid.supplierName ?? 'A supplier'} priced ${po.poNumber}`,
    detail: `${lines.length} line(s) priced · awaiting comparison`,
    entity: { kind: 'purchase-order', id: po._id.toString(), label: po.poNumber },
    href: `/admin/purchase-orders/${po._id}`,
  });

  return { order: shapeForSupplier(po.toObject(), supplierId) };
}

function assertBiddable(po) {
  if (['confirmed', 'partial', 'received'].includes(po.status)) {
    throw ApiError.badRequest('This order has already been decided.', 'PO_DECIDED');
  }
  if (po.status === 'cancelled') {
    throw ApiError.badRequest('This order was withdrawn.', 'PO_CANCELLED');
  }
  if (po.closesAt && new Date(po.closesAt) < new Date()) {
    throw ApiError.badRequest('This order has closed.', 'PO_CLOSED');
  }
}

/** "We cannot supply this." A recorded no is worth far more than silence. */
async function declineBid(id, supplierId, { reason } = {}) {
  const po = await PurchaseOrder.findOne({
    _id: id,
    'bids.supplier': supplierId,
    status: { $ne: 'draft' },
  });
  if (!po) throw ApiError.notFound('Order not found.', 'PO_NOT_FOUND');

  assertBiddable(po);

  const bid = findBid(po, supplierId);
  bid.status = 'declined';
  bid.declineReason = reason;
  bid.lines = [];
  bid.subtotal = 0;
  bid.total = 0;

  po.timeline.push({
    status: 'declined',
    at: new Date(),
    note: `${bid.supplierName ?? 'A supplier'} declined${reason ? ` — ${reason}` : ''}.`,
  });
  await po.save();

  return { order: shapeForSupplier(po.toObject(), supplierId) };
}

/**
 * A supplier issues a proforma invoice against this order (§6.8b).
 *
 * **Form-driven, never uploaded**: the supplier states the numbers and the
 * server totals them, so the document's arithmetic is ours even though the
 * prices are theirs. `proformaDocument.js` renders it.
 *
 * A second PI supersedes the first rather than overwriting it — the number that
 * was negotiated away has to stay readable.
 */
async function submitProforma(id, supplierId, body) {
  const po = await PurchaseOrder.findOne({
    _id: id,
    'bids.supplier': supplierId,
    status: { $ne: 'draft' },
  });
  if (!po) throw ApiError.notFound('Order not found.', 'PO_NOT_FOUND');

  if (po.status === 'cancelled') {
    throw ApiError.badRequest('This order was withdrawn.', 'PO_CANCELLED');
  }

  const bid = findBid(po, supplierId);
  if (!['quoted', 'negotiating', 'confirmed'].includes(bid.status)) {
    throw ApiError.badRequest(
      'Send your price before issuing a proforma invoice.',
      'BID_NOT_QUOTED',
    );
  }

  const previous = bid.proforma;
  const revision = previous ? (previous.revision ?? 1) + 1 : 1;

  // Totalled from the bid lines, not from the payload: a PI that disagrees with
  // the prices it was raised from is a document nobody can reconcile.
  const requested = qtyMap(po);
  const subtotal = (bid.lines ?? [])
    .filter((line) => line.available !== false)
    .reduce((sum, line) => sum + (line.unitCost ?? 0) * (requested.get(line.sku) ?? 0), 0);
  const tax = Math.max(0, Math.round(body.tax ?? bid.tax ?? 0));
  const shipping = Math.max(0, Math.round(body.shipping ?? bid.shipping ?? 0));

  const history = previous
    ? [
        ...(previous.history ?? []),
        {
          revision: previous.revision ?? 1,
          total: previous.total ?? 0,
          issuedAt: previous.issuedAt,
          supersededAt: new Date(),
        },
      ]
    : [];

  bid.proforma = {
    number: body.number,
    revision,
    issuedAt: new Date(),
    validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    subtotal,
    tax,
    shipping,
    total: subtotal + tax + shipping,
    paymentTerms: body.paymentTerms,
    bankDetails: body.bankDetails,
    note: body.note,
    history,
  };

  po.timeline.push({
    status: 'proforma',
    at: new Date(),
    note: `${bid.supplierName ?? 'A supplier'} issued a proforma invoice${revision > 1 ? ` (rev ${revision})` : ''}.`,
  });
  await po.save();

  await notificationService.emit({
    type: 'po_proforma',
    severity: 'info',
    title: `${bid.supplierName ?? 'A supplier'} sent a proforma for ${po.poNumber}`,
    detail:
      revision > 1
        ? `Revision ${revision} · awaiting review`
        : 'Awaiting review',
    entity: { kind: 'purchase-order', id: po._id.toString(), label: po.poNumber },
    href: `/admin/purchase-orders/${po._id}`,
  });

  await notifyAdminsByMail({
    subject: `Proforma invoice for ${po.poNumber}`,
    po,
    supplierName: bid.supplierName,
    kind: 'proforma',
  });

  return { order: shapeForSupplier(po.toObject(), supplierId) };
}

/**
 * The confirmed supplier reports on getting the goods to us.
 *
 * Only the confirmed supplier may: an order is placed with one of them, and a
 * losing bidder marking a delivery dispatched is a fact about nothing.
 *
 * **This does not move stock.** Receiving is a physical count somebody makes at
 * our end, and a supplier saying "delivered" is a claim, not a receipt —
 * `purchaseService.receivePurchaseOrder` stays the only path into the ledger.
 */
async function setDeliveryStatus(id, supplierId, body) {
  const po = await PurchaseOrder.findOne({ _id: id, 'bids.supplier': supplierId });
  if (!po) throw ApiError.notFound('Order not found.', 'PO_NOT_FOUND');

  const bid = findBid(po, supplierId);
  if (String(po.confirmedBid ?? '') !== String(bid._id)) {
    throw ApiError.badRequest('This order was not confirmed with you.', 'BID_NOT_CONFIRMED');
  }

  const status = String(body.status ?? '');
  if (!DELIVERY_STATUSES.includes(status)) {
    throw ApiError.badRequest('That is not a delivery status.', 'DELIVERY_STATUS_INVALID');
  }

  const now = new Date();
  bid.delivery = {
    ...(bid.delivery?.toObject?.() ?? bid.delivery ?? {}),
    status,
    carrier: body.carrier ?? bid.delivery?.carrier,
    trackingNumber: body.trackingNumber ?? bid.delivery?.trackingNumber,
    expectedAt: body.expectedAt ? new Date(body.expectedAt) : bid.delivery?.expectedAt,
    note: body.note ?? bid.delivery?.note,
    dispatchedAt:
      status === 'dispatched' ? (bid.delivery?.dispatchedAt ?? now) : bid.delivery?.dispatchedAt,
    deliveredAt:
      status === 'delivered' ? (bid.delivery?.deliveredAt ?? now) : bid.delivery?.deliveredAt,
  };

  po.timeline.push({
    status: 'delivery',
    at: now,
    note: `${bid.supplierName ?? 'Supplier'} marked the delivery ${status.replace('_', ' ')}.`,
  });
  await po.save();

  await notificationService.emit({
    type: 'po_delivery',
    severity: status === 'delivered' ? 'success' : 'info',
    title: `${po.poNumber} — delivery ${status.replace('_', ' ')}`,
    detail: bid.delivery.trackingNumber
      ? `${bid.supplierName ?? 'Supplier'} · ${bid.delivery.trackingNumber}`
      : (bid.supplierName ?? 'Supplier'),
    entity: { kind: 'purchase-order', id: po._id.toString(), label: po.poNumber },
    href: `/admin/purchase-orders/${po._id}`,
  });

  await notifyAdminsByMail({
    subject: `${po.poNumber} — delivery ${status.replace('_', ' ')}`,
    po,
    supplierName: bid.supplierName,
    kind: 'delivery',
    status,
  });

  return { order: shapeForSupplier(po.toObject(), supplierId) };
}

/** Best-effort, like every other notification path here. */
async function notifyAdminsByMail(payload) {
  try {
    await supplierMail.sendPurchaseAdminAlert(payload);
  } catch (error) {
    console.error(`  Purchase: admin alert failed — ${error.message}`);
  }
}

/**
 * One supplier's proforma invoice, as a printable sheet.
 *
 * Readable from both sides: the admin opens it from the PO's supplier panel,
 * and the supplier who raised it can open their own. `supplierId` is supplied
 * by the caller's session in either case, so a supplier can never name another
 * supplier's bid.
 */
async function proformaDocument(id, supplierId, { nonce = null } = {}) {
  const po = await PurchaseOrder.findById(id).lean();
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');

  const bid = findBid(po, supplierId);
  if (!bid?.proforma) {
    throw ApiError.notFound('No proforma invoice on this order.', 'PROFORMA_NOT_FOUND');
  }

  const supplier = await Supplier.findById(bid.supplier).select('name email phone address').lean();
  const html = renderProformaHtml({ po, bid, supplier, nonce });
  if (!html) throw ApiError.notFound('No proforma invoice on this order.', 'PROFORMA_NOT_FOUND');

  return html;
}

// ---- the admin's bid board --------------------------------------------------

/** Everything the PO detail page's supplier panel renders. */
async function getBidBoard(id) {
  const po = await PurchaseOrder.findById(id)
    .populate('bids.supplier', 'name email componentTypes')
    .lean();
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');

  const bids = shapeBids(po);

  return {
    id: po._id.toString(),
    poNumber: po.poNumber,
    status: po.status,
    componentTypes: po.componentTypes ?? [],
    closesAt: po.closesAt ?? null,
    closed: Boolean(po.closesAt && new Date(po.closesAt) < new Date()),
    confirmedBid: po.confirmedBid?.toString() ?? null,
    confirmedAt: po.confirmedAt ?? null,
    bids,
    bidCount: bids.length,
    quoteCount: bids.filter((bid) => bid.status === 'quoted').length,
    bestBid: bids.find((bid) => bid.isBest)?.id ?? null,
  };
}

export {
  confirmSupplier,
  declineBid,
  getBidBoard,
  getForSupplier,
  inviteSuppliers,
  listForSupplier,
  negotiate,
  proformaDocument,
  removeSupplier,
  sendPurchaseOrder,
  setDeliveryStatus,
  shapeBids,
  shapeForSupplier,
  submitBid,
  submitProforma,
  suppliersForComponentTypes,
};
