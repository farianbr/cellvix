import mongoose from 'mongoose';

import Rfq from '../models/Rfq.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import notificationService from './notificationService.js';
import { sendRfqInvitation, sendRfqOutcome } from './supplierMail.js';

/**
 * Requests for quote — ask several suppliers one question, compare the answers,
 * award one (supplier process flow, §6.8a).
 *
 * This is the step that used to be missing between "we need stock" and a
 * purchase order. A PO names a supplier and a price already agreed; before
 * that there is a real piece of work — deciding **who** and **for how much** —
 * and it was being done in inboxes.
 *
 * Four rules hold this file together:
 *
 *   1. **A supplier is found by what they sell, not by memory.** Suppliers are
 *      tagged with component types (`Supplier.componentTypes`, the same
 *      `Product.partType` slugs the storefront filters on), and the picker is
 *      driven by the component types on the request. A clerk who has to recall
 *      which of forty suppliers stock batteries is a clerk who forgets one.
 *   2. **A quoted price is the supplier's, a total is ours.** Every other
 *      service here refuses a client-sent price; this one exists to collect
 *      them, so `unitCost` arrives from outside. Every subtotal and total is
 *      still recomputed from the lines (§8, invariant 8) — a supplier who sends
 *      a total that flatters their own lines must not have it believed.
 *   3. **One supplier never learns another's price.** The portal serializer
 *      (`shapeForSupplier`) returns that supplier's own invite and nothing
 *      else. Not a rank, not a "you are $40 off the best" — that is the
 *      purchasing team's information, and leaking it converts a sealed request
 *      into a live auction nobody agreed to run.
 *   4. **Awarding produces a normal purchase order.** Everything downstream —
 *      receiving, the stock ledger, the expense a payment generates — already
 *      works and is not re-implemented here. `awardRfq` calls into the same
 *      `PurchaseOrder` shape `purchaseService` builds, so a PO that came from a
 *      request is indistinguishable from one raised by hand, and paying the
 *      winner is the button that already exists.
 */

// ---- helpers ----------------------------------------------------------------

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value ?? ''));
}

