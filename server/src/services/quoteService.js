const mongoose = require('mongoose');

const { default: Quote } = require('../models/Quote.js');
const { default: Product } = require('../models/Product.js');
const { default: User } = require('../models/User.js');
const { default: Settings } = require('../models/Settings.js');
const { default: ApiError } = require('../utils/ApiError.js');
const { likeRegex } = require('../utils/regex.js');
const notificationService = require('./notificationService.js');
const orderBuilder = require('./orderBuilder.js');

/**
 * Quotes (ERP rework §6.6, phase 7).
 *
 * A quote is the one document in this system where **the price comes from the
 * admin rather than the catalogue** — that is what a quote is: a negotiated
 * number, held for a period. Everything computed *from* that number is still
 * the server's (invariant 8), and conversion re-reads the catalogue before it
 * writes an order.
 *
 * Two rules shape the whole file:
 *
 *   1. **Expiry is derived, not stored.** A quote is expired because its date
 *      has passed, exactly as an invoice is overdue. Writing `expired` to a
 *      column would mean a nightly job whose only purpose is keeping the column
 *      honest — and a quote that expired an hour ago would still read as live
 *      until that job ran.
 *   2. **Conversion never trusts the quote silently.** Prices are re-read from
 *      live products and any difference is *reported to the admin*, not applied
 *      behind their back and not ignored. A quote is a promise; honouring it
 *      knowingly is a decision, honouring it accidentally is a bug.
 */

// ---- helpers ----------------------------------------------------------------