/** `RFQ-2026-00001`. Same scheme as `PO-`/`INV-`/`QT-` (§8). */
async function nextRfqNumber() {
  const year = new Date().getFullYear();
  const full = `RFQ-${year}-`;
  const last = await Rfq.findOne({ rfqNumber: new RegExp(`^${full}`) })
    .sort({ rfqNumber: -1 })
    .select('rfqNumber')
    .lean();

  const sequence = last ? Number(last.rfqNumber.slice(full.length)) + 1 : 1;
  return `${full}${String(sequence).padStart(5, '0')}`;
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

/** `PO-` numbering, borrowed rather than duplicated in spirit — see `awardRfq`. */
async function nextPoNumber() {
  const year = new Date().getFullYear();
  const full = `PO-${year}-`;
  const last = await PurchaseOrder.findOne({ poNumber: new RegExp(`^${full}`) })
    .sort({ poNumber: -1 })
    .select('poNumber')
    .lean();

  const sequence = last ? Number(last.poNumber.slice(full.length)) + 1 : 1;
  return `${full}${String(sequence).padStart(5, '0')}`;
}

/**
 * Totals for one supplier's answer, from their lines.
 *
 * **Quantities come from the request, not from the answer** — `qtyBySku` is the
 * requested map. A supplier sends prices; what those prices are multiplied by
 * is ours to decide, or a quote could be made to total anything by sending a
 * quantity nobody asked for.
 *
 * **Unavailable lines are excluded from the money.** A supplier who can only
 * fill nine of ten lines has not quoted the same thing as one who filled all
 * ten, and summing them as though they had would make the incomplete answer
 * look cheapest — precisely the comparison this screen exists to get right.
 * `shapeRfq` marks such an answer incomplete so it never ranks as best.
 */
function recomputeInvite(invite, qtyBySku) {
  invite.subtotal = (invite.lines ?? [])
    .filter((line) => line.available !== false)
    .reduce((sum, line) => sum + (line.unitCost ?? 0) * (qtyBySku.get(line.sku) ?? 0), 0);
  invite.total = invite.subtotal + (invite.shipping ?? 0);
  return invite;
}

// ---- serialising ------------------------------------------------------------

/**
 * The admin's view: every invite, every price.
 *
 * `ranking` is derived here rather than stored, for the same reason a PO's
 * overdue flag is: it is a reading of the current answers, and a stored copy
 * would be wrong the moment a late quote arrives. Only complete answers are
 * ranked — see `recomputeInvite`.
 */
function shapeRfq(rfq, { items = null } = {}) {
  const lineQty = new Map((rfq.items ?? []).map((item) => [item.sku, item.qty]));

  const invites = (rfq.invites ?? []).map((invite) => {
    const lines = (invite.lines ?? []).map((line) => ({
      sku: line.sku,
      unitCost: line.unitCost,
      available: line.available !== false,
      note: line.note ?? null,
      qty: lineQty.get(line.sku) ?? 0,
      lineTotal: line.available === false ? 0 : (line.unitCost ?? 0) * (lineQty.get(line.sku) ?? 0),
    }));

    const quotedLines = lines.filter((line) => line.available).length;

    return {
      id: invite._id.toString(),
      supplier: invite.supplier?.name
        ? {
            id: invite.supplier._id.toString(),
            name: invite.supplier.name,
            email: invite.supplier.email ?? null,
            componentTypes: invite.supplier.componentTypes ?? [],
          }
        : { id: String(invite.supplier ?? ''), name: invite.supplierName ?? '—', email: null, componentTypes: [] },
      status: invite.status,
      sentAt: invite.sentAt ?? null,
      viewedAt: invite.viewedAt ?? null,
      quotedAt: invite.quotedAt ?? null,
      lines,
      subtotal: invite.subtotal ?? 0,
      shipping: invite.shipping ?? 0,
      total: invite.total ?? 0,
      leadTimeDays: invite.leadTimeDays ?? null,
      validUntil: invite.validUntil ?? null,
      note: invite.note ?? null,
      declineReason: invite.declineReason ?? null,
      // Whether this supplier priced every requested line. The comparison sorts
      // on total, and a partial answer sorted beside a complete one is how the
      // cheapest-looking quote turns out not to cover the order.
      complete: quotedLines === (rfq.items ?? []).length && quotedLines > 0,
      quotedLines,
    };
  });

  // Cheapest complete answer first, then the rest by total. Ties keep insertion
  // order, which is the order they were invited in.
  const ranked = invites
    .filter((invite) => invite.status === 'quoted' && invite.complete)
    .sort((a, b) => a.total - b.total);
  const bestId = ranked[0]?.id ?? null;

  return {
    id: rfq._id.toString(),
    rfqNumber: rfq.rfqNumber,
    title: rfq.title ?? null,
    status: rfq.status,
    componentTypes: rfq.componentTypes ?? [],
    items: (rfq.items ?? []).map((item) => ({
      product: item.product?.toString() ?? null,
      sku: item.sku,
      name: item.name,
      partType: item.partType ?? null,
      qty: item.qty,
    })),
    itemCount: (rfq.items ?? []).length,
    invites: invites.map((invite) => ({ ...invite, isBest: invite.id === bestId })),
    inviteCount: invites.length,
    quoteCount: invites.filter((invite) => invite.status === 'quoted').length,
    bestInvite: bestId,
    closesAt: rfq.closesAt ?? null,
    // Closed is derived, never stored — as `Quote.validUntil` is (§6.6).
    closed: Boolean(rfq.closesAt && new Date(rfq.closesAt) < new Date()),
    awardedInvite: rfq.awardedInvite?.toString() ?? null,
    awardedSupplier: rfq.awardedSupplier?.toString() ?? null,
    purchaseOrder: rfq.purchaseOrder?.toString() ?? null,
    awardedAt: rfq.awardedAt ?? null,
    notes: rfq.notes ?? null,
    timeline: (rfq.timeline ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at,
      note: entry.note ?? null,
    })),
    createdAt: rfq.createdAt,
    ...(items ? { products: items } : {}),
  };
}

/**
 * The portal's view: this supplier's own invite, and **nothing about any
 * other**. Rule 3 above, enforced by the serializer rather than by remembering
 * to filter at each call site.
 */
function shapeForSupplier(rfq, supplierId) {
  const invite = (rfq.invites ?? []).find(
    (candidate) => String(candidate.supplier?._id ?? candidate.supplier) === String(supplierId),
  );
  if (!invite) return null;

  const closed = Boolean(rfq.closesAt && new Date(rfq.closesAt) < new Date());

  return {
    id: rfq._id.toString(),
    rfqNumber: rfq.rfqNumber,
    title: rfq.title ?? null,
    // The supplier is told whether the request is still live, not what our
    // internal status is: `awarded` to somebody else reads as `closed` to them,
    // and `draft` is never visible because a draft is never sent.
    state: rfq.status === 'awarded'
      ? String(rfq.awardedInvite) === String(invite._id)
        ? 'won'
        : 'closed'
      : rfq.status === 'cancelled'
        ? 'cancelled'
        : closed
          ? 'closed'
          : 'open',
    items: (rfq.items ?? []).map((item) => ({
      sku: item.sku,
      name: item.name,
      partType: item.partType ?? null,
      qty: item.qty,
    })),
    myQuote: {
      status: invite.status,
      lines: (invite.lines ?? []).map((line) => ({
        sku: line.sku,
        unitCost: line.unitCost,
        available: line.available !== false,
        note: line.note ?? null,
      })),
      subtotal: invite.subtotal ?? 0,
      shipping: invite.shipping ?? 0,
      total: invite.total ?? 0,
      leadTimeDays: invite.leadTimeDays ?? null,
      validUntil: invite.validUntil ?? null,
      note: invite.note ?? null,
      quotedAt: invite.quotedAt ?? null,
    },
    closesAt: rfq.closesAt ?? null,
    closed,
    notes: rfq.notes ?? null,
    createdAt: rfq.createdAt,
  };
}

// ---- the supplier picker ----------------------------------------------------

/**
 * Active suppliers carrying any of these component types.
 *
 * With no component types this answers **nothing rather than everything**. An
 * empty filter meaning "all suppliers" would put a hundred rows in front of a
 * clerk who has not said what they are buying yet, which is the screen this
 * feature exists to replace.
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
    .select('name code email contactName componentTypes paymentTerms ordersCount totalSpent portalInviteAt')
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
      // tagged for batteries only, on a request covering batteries and screens,
      // is worth inviting — and worth showing as the partial match they are.
      matched: (supplier.componentTypes ?? []).filter((type) => types.includes(type)),
      paymentTerms: supplier.paymentTerms,
      ordersCount: supplier.ordersCount ?? 0,
      totalSpent: supplier.totalSpent ?? 0,
      // Whether they can actually answer online. A supplier with no portal
      // access can still be invited — the mail carries the line list — but the
      // screen should say so rather than let a clerk expect a quote that has
      // nowhere to be typed.
      hasPortal: Boolean(supplier.portalInviteAt),
    })),
  };
}

// ---- admin: create, send, cancel -------------------------------------------

async function listRfqs({ q, status, componentType } = {}) {
  const query = {};
  if (status && status !== 'all') query.status = status;
  if (componentType) query.componentTypes = componentType;
  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ rfqNumber: rx }, { title: rx }];
  }

  const [rfqs, counts] = await Promise.all([
    Rfq.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('invites.supplier', 'name email componentTypes')
      .lean(),
    Rfq.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const byStatus = Object.fromEntries(counts.map((row) => [row._id, row.count]));

  return {
    rfqs: rfqs.map((rfq) => shapeRfq(rfq)),
    counts: {
      all: counts.reduce((sum, row) => sum + row.count, 0),
      draft: byStatus.draft ?? 0,
      sent: byStatus.sent ?? 0,
      awarded: byStatus.awarded ?? 0,
      cancelled: byStatus.cancelled ?? 0,
    },
  };
}

async function getRfq(id) {
  if (!isObjectId(id)) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  const rfq = await Rfq.findById(id)
    .populate('invites.supplier', 'name email componentTypes')
    .lean();
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  return { rfq: shapeRfq(rfq) };
}

/**
 * Raise a request.
 *
 * The line list is resolved against live products the way a PO's is — a request
 * quoting a SKU that no longer exists is one whose answers cannot be turned
 * into an order. `partType` is snapshotted per line so the request still says
 * what was asked for after a product is recategorised.
 */