async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;
  const last = await Quote.findOne({ quoteNumber: new RegExp(`^${prefix}`) })
    .sort({ quoteNumber: -1 })
    .select('quoteNumber')
    .lean();

  const sequence = last ? Number(last.quoteNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(5, '0')}`;
}

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

/**
 * Expired is a reading of the date, never a stored value — but only for a quote
 * that is still live. A quote already `accepted` or `converted` does not become
 * expired by the passage of time; the deal was done inside the window.
 */
function isExpired(quote) {
  if (!quote.validUntil) return false;
  if (!['draft', 'sent'].includes(quote.status)) return false;
  return new Date(quote.validUntil) < new Date();
}

function shapeQuote(quote) {
  const expired = isExpired(quote);

  return {
    id: quote._id.toString(),
    quoteNumber: quote.quoteNumber,
    source: quote.source,
    user: quote.user?.businessName
      ? {
          id: quote.user._id.toString(),
          businessName: quote.user.businessName,
          contactName: quote.user.contactName ?? null,
          email: quote.user.email ?? null,
        }
      : { id: quote.user?.toString() ?? null, businessName: '—', contactName: null, email: null },
    status: expired ? 'expired' : quote.status,
    // Kept alongside the derived status so a screen can say "expired, and it
    // was sent" rather than losing which rung it reached.
    storedStatus: quote.status,
    expired,
    items: (quote.items ?? []).map((item) => ({
      product: item.product?.toString() ?? null,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      unitCost: item.unitCost ?? null,
    })),
    itemCount: (quote.items ?? []).length,
    subtotal: quote.subtotal ?? 0,
    tax: quote.tax ?? 0,
    shipping: quote.shipping ?? 0,
    total: quote.total ?? 0,
    validUntil: quote.validUntil ?? null,
    notes: quote.notes ?? null,
    convertedOrder: quote.convertedOrder
      ? {
          id: (quote.convertedOrder._id ?? quote.convertedOrder).toString(),
          orderNumber: quote.convertedOrder.orderNumber ?? null,
        }
      : null,
    timeline: (quote.timeline ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at,
      note: entry.note ?? null,
    })),
    createdAt: quote.createdAt,
  };
}

/**
 * Totals from the lines, at the buyer's own provincial rate.
 *
 * The rate comes from `Settings` rather than a constant (§9.5) — Cellvix ships
 * Canada-wide, and quoting Ontario's HST to an Alberta business overstates the
 * total by eight points.
 */
function recomputeTotals(quote, rate) {
  quote.items.forEach((item) => {
    item.lineTotal = item.qty * item.unitPrice;
  });
  quote.subtotal = quote.items.reduce((sum, item) => sum + item.lineTotal, 0);
  quote.tax = Math.round((quote.subtotal + (quote.shipping ?? 0)) * rate);
  quote.total = quote.subtotal + (quote.shipping ?? 0) + quote.tax;
  return quote;
}

/** The province a quote is taxed at: the buyer's default shipping address. */
function provinceFor(user) {
  const preferred = (user.addresses ?? []).find((address) => address.isDefaultShipping);
  return preferred?.region ?? user.addresses?.[0]?.region ?? user.region ?? 'ON';
}

// ---- read -------------------------------------------------------------------

async function listQuotes({ q, status, from, to } = {}) {
  const now = new Date();
  const query = {};

  if (status === 'expired') {
    // Derived, so the filter is the same reading the shaper does: still live,
    // and past its date.
    query.status = { $in: ['draft', 'sent'] };
    query.validUntil = { $lt: now };
  } else if (status && status !== 'all') {
    query.status = String(status);
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = toDate(from);
    if (to) query.createdAt.$lte = endOfDay(to);
  }

  if (q) {
    const rx = likeRegex(q);
    const users = await User.find({ $or: [{ businessName: rx }, { email: rx }] })
      .select('_id')
      .lean();
    query.$or = [{ quoteNumber: rx }, { user: { $in: users.map((user) => user._id) } }];
  }

  const quotes = await Quote.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('user', 'businessName contactName email')
    .populate('convertedOrder', 'orderNumber')
    .lean();

  // Counts come from the whole collection, not the filtered set — a pill
  // reading "Expired 0" because you are filtered to Accepted is useless.
  const [statusRows, expiredCount] = await Promise.all([
    Quote.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Quote.countDocuments({ status: { $in: ['draft', 'sent'] }, validUntil: { $lt: now } }),
  ]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.expired = expiredCount;
  counts.all = statusRows.reduce((sum, row) => sum + row.count, 0);

  const shaped = quotes.map(shapeQuote);

  return {
    quotes: shaped,
    counts,
    totals: {
      value: shaped.reduce((sum, quote) => sum + quote.total, 0),
      // Only what is still winnable — a converted or rejected quote is not
      // pipeline, and counting it would flatter the number.
      open: shaped
        .filter((quote) => ['draft', 'sent'].includes(quote.storedStatus) && !quote.expired)
        .reduce((sum, quote) => sum + quote.total, 0),
    },
  };
}

async function getQuote(id) {
  const query = isObjectId(id) ? { _id: id } : { quoteNumber: String(id) };
  const quote = await Quote.findOne(query)
    .populate('user', 'businessName contactName email phone addresses terms')
    .populate('convertedOrder', 'orderNumber')
    .lean();

  if (!quote) throw ApiError.notFound('Quote not found.', 'QUOTE_NOT_FOUND');

  // The live comparison, shown while the quote is still open so an operator can
  // see the catalogue moving under a promise they have made.
  const drift = await priceDrift(quote);

  return { quote: shapeQuote(quote), drift };
}

/**
 * What the quote promised versus what the catalogue says today.
 *
 * Computed on read as well as at conversion, because the useful moment to learn
 * a quoted price is now below cost is *while it is still open*, not at the
 * instant somebody accepts it.
 */
async function priceDrift(quote) {
  const ids = (quote.items ?? []).map((item) => item.product).filter(Boolean);
  if (!ids.length) return { lines: [], hasDrift: false, quotedTotal: 0, liveTotal: 0 };

  const products = await Product.find({ _id: { $in: ids } })
    .select('price cost stock isActive name sku')
    .lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  let quotedTotal = 0;
  let liveTotal = 0;

  const lines = (quote.items ?? []).map((item) => {
    const product = byId.get(String(item.product));
    const livePrice = product?.price ?? null;

    quotedTotal += item.lineTotal;
    liveTotal += (livePrice ?? item.unitPrice) * item.qty;

    return {
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      quotedPrice: item.unitPrice,
      livePrice,
      difference: livePrice === null ? null : item.unitPrice - livePrice,
      // A quoted price under today's cost is the one an operator most needs to
      // see — it is a sale that loses money at the moment it converts.
      belowCost: product?.cost > 0 ? item.unitPrice < product.cost : false,
      unavailable: !product || !product.isActive,
      shortStock: product ? item.qty > product.stock : false,
    };
  });

  return {
    lines,
    hasDrift: lines.some((line) => line.difference !== null && line.difference !== 0),
    hasBlockers: lines.some((line) => line.unavailable || line.shortStock),
    quotedTotal,
    liveTotal,
  };
}

// ---- write ------------------------------------------------------------------

async function buildItems(rawItems) {
  const ids = rawItems.map((item) => item.product).filter(isObjectId);
  const products = await Product.find({ _id: { $in: ids } })
    .select('sku name price cost')
    .lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  return rawItems.map((item) => {
    const product = byId.get(String(item.product));
    if (!product) {
      throw ApiError.badRequest('One of those products no longer exists.', 'PRODUCT_NOT_FOUND');
    }

    // The admin's price wins when they set one; otherwise the catalogue's is
    // the starting point. Either way the line total is arithmetic done here.
    const unitPrice = item.unitPrice > 0 ? item.unitPrice : product.price;

    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      qty: item.qty,
      unitPrice,
      lineTotal: item.qty * unitPrice,
      // Snapshotted so a margin can be shown while negotiating (§9.4).
      unitCost: product.cost > 0 ? product.cost : undefined,
    };
  });
}

async function createQuote(body, createdBy) {
  const user = await User.findById(body.user).lean();
  if (!user) throw ApiError.badRequest('Pick a client.', 'USER_NOT_FOUND');

  const settings = await Settings.load();
  const rate = Settings.rateFor(settings, provinceFor(user));

  const quote = new Quote({
    quoteNumber: await nextQuoteNumber(),
    user: user._id,
    source: 'admin',
    status: 'draft',
    items: await buildItems(body.items),
    shipping: body.shipping ?? 0,
    validUntil: toDate(body.validUntil),
    notes: body.notes,
    createdBy,
    timeline: [{ status: 'draft', at: new Date(), note: 'Quote created.' }],
  });

  recomputeTotals(quote, rate);
  await quote.save();

  return getQuote(quote._id.toString());
}

/** Edits stop once a quote has been accepted — the client agreed to a number. */
async function updateQuote(id, body) {
  const query = isObjectId(id) ? { _id: id } : { quoteNumber: String(id) };
  const quote = await Quote.findOne(query);
  if (!quote) throw ApiError.notFound('Quote not found.', 'QUOTE_NOT_FOUND');

  if (!['draft', 'sent'].includes(quote.status)) {
    throw ApiError.badRequest(
      `${quote.quoteNumber} is ${quote.status} — raise a new quote rather than editing this one.`,
      'QUOTE_NOT_EDITABLE',
    );
  }

  const user = await User.findById(body.user ?? quote.user).lean();
  if (!user) throw ApiError.badRequest('Pick a client.', 'USER_NOT_FOUND');

  const settings = await Settings.load();
  const rate = Settings.rateFor(settings, provinceFor(user));

  quote.user = user._id;
  quote.items = await buildItems(body.items);
  quote.shipping = body.shipping ?? 0;
  quote.validUntil = toDate(body.validUntil);
  quote.notes = body.notes;

  recomputeTotals(quote, rate);
  await quote.save();

  return getQuote(quote._id.toString());
}

/**
 * The status ladder an operator drives: send it, record the answer, or reject.
 *
 * `converted` is not here — that status is written by `convertQuote` and only
 * ever as the result of an order actually being created. A status that can be
 * set by hand is a status that can lie about whether an order exists.
 */
const ALLOWED_TRANSITIONS = {
  draft: ['sent', 'rejected'],
  sent: ['accepted', 'rejected'],
  accepted: ['rejected'],
  expired: [],
  converted: [],
  rejected: [],
};

async function setQuoteStatus(id, { status, note }) {
  const query = isObjectId(id) ? { _id: id } : { quoteNumber: String(id) };
  const quote = await Quote.findOne(query);
  if (!quote) throw ApiError.notFound('Quote not found.', 'QUOTE_NOT_FOUND');

  const allowed = ALLOWED_TRANSITIONS[quote.status] ?? [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `A ${quote.status} quote cannot become ${status}.`,
      'QUOTE_TRANSITION_INVALID',
    );
  }

  // Accepting an expired quote is a decision, not an accident: the operator is
  // choosing to honour a price that has lapsed, so it is refused here and the
  // date has to be extended first. That leaves a record of the extension.
  if (status === 'accepted' && isExpired(quote)) {
    throw ApiError.badRequest(
      `${quote.quoteNumber} expired on ${new Date(quote.validUntil).toLocaleDateString('en-CA')} — extend its expiry before accepting it.`,
      'QUOTE_EXPIRED',
    );
  }

  quote.status = status;
  quote.timeline.push({ status, at: new Date(), note });
  await quote.save();

  // Only acceptance rings the bell (§7.3 names "new quote accepted", not every
  // transition). A quote moving to `sent` or `rejected` was done by the person
  // who would be reading the notification, and a bell that reports your own
  // clicks back to you is one people stop looking at.
  if (status === 'accepted') {
    await notificationService.emit({
      type: 'quote_accepted',
      severity: 'success',
      title: `Quote ${quote.quoteNumber} accepted`,
      detail: `Ready to convert to an order · ${formatCad(quote.total)}`,
      entity: { kind: 'quote', id: quote._id.toString(), label: quote.quoteNumber },
      href: `/admin/quotes/${quote._id}`,
    });
  }

  return getQuote(quote._id.toString());
}

/** Cents to `$1,234.56`, for notification copy. */
function formatCad(cents) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    (cents ?? 0) / 100,
  );
}

/**
 * Accept → convert: writes a real `Order` (§6.6).
 *
 * **The quote's stored prices are honoured only while the quote is valid, and
 * any difference is surfaced before the order is written.** That is the spec's
 * sentence and it is implemented literally:
 *
 *   - the catalogue is re-read, and a line whose product has vanished, gone
 *     inactive or fallen short of stock **blocks** the conversion outright;
 *   - a price that has moved does not block, but the caller must have seen it:
 *     `acknowledgeDrift` has to be true, and without it the response tells the
 *     admin exactly what changed and refuses;
 *   - taxes and totals are recomputed from the lines at the buyer's provincial
 *     rate, never copied across from the quote.
 *
 * Stock is decremented in one bulk write, as order placement does.
 */
async function convertQuote(id, { acknowledgeDrift = false, deliveryCode } = {}, adminId) {
  const query = isObjectId(id) ? { _id: id } : { quoteNumber: String(id) };
  const quote = await Quote.findOne(query).populate('user');
  if (!quote) throw ApiError.notFound('Quote not found.', 'QUOTE_NOT_FOUND');

  if (quote.status === 'converted') {
    throw ApiError.badRequest(
      `${quote.quoteNumber} has already been converted.`,
      'QUOTE_ALREADY_CONVERTED',
    );
  }
  if (quote.status !== 'accepted') {
    throw ApiError.badRequest(
      `${quote.quoteNumber} has to be accepted before it becomes an order.`,
      'QUOTE_NOT_ACCEPTED',
    );
  }
  if (isExpired(quote)) {
    throw ApiError.badRequest(
      `${quote.quoteNumber} has expired — extend its expiry before converting it.`,
      'QUOTE_EXPIRED',
    );
  }

  const user = quote.user;
  if (!user) throw ApiError.badRequest('That client no longer exists.', 'USER_NOT_FOUND');
  if (user.status !== 'approved') {
    // Ordering needs approval — a quote does not get to bypass the gate that
    // every other order goes through.
    throw ApiError.badRequest(
      `${user.businessName} is not approved to order yet.`,
      'USER_NOT_APPROVED',
    );
  }

  const drift = await priceDrift(quote.toObject());

  if (drift.hasBlockers) {
    const blocked = drift.lines.filter((line) => line.unavailable || line.shortStock);
    throw ApiError.badRequest(
      `This quote cannot be converted: ${blocked
        .map((line) => `${line.sku} ${line.unavailable ? 'is no longer available' : 'is short of stock'}`)
        .join('; ')}.`,
      'QUOTE_NOT_CONVERTIBLE',
    );
  }

  if (drift.hasDrift && !acknowledgeDrift) {
    // Not an error the operator can only retry past: the comparison rides along
    // in `fields` so the UI can show exactly which prices moved and ask for a
    // decision, rather than saying "something changed" and leaving them to
    // guess. Retrying with `acknowledgeDrift` is that decision.
    const error = ApiError.conflict(
      'Catalogue prices have changed since this quote was issued. Review the differences before converting.',
      'QUOTE_PRICE_DRIFT',
    );
    error.fields = { drift };
    throw error;
  }

  // The quoted prices are what binds — that is the promise, and it is the one
  // thing `orderBuilder` does not decide for itself. Everything computed *from*
  // them is still recomputed there rather than copied off the quote.
  const items = quote.items.map((item) => ({
    product: item.product,
    sku: item.sku,
    name: item.name,
    qty: item.qty,
    unitPrice: item.unitPrice,
    lineTotal: item.qty * item.unitPrice,
    unitCost: item.unitCost,
  }));

  // Everything from here — the approval gate, the address, the stock re-check,
  // the totals, the order, the invoice and the bell — is `orderBuilder`'s, and
  // is the same code `adminService.createOrder` runs.
  const { order, invoice } = await orderBuilder.raiseOrder({
    user,
    items,
    shipping: quote.shipping ?? 0,
    deliveryCode: deliveryCode ?? 'ground',
    note: `Converted from quote ${quote.quoteNumber}.`,
  });

  const { orderNumber, total } = order;

  quote.status = 'converted';
  quote.convertedOrder = order._id;
  quote.timeline.push({
    status: 'converted',
    at: new Date(),
    note: `Converted to ${orderNumber}${drift.hasDrift ? ' — quoted prices honoured over changed catalogue prices.' : ''}`,
  });
  await quote.save();

  return {
    quote: shapeQuote(quote.toObject()),
    order: { id: order._id.toString(), orderNumber, total },
    invoice: { number: invoice.number, dueDate: invoice.dueDate },
    drift,
  };
}


async function deleteQuote(id) {
  const query = isObjectId(id) ? { _id: id } : { quoteNumber: String(id) };
  const quote = await Quote.findOne(query);
  if (!quote) throw ApiError.notFound('Quote not found.', 'QUOTE_NOT_FOUND');

  if (quote.status === 'converted') {
    throw ApiError.badRequest(
      `${quote.quoteNumber} became an order — deleting it would orphan that order's history.`,
      'QUOTE_CONVERTED',
    );
  }

  await quote.deleteOne();
  return { ok: true };
}

// --- CommonJS exports -------------------------------------------------
exports.listQuotes = listQuotes;
exports.getQuote = getQuote;
exports.createQuote = createQuote;
exports.updateQuote = updateQuote;
exports.setQuoteStatus = setQuoteStatus;
exports.convertQuote = convertQuote;
exports.deleteQuote = deleteQuote;