async function createRfq(body, createdBy) {
  const ids = (body.items ?? []).map((item) => item.product).filter(isObjectId);
  if (!ids.length) throw ApiError.badRequest('Add at least one part to the request.', 'RFQ_EMPTY');

  const products = await Product.find({ _id: { $in: ids } })
    .select('name sku partType')
    .lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  const items = body.items.map((item) => {
    const product = byId.get(String(item.product));
    if (!product) {
      throw ApiError.badRequest('One of those products no longer exists.', 'PRODUCT_NOT_FOUND');
    }
    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      partType: product.partType,
      qty: item.qty,
    };
  });

  const supplierIds = (body.suppliers ?? []).filter(isObjectId);
  const suppliers = supplierIds.length
    ? await Supplier.find({ _id: { $in: supplierIds }, isActive: true })
        .select('name email')
        .lean()
    : [];

  if (supplierIds.length && !suppliers.length) {
    throw ApiError.badRequest(
      'None of those suppliers are active any more.',
      'NO_ACTIVE_SUPPLIERS',
    );
  }

  const rfq = new Rfq({
    rfqNumber: await nextRfqNumber(),
    title: body.title,
    status: 'draft',
    // What the suppliers were chosen by, kept as sent rather than recomputed
    // from the lines — see the field's comment on the model.
    componentTypes: body.componentTypes ?? [],
    items,
    invites: suppliers.map((supplier) => ({
      supplier: supplier._id,
      supplierName: supplier.name,
      status: 'invited',
    })),
    closesAt: toDate(body.closesAt),
    notes: body.notes,
    createdBy,
    timeline: [{ status: 'draft', at: new Date(), note: 'Request created.' }],
  });

  await rfq.save();
  return getRfq(rfq._id);
}

/** Edits stop at `draft`, exactly as a PO's do: once suppliers are quoting, they
 *  are quoting a document this one would no longer match. */
async function updateRfq(id, body) {
  const rfq = await Rfq.findById(id);
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  if (rfq.status !== 'draft') {
    throw ApiError.badRequest(
      `${rfq.rfqNumber} has already gone out — cancel it and raise a new one rather than editing it.`,
      'RFQ_NOT_EDITABLE',
    );
  }

  const ids = (body.items ?? []).map((item) => item.product).filter(isObjectId);
  const products = await Product.find({ _id: { $in: ids } }).select('name sku partType').lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  rfq.title = body.title;
  rfq.componentTypes = body.componentTypes ?? [];
  rfq.closesAt = toDate(body.closesAt);
  rfq.notes = body.notes;
  rfq.items = body.items.map((item) => {
    const product = byId.get(String(item.product));
    if (!product) {
      throw ApiError.badRequest('One of those products no longer exists.', 'PRODUCT_NOT_FOUND');
    }
    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      partType: product.partType,
      qty: item.qty,
    };
  });

  const supplierIds = (body.suppliers ?? []).filter(isObjectId);
  const suppliers = await Supplier.find({ _id: { $in: supplierIds }, isActive: true })
    .select('name')
    .lean();

  // Invites are rebuilt from the list, keeping any that survive it — a draft has
  // no quotes yet, so nothing is lost, and rebuilding keeps the array in step
  // with what the form shows.
  const existing = new Map(rfq.invites.map((invite) => [String(invite.supplier), invite]));
  rfq.invites = suppliers.map(
    (supplier) =>
      existing.get(String(supplier._id)) ?? {
        supplier: supplier._id,
        supplierName: supplier.name,
        status: 'invited',
      },
  );

  await rfq.save();
  return getRfq(rfq._id);
}

/**
 * Send it.
 *
 * Mail per supplier, each one independent: a bad address on the fourth invite
 * must not stop the other five going out, and the response names who was
 * reached and who was not. Silently emailing five of six is how a purchasing
 * clerk waits a week for an answer from somebody who was never asked.
 */
async function sendRfq(id, { note } = {}) {
  const rfq = await Rfq.findById(id).populate('invites.supplier', 'name email isActive');
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  if (rfq.status === 'awarded') {
    throw ApiError.badRequest(`${rfq.rfqNumber} has already been awarded.`, 'RFQ_AWARDED');
  }
  if (rfq.status === 'cancelled') {
    throw ApiError.badRequest(`${rfq.rfqNumber} is cancelled.`, 'RFQ_CANCELLED');
  }
  if (!rfq.items.length) {
    throw ApiError.badRequest('Add a line before sending this request.', 'RFQ_EMPTY');
  }
  if (!rfq.invites.length) {
    throw ApiError.badRequest('Pick at least one supplier to ask.', 'RFQ_NO_SUPPLIERS');
  }

  const sent = [];
  const failed = [];

  for (const invite of rfq.invites) {
    // Already answered: re-sending would invite a supplier to quote twice, and
    // the second message reads as though the first was lost.
    if (['quoted', 'declined'].includes(invite.status)) continue;

    const supplier = invite.supplier;
    const mail = await sendRfqInvitation({ supplier, rfq });

    invite.sentAt = new Date();
    if (mail.delivered) sent.push(supplier.name);
    else failed.push({ supplier: supplier.name, reason: mail.error ?? 'Mail could not be sent.' });
  }

  rfq.status = 'sent';
  rfq.timeline.push({
    status: 'sent',
    at: new Date(),
    note: note ?? `Sent to ${rfq.invites.length} supplier(s).`,
  });
  await rfq.save();

  const { rfq: shaped } = await getRfq(rfq._id);
  return { rfq: shaped, sent, failed };
}

/** Ask one more supplier after the fact — a live request, not a new one. */
async function inviteSupplier(id, supplierId) {
  const rfq = await Rfq.findById(id);
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  if (['awarded', 'cancelled'].includes(rfq.status)) {
    throw ApiError.badRequest(`${rfq.rfqNumber} is closed.`, 'RFQ_CLOSED');
  }

  const supplier = await Supplier.findOne({ _id: supplierId, isActive: true })
    .select('name email')
    .lean();
  if (!supplier) throw ApiError.badRequest('That supplier is not active.', 'SUPPLIER_NOT_FOUND');

  if (rfq.invites.some((invite) => String(invite.supplier) === String(supplier._id))) {
    throw ApiError.badRequest(`${supplier.name} has already been asked.`, 'ALREADY_INVITED');
  }

  rfq.invites.push({
    supplier: supplier._id,
    supplierName: supplier.name,
    status: 'invited',
    sentAt: rfq.status === 'sent' ? new Date() : undefined,
  });

  // A live request mails immediately; a draft waits for `sendRfq` with the rest.
  let delivered = null;
  if (rfq.status === 'sent') {
    const mail = await sendRfqInvitation({ supplier, rfq });
    delivered = mail.delivered;
  }

  rfq.timeline.push({ status: rfq.status, at: new Date(), note: `${supplier.name} was asked.` });
  await rfq.save();

  const { rfq: shaped } = await getRfq(rfq._id);
  return { rfq: shaped, delivered };
}

async function cancelRfq(id, { note } = {}) {
  const rfq = await Rfq.findById(id);
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  if (rfq.status === 'awarded') {
    throw ApiError.badRequest(
      `${rfq.rfqNumber} has been awarded — the purchase order it raised is the thing to cancel.`,
      'RFQ_AWARDED',
    );
  }

  rfq.status = 'cancelled';
  rfq.timeline.push({ status: 'cancelled', at: new Date(), note });
  await rfq.save();

  return getRfq(rfq._id);
}

// ---- the portal side --------------------------------------------------------

/** Every request this supplier was asked to price. Never anyone else's. */
async function listForSupplier(supplierId) {
  const rfqs = await Rfq.find({
    'invites.supplier': supplierId,
    // A draft was never sent, so from the supplier's side it does not exist.
    status: { $ne: 'draft' },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return {
    rfqs: rfqs.map((rfq) => shapeForSupplier(rfq, supplierId)).filter(Boolean),
  };
}

/**
 * One request, from the supplier's side. Opening it records `viewed` — which is
 * genuinely useful on the comparison screen: a supplier who has not opened the
 * request is worth a phone call, and one who read it three days ago and has not
 * answered is a different conversation.
 */
async function getForSupplier(id, supplierId) {
  if (!isObjectId(id)) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  const rfq = await Rfq.findOne({ _id: id, 'invites.supplier': supplierId, status: { $ne: 'draft' } });
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  const invite = rfq.invites.find((candidate) => String(candidate.supplier) === String(supplierId));
  if (invite.status === 'invited') {
    invite.status = 'viewed';
    invite.viewedAt = new Date();
    await rfq.save();
  }

  return { rfq: shapeForSupplier(rfq.toObject(), supplierId) };
}

/**
 * A supplier prices the request.
 *
 * The one place in this codebase where a price arrives from a client and is
 * kept — that is what a quote is. What is still not accepted is a total: the
 * lines are matched against the request's SKUs (anything else is dropped rather
 * than stored, so a supplier cannot quietly add a line nobody asked for) and
 * every figure is recomputed.
 *
 * Re-submittable while the request is open. A supplier correcting a typo should
 * not have to ask us to reopen anything, and the timeline keeps the history.
 */
async function submitQuote(id, supplierId, body) {
  const rfq = await Rfq.findOne({ _id: id, 'invites.supplier': supplierId, status: { $ne: 'draft' } });
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  if (rfq.status === 'awarded') {
    throw ApiError.badRequest('This request has already been decided.', 'RFQ_AWARDED');
  }
  if (rfq.status === 'cancelled') {
    throw ApiError.badRequest('This request was withdrawn.', 'RFQ_CANCELLED');
  }
  if (rfq.closesAt && new Date(rfq.closesAt) < new Date()) {
    throw ApiError.badRequest('This request has closed.', 'RFQ_CLOSED');
  }

  const invite = rfq.invites.find((candidate) => String(candidate.supplier) === String(supplierId));
  const requested = new Map((rfq.items ?? []).map((item) => [item.sku, item.qty]));

  const lines = (body.lines ?? [])
    .filter((line) => requested.has(line.sku))
    .map((line) => ({
      sku: line.sku,
      unitCost: Math.max(0, Math.round(line.unitCost ?? 0)),
      available: line.available !== false,
      note: line.note,
    }));

  if (!lines.length) {
    throw ApiError.badRequest('Price at least one line before sending your quote.', 'QUOTE_EMPTY');
  }

  invite.lines = lines;
  invite.shipping = Math.max(0, Math.round(body.shipping ?? 0));
  invite.leadTimeDays = body.leadTimeDays;
  invite.validUntil = toDate(body.validUntil);
  invite.note = body.note;
  invite.status = 'quoted';
  invite.quotedAt = new Date();

  // Quantities come from the request, never from the supplier's payload — the
  // total being compared has to be for what we asked for.
  recomputeInvite(invite, requested);

  rfq.timeline.push({
    status: 'quoted',
    at: new Date(),
    note: `${invite.supplierName ?? 'A supplier'} sent a quote.`,
  });
  await rfq.save();

  await notificationService.emit({
    type: 'rfq_quoted',
    severity: 'info',
    title: `${invite.supplierName ?? 'A supplier'} quoted ${rfq.rfqNumber}`,
    detail: `${lines.length} line(s) priced · awaiting comparison`,
    entity: { kind: 'rfq', id: rfq._id.toString(), label: rfq.rfqNumber },
    href: `/admin/rfqs/${rfq._id}`,
  });

  return { rfq: shapeForSupplier(rfq.toObject(), supplierId) };
}

/** "We cannot supply this." A recorded no is worth far more than silence. */
async function declineQuote(id, supplierId, { reason } = {}) {
  const rfq = await Rfq.findOne({ _id: id, 'invites.supplier': supplierId, status: { $ne: 'draft' } });
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  if (['awarded', 'cancelled'].includes(rfq.status)) {
    throw ApiError.badRequest('This request is closed.', 'RFQ_CLOSED');
  }

  const invite = rfq.invites.find((candidate) => String(candidate.supplier) === String(supplierId));
  invite.status = 'declined';
  invite.declineReason = reason;
  invite.lines = [];
  invite.subtotal = 0;
  invite.total = 0;

  rfq.timeline.push({
    status: 'declined',
    at: new Date(),
    note: `${invite.supplierName ?? 'A supplier'} declined${reason ? ` — ${reason}` : ''}.`,
  });
  await rfq.save();

  return { rfq: shapeForSupplier(rfq.toObject(), supplierId) };
}

// ---- awarding ---------------------------------------------------------------

/**
 * Pick the winner, and raise the purchase order.
 *
 * **The PO is a normal purchase order** — same collection, same numbering, same
 * `sent` status a phoned-in order gets. Everything downstream therefore works
 * untouched: receiving increments stock through the ledger, recording a payment
 * writes the `Expense` row, and the supplier's spend totals refresh. Rule 4.
 *
 * Only lines the winner marked available are ordered. A supplier who could fill
 * nine of ten lines gets a PO for nine; the tenth is left unbought rather than
 * ordered from somebody who said they did not have it, and the response says
 * which lines were dropped so the clerk can raise a second request for them.
 */
async function awardRfq(id, { inviteId, expectedDate, note } = {}, createdBy) {
  const rfq = await Rfq.findById(id).populate('invites.supplier', 'name email');
  if (!rfq) throw ApiError.notFound('Request not found.', 'RFQ_NOT_FOUND');

  if (rfq.status === 'awarded') {
    throw ApiError.badRequest(`${rfq.rfqNumber} has already been awarded.`, 'RFQ_AWARDED');
  }
  if (rfq.status === 'cancelled') {
    throw ApiError.badRequest(`${rfq.rfqNumber} is cancelled.`, 'RFQ_CANCELLED');
  }

  const winner = rfq.invites.id(inviteId);
  if (!winner) throw ApiError.badRequest('That quote is not on this request.', 'INVITE_NOT_FOUND');
  if (winner.status !== 'quoted') {
    throw ApiError.badRequest(
      `${winner.supplierName ?? 'That supplier'} has not sent a price, so there is nothing to accept.`,
      'INVITE_NOT_QUOTED',
    );
  }

  const priced = new Map(
    (winner.lines ?? [])
      .filter((line) => line.available !== false)
      .map((line) => [line.sku, line.unitCost]),
  );

  const items = [];
  const dropped = [];
  for (const item of rfq.items) {
    if (!priced.has(item.sku)) {
      dropped.push({ sku: item.sku, name: item.name, reason: 'The supplier could not supply it.' });
      continue;
    }
    const unitCost = priced.get(item.sku);
    items.push({
      product: item.product,
      sku: item.sku,
      name: item.name,
      qtyOrdered: item.qty,
      qtyReceived: 0,
      unitCost,
      lineTotal: item.qty * unitCost,
    });
  }

  if (!items.length) {
    throw ApiError.badRequest(
      'That quote has no available lines, so there is nothing to order.',
      'QUOTE_NOTHING_AVAILABLE',
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = winner.shipping ?? 0;

  const po = new PurchaseOrder({
    poNumber: await nextPoNumber(),
    supplier: winner.supplier._id ?? winner.supplier,
    // Sent, not draft: the supplier quoted it and has been told they won, so a
    // draft would describe a state that never existed.
    status: 'sent',
    orderDate: new Date(),
    expectedDate:
      toDate(expectedDate) ??
      // Their own lead time, when they gave one. A date derived from what the
      // supplier promised beats an operator guessing a week.
      (winner.leadTimeDays != null
        ? new Date(Date.now() + winner.leadTimeDays * 24 * 60 * 60 * 1000)
        : undefined),
    items,
    tax: 0,
    shipping,
    subtotal,
    total: subtotal + shipping,
    notes: `Awarded from ${rfq.rfqNumber}.${note ? ` ${note}` : ''}`,
    createdBy,
    timeline: [
      { status: 'draft', at: new Date(), note: `Raised from request ${rfq.rfqNumber}.` },
      { status: 'sent', at: new Date(), note: 'Quote accepted.' },
    ],
  });
  await po.save();

  winner.status = 'won';
  rfq.invites.forEach((invite) => {
    if (String(invite._id) !== String(winner._id) && invite.status === 'quoted') {
      invite.status = 'lost';
    }
  });

  rfq.status = 'awarded';
  rfq.awardedInvite = winner._id;
  rfq.awardedSupplier = winner.supplier._id ?? winner.supplier;
  rfq.purchaseOrder = po._id;
  rfq.awardedAt = new Date();
  rfq.timeline.push({
    status: 'awarded',
    at: new Date(),
    note: `${winner.supplierName ?? 'A supplier'} won — ${po.poNumber} raised.`,
  });
  await rfq.save();

  // The supplier's denormalised totals now include this order. Recomputed
  // rather than incremented, for the reason `purchaseService` gives.
  await refreshSupplierTotals(rfq.awardedSupplier);

  // Everybody who priced it is told the outcome, winner and losers alike — a
  // supplier who quotes and hears nothing stops answering. Fire-and-forget:
  // the award is already written, and a dead mail server must not undo it.
  for (const invite of rfq.invites) {
    if (!['won', 'lost'].includes(invite.status)) continue;
    sendRfqOutcome({
      supplier: invite.supplier,
      rfq,
      won: invite.status === 'won',
      poNumber: invite.status === 'won' ? po.poNumber : null,
    }).catch(() => {});
  }

  const { rfq: shaped } = await getRfq(rfq._id);
  return { rfq: shaped, purchaseOrder: { id: po._id.toString(), poNumber: po.poNumber }, dropped };
}

/**
 * Recompute a supplier's order count and spend.
 *
 * The same rule `purchaseService.refreshSupplierTotals` holds — drafts and
 * cancellations are not money — recomputed from the purchase orders rather than
 * incremented, so a double award or a later correction cannot leave the cache
 * permanently wrong.
 */
async function refreshSupplierTotals(supplierId) {
  const [row] = await PurchaseOrder.aggregate([
    {
      $match: {
        supplier: new mongoose.Types.ObjectId(String(supplierId)),
        status: { $nin: ['draft', 'cancelled'] },
      },
    },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } },
  ]);

  await Supplier.findByIdAndUpdate(supplierId, {
    ordersCount: row?.count ?? 0,
    totalSpent: row?.total ?? 0,
  });
}

export default {
  awardRfq,
  cancelRfq,
  createRfq,
  declineQuote,
  getForSupplier,
  getRfq,
  inviteSupplier,
  listForSupplier,
  listRfqs,
  sendRfq,
  submitQuote,
  suppliersForComponentTypes,
  updateRfq,
};
