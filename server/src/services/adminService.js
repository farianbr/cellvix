import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import CreditTransaction from '../models/CreditTransaction.js';
import Rma, { RMA_OPEN_STATUSES } from '../models/Rma.js';
import Taxonomy from '../models/Taxonomy.js';
import ApiError from '../utils/ApiError.js';
import * as storeCredit from './storeCreditService.js';
import * as referralService from './referralService.js';
import { likeRegex } from '../utils/regex.js';
import { serializeOrder } from './orderService.js';
import { renderInvoiceHtml } from './invoiceDocument.js';
import { invalidateTree } from './taxonomyService.js';
import { ORDER_STATUS_FLOW } from '../../../shared/schemas/admin.js';

const LOW_STOCK_THRESHOLD = 50;

/**
 * Resolve the dashboard's date range.
 *
 * `from` and `to` are inclusive whole days in `YYYY-MM-DD`. `to` is pushed to
 * the end of its day here, on the server, so a range of "today to today" is a
 * real twenty-four hours rather than an empty instant — the client sends dates,
 * not timestamps, and only one side should own that rule.
 *
 * Defaults to the last thirty days, which is what the endpoint returned before
 * it took a range at all.
 */
function resolveRange({ from, to } = {}) {
  const now = new Date();

  const end = to ? new Date(`${to}T00:00:00`) : now;
  if (to) end.setHours(23, 59, 59, 999);

  const start = from
    ? new Date(`${from}T00:00:00`)
    : new Date(now.getTime() - 30 * 86_400_000);

  // A backwards range is a typo, not an intent. Swap rather than return
  // nothing, because an empty dashboard reads as "no business" and is a lie.
  if (start > end) return { start: end, end: start };
  return { start, end };
}

/** Bucket size that keeps a trend readable: daily up to ~10 weeks, then weekly. */
function bucketFor(start, end) {
  const days = Math.max(1, Math.round((end - start) / 86_400_000));
  return days > 70 ? 'week' : 'day';
}

/**
 * Both units label by their first day: `Aug 27`. A week reads as its Monday.
 *
 * The year is appended only when the range spans more than one, because a
 * weekly walk snaps back to Monday and can start in the previous December —
 * `Dec 29 → Dec 28` for a calendar year is correct but reads as nonsense
 * without it.
 */
function bucketLabel(date, withYear) {
  return date.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/**
 * Fill every bucket in the range, including the empty ones.
 *
 * A trend drawn only from days that had orders compresses a quiet week into a
 * single point and makes the line lie about its own shape.
 */
function fillBuckets(rows, start, end, unit) {
  const byKey = new Map(rows.map((row) => [row._id, row]));
  const points = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  if (unit === 'week') {
    // Monday-first, matching DateRangeBar's presets on the client.
    const day = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - day);
  }

  // Snapping to Monday can pull the first bucket into the previous year, so the
  // check happens after the snap rather than on the requested range.
  const withYear = cursor.getFullYear() !== end.getFullYear();

  let guard = 0;
  while (cursor <= end && guard < 400) {
    guard += 1;
    const key =
      unit === 'week'
        ? `${cursor.getFullYear()}-W${String(isoWeek(cursor)).padStart(2, '0')}`
        : cursor.toISOString().slice(0, 10);

    points.push({
      label: bucketLabel(cursor, withYear),
      value: byKey.get(key)?.total ?? 0,
      count: byKey.get(key)?.count ?? 0,
    });

    cursor.setDate(cursor.getDate() + (unit === 'week' ? 7 : 1));
  }

  return points;
}

function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86_400_000 + 1) / 7);
}

/**
 * Admin home: what needs attention today, not vanity metrics.
 *
 * **Two named money metrics, never one word** (ERP rework §9.1). `invoiced` is
 * the value of invoices issued in the range, by invoice date; `collected` is
 * payments actually received in the range, by payment date. They are different
 * numbers and the UI says which is which.
 *
 * **Refunds are their own line** (§9.2) — never a negative pushed into a
 * revenue figure.
 *
 * Today's response shape is preserved as a subset, so every existing consumer
 * keeps working while the new dashboard reads the richer fields.
 */
export async function stats({ from, to } = {}) {
  const now = new Date();
  const { start, end } = resolveRange({ from, to });
  const unit = bucketFor(start, end);

  // The immediately preceding window of the same length, for the delta.
  const span = end - start;
  const priorStart = new Date(start.getTime() - span);

  const inRange = { $gte: start, $lte: end };

  const [
    pendingUsers,
    approvedUsers,
    totalClients,
    openOrders,
    awaitingFulfilment,
    revenueRows,
    invoicedRows,
    collectedRows,
    priorCollectedRows,
    refundRows,
    outstandingRows,
    overdueCount,
    lowStock,
    outOfStock,
    productCount,
    inventoryValueRows,
    trendRows,
    topClientRows,
    recentOrders,
    pendingQueue,
    lowStockItems,
    openRmas,
  ] = await Promise.all([
    User.countDocuments({ status: 'pending' }),
    User.countDocuments({ status: 'approved', role: 'buyer' }),
    User.countDocuments({ role: 'buyer' }),

    Order.countDocuments({
      status: { $in: ['placed', 'processing', 'shipped', 'out_for_delivery'] },
    }),
    Order.countDocuments({ status: { $in: ['placed', 'processing'] } }),

    // Order value in range. Kept for `revenue.last30Days`, which the old shape
    // promised and other screens may still read.
    Order.aggregate([
      { $match: { createdAt: inRange, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),

    // Invoiced: by invoice date.
    Invoice.aggregate([
      { $match: { issuedAt: inRange } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Collected: by payment date, which is a different question and usually a
    // different number.
    Invoice.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.at': inRange } },
      { $group: { _id: null, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
    ]),

    Invoice.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.at': { $gte: priorStart, $lt: start } } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } },
    ]),

    // Refunds get their own tile and never push revenue negative (§9.2).
    //
    // Sourced from the credit ledger, not from `Order.refundedTotal`: an order
    // carries a running total with no date of its own, so dating it by
    // `updatedAt` would move a June refund into August the moment somebody
    // edited that order's status. Every refund posts a ledger row with its own
    // timestamp, and that is the honest date.
    CreditTransaction.aggregate([
      { $match: { type: 'refund', createdAt: inRange } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Receivables are a position, not a flow — always "as of now", never
    // filtered by the range, or the number stops meaning what it says.
    Invoice.aggregate([
      { $match: { status: { $ne: 'paid' } } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: { $subtract: ['$amount', '$amountPaid'] } },
          overdue: {
            $sum: {
              $cond: [{ $lt: ['$dueDate', now] }, { $subtract: ['$amount', '$amountPaid'] }, 0],
            },
          },
        },
      },
    ]),
    Invoice.countDocuments({ status: { $ne: 'paid' }, dueDate: { $lt: now } }),

    Product.countDocuments({ isActive: true, stock: { $gt: 0, $lt: LOW_STOCK_THRESHOLD } }),
    Product.countDocuments({ isActive: true, stock: 0 }),
    Product.countDocuments({ isActive: true }),

    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, value: { $sum: { $multiply: ['$stock', '$price'] } } } },
    ]),

    Order.aggregate([
      { $match: { createdAt: inRange, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id:
            unit === 'week'
              ? {
                  $concat: [
                    { $toString: { $isoWeekYear: '$createdAt' } },
                    '-W',
                    {
                      $cond: [
                        { $lt: [{ $isoWeek: '$createdAt' }, 10] },
                        { $concat: ['0', { $toString: { $isoWeek: '$createdAt' } }] },
                        { $toString: { $isoWeek: '$createdAt' } },
                      ],
                    },
                  ],
                }
              : { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
    ]),

    // Top clients by invoiced value in range.
    Invoice.aggregate([
      { $match: { issuedAt: inRange } },
      { $group: { _id: '$user', total: { $sum: '$amount' }, invoices: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'client' },
      },
      { $unwind: '$client' },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          businessName: '$client.businessName',
          total: 1,
          invoices: 1,
        },
      },
    ]),

    Order.find({}).sort({ createdAt: -1 }).limit(6).populate('user', 'businessName').lean(),
    User.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(5).lean(),

    Product.find({ isActive: true, stock: { $lt: LOW_STOCK_THRESHOLD } })
      .sort({ stock: 1 })
      .limit(6)
      .select('name sku stock price')
      .lean(),

    // Returns still needing attention. Deliberately unranged like the other
    // badge counters — a badge that moved when you changed the dashboard's
    // dates would be nonsense.
    Rma.countDocuments({ status: { $in: RMA_OPEN_STATUSES } }),
  ]);

  const collected = collectedRows[0]?.total ?? 0;
  const priorCollected = priorCollectedRows[0]?.total ?? 0;

  return {
    // The range the server actually used, echoed back so the UI can label the
    // period without re-deriving it and disagreeing.
    range: { from: start.toISOString(), to: end.toISOString(), bucket: unit },

    users: { pending: pendingUsers, approved: approvedUsers, total: totalClients },
    orders: {
      open: openOrders,
      awaitingFulfilment,
      last30Days: revenueRows[0]?.count ?? 0,
      inRange: revenueRows[0]?.count ?? 0,
    },

    revenue: {
      // Order value in range. `last30Days` is the old key and only means "last
      // thirty days" when no range was asked for; the new screens read
      // `orderValue`.
      last30Days: revenueRows[0]?.total ?? 0,
      orderValue: revenueRows[0]?.total ?? 0,
    },

    invoiced: { total: invoicedRows[0]?.total ?? 0, count: invoicedRows[0]?.count ?? 0 },
    collected: {
      total: collected,
      count: collectedRows[0]?.count ?? 0,
      // Percentage change against the preceding window of the same length.
      // Null rather than 0 when there is nothing to compare to — "no change"
      // and "no prior data" are different claims.
      deltaPercent: priorCollected > 0 ? ((collected - priorCollected) / priorCollected) * 100 : null,
    },
    refunds: { total: refundRows[0]?.total ?? 0, count: refundRows[0]?.count ?? 0 },

    receivables: {
      outstanding: outstandingRows[0]?.outstanding ?? 0,
      overdue: outstandingRows[0]?.overdue ?? 0,
      overdueCount,
    },

    inventory: {
      total: productCount,
      lowStock,
      outOfStock,
      value: inventoryValueRows[0]?.value ?? 0,
    },

    // The sidebar badge reads this by name. Open means every rung before
    // resolved or rejected — a return still needing somebody's attention.
    rma: { open: openRmas },

    trend: fillBuckets(trendRows, start, end, unit),
    topClients: topClientRows,

    recentOrders: recentOrders.map((order) => ({
      ...serializeOrder(order),
      businessName: order.user?.businessName ?? '—',
    })),
    pendingQueue: pendingQueue.map(shapeUser),
    lowStockItems: lowStockItems.map((product) => ({
      id: product._id.toString(),
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      price: product.price,
    })),
  };
}

// ---- customers --------------------------------------------------------------

function shapeUser(user) {
  return {
    id: user._id.toString(),
    businessName: user.businessName,
    contactName: user.contactName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: user.role,
    businessType: user.businessType,
    website: user.website,
    taxId: user.taxId,
    creditLimit: user.creditLimit ?? 0,
    balance: user.balance ?? 0,
    storeCredit: user.storeCredit ?? 0,
    terms: user.terms,
    addresses: user.addresses ?? [],
    accountRep: user.accountRep ?? null,
    rejectionReason: user.rejectionReason,
    approvedAt: user.approvedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    // Referral (§6.13). The code is what an operator reads out to a customer
    // who asks how to refer somebody; `referredBy` is read-only everywhere,
    // because attribution is set once at registration and never edited.
    referralCode: user.referralCode ?? null,
    referredBy: user.referredBy ? String(user.referredBy) : null,
  };
}

export async function listUsers({ status, q } = {}) {
  const query = { role: 'buyer' };
  if (status && status !== 'all') query.status = String(status);

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ businessName: rx }, { contactName: rx }, { email: rx }];
  }

  // Pending first — the approvals queue is the point of this screen.
  const users = await User.find(query).sort({ status: 1, createdAt: -1 }).limit(200).lean();

  const counts = await User.aggregate([
    { $match: { role: 'buyer' } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  return {
    users: users.map(shapeUser),
    counts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
  };
}

export async function getUser(id) {
  const user = await User.findById(id).lean();
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  const [orders, invoices] = await Promise.all([
    Order.find({ user: id }).sort({ createdAt: -1 }).limit(10).lean(),
    Invoice.find({ user: id }).sort({ issuedAt: -1 }).limit(10).lean(),
  ]);

  return {
    user: shapeUser(user),
    orders: orders.map(serializeOrder),
    invoices: invoices.map((invoice) => ({
      number: invoice.number,
      amount: invoice.amount,
      amountPaid: invoice.amountPaid,
      balance: invoice.amount - invoice.amountPaid,
      dueDate: invoice.dueDate,
      status:
        invoice.status !== 'paid' && invoice.dueDate < new Date() ? 'overdue' : invoice.status,
    })),
  };
}

/**
 * Approves a business.
 *
 * This is the gate the whole B2B model hangs on: until it runs, the account can
 * browse but sees no prices and cannot order. Credit terms are set here because
 * approving and deciding terms are one decision, not two.
 */
export async function approveUser(id, adminId, { creditLimit, terms, accountRep }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');
  if (user.role === 'admin') throw ApiError.badRequest('Admin accounts are not approved this way.');

  user.status = 'approved';
  user.approvedAt = new Date();
  user.approvedBy = adminId;
  user.rejectionReason = undefined;
  user.creditLimit = creditLimit;
  user.terms = terms;
  if (accountRep) user.accountRep = accountRep;

  // The referral code is minted here rather than at signup (§6.13): a pending
  // business might never be approved, and a code that can refer people before
  // its own account is trusted is a code worth abusing.
  await referralService.ensureReferralCode(user);

  await user.save();
  // TODO(email): notify the buyer once a mail provider is chosen (PROGRESS.md Q7).
  return shapeUser(user.toObject());
}

export async function rejectUser(id, { reason }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  user.status = 'rejected';
  user.rejectionReason = reason;
  user.approvedAt = undefined;

  await user.save();
  return shapeUser(user.toObject());
}

export async function setUserStatus(id, { status }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');
  if (user.role === 'admin') {
    throw ApiError.badRequest('You cannot change an admin account this way.', 'FORBIDDEN_TARGET');
  }

  user.status = status;
  if (status === 'approved' && !user.approvedAt) user.approvedAt = new Date();
  // Approving through the status route mints a code too, so an account's
  // referral ability does not depend on which screen approved it.
  if (status === 'approved') await referralService.ensureReferralCode(user);

  await user.save();
  return shapeUser(user.toObject());
}

/**
 * Allocates store credit to an account, or corrects it with a negative amount.
 *
 * Deliberately NOT part of `setCredit`: a credit limit is a lending decision
 * that gets edited, while an allocation is an event that gets recorded. One
 * overwrites, the other appends.
 */
export async function allocateStoreCredit(id, { amountDollars, note }, adminId) {
  const amount = Math.round(Number(amountDollars) * 100);
  const posted = await storeCredit.allocate(id, { amount, note }, adminId);
  const user = await User.findById(id).lean();
  return { ...posted, user: shapeUser(user) };
}

export async function storeCreditStatement(id) {
  return storeCredit.statement(id, { limit: 100 });
}

/** Refunds an order to the buyer's store credit. */
export async function refundOrder(orderNumber, { amountDollars, note }, adminId) {
  const amount = Math.round(Number(amountDollars) * 100);
  return storeCredit.refundOrder(orderNumber, { amount, note }, adminId);
}

export async function setCredit(id, { creditLimit, terms }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  user.creditLimit = creditLimit;
  user.terms = terms;

  await user.save();
  return shapeUser(user.toObject());
}

// ---- products ---------------------------------------------------------------

function shapeProduct(product) {
  return {
    id: product._id.toString(),
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    partType: product.partType,
    partTypeLabel: product.partTypeLabel,
    grade: product.grade,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    stock: product.stock,
    deviceTypeSlug: product.deviceTypeSlug,
    deviceTypeName: product.deviceTypeName,
    brandSlug: product.brandSlug,
    brandName: product.brandName,
    seriesSlug: product.seriesSlug,
    seriesName: product.seriesName,
    modelSlug: product.modelSlug,
    modelName: product.modelName,
    isActive: product.isActive,
    updatedAt: product.updatedAt,
  };
}

/**
 * `all: true` lifts the page cap — for the export, which must not silently
 * return the first hundred of four hundred products (§7.4). Deliberately a
 * separate flag rather than a bigger `limit` ceiling: the cap is there to stop
 * a screen asking for the whole catalogue by accident, and an export asking on
 * purpose should have to say so.
 */
export async function listProducts({ q, stock, page = 1, limit = 40, all = false } = {}) {
  const query = {};

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { sku: rx }, { modelName: rx }];
  }

  if (stock === 'out') query.stock = 0;
  else if (stock === 'low') query.stock = { $gt: 0, $lt: LOW_STOCK_THRESHOLD };
  else if (stock === 'inactive') query.isActive = false;

  const pageNumber = all ? 1 : Math.max(1, Number(page) || 1);
  const pageSize = all ? 0 : Math.min(100, Number(limit) || 40);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ updatedAt: -1 })
      .skip(all ? 0 : (pageNumber - 1) * pageSize)
      // `.limit(0)` is Mongo's "no limit", which is what an export wants.
      .limit(pageSize)
      .lean(),
    Product.countDocuments(query),
  ]);

  return {
    products: products.map(shapeProduct),
    total,
    page: pageNumber,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Denormalised taxonomy names have to be looked up, not trusted from the client. */
async function resolveTaxonomyNames(data) {
  const slugs = [data.deviceTypeSlug, data.brandSlug, data.seriesSlug, data.modelSlug].filter(Boolean);
  const nodes = await Taxonomy.find({ slug: { $in: slugs } }).lean();
  const bySlug = new Map(nodes.map((node) => [node.slug, node]));

  return {
    deviceTypeName: bySlug.get(data.deviceTypeSlug)?.name,
    brandName: bySlug.get(data.brandSlug)?.name,
    seriesName: bySlug.get(data.seriesSlug)?.name,
    modelName: bySlug.get(data.modelSlug)?.name,
  };
}

export async function createProduct(data) {
  const existing = await Product.findOne({ sku: data.sku.toUpperCase() });
  if (existing) throw ApiError.conflict('That SKU already exists.', 'DUPLICATE_SKU');

  const names = await resolveTaxonomyNames(data);
  const product = await Product.create({
    ...data,
    ...names,
    sku: data.sku.toUpperCase(),
    slug: slugify(`${data.modelSlug}-${data.partType}-${data.grade}-${Date.now().toString(36)}`),
    searchTerms: [data.name, names.modelName, names.brandName, data.partTypeLabel, data.grade].filter(
      Boolean,
    ),
  });

  invalidateTree();
  return shapeProduct(product.toObject());
}

export async function updateProduct(id, data) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  const duplicate = await Product.findOne({ sku: data.sku.toUpperCase(), _id: { $ne: id } });
  if (duplicate) throw ApiError.conflict('That SKU already exists.', 'DUPLICATE_SKU');

  const names = await resolveTaxonomyNames(data);
  Object.assign(product, data, names, { sku: data.sku.toUpperCase() });

  await product.save();
  invalidateTree();
  return shapeProduct(product.toObject());
}

/**
 * Deactivates rather than deletes.
 *
 * Orders reference products by id, so a hard delete would leave historical
 * orders pointing at nothing. `isActive: false` hides it from the storefront
 * while keeping every past order readable.
 */
export async function deactivateProduct(id) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  product.isActive = !product.isActive;
  await product.save();
  invalidateTree();
  return shapeProduct(product.toObject());
}

// ---- orders -----------------------------------------------------------------

export async function listOrders({ status, q } = {}) {
  const query = {};
  if (status && status !== 'all') query.status = String(status);

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ orderNumber: rx }, { poNumber: rx }, { 'items.sku': rx }];
  }

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('user', 'businessName email')
    .lean();

  const counts = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

  return {
    orders: orders.map((order) => ({
      ...serializeOrder(order),
      businessName: order.user?.businessName ?? '—',
      businessEmail: order.user?.email ?? null,
    })),
    counts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
  };
}

/**
 * One order, for the detail screen (§4b.6, phase 12).
 *
 * Looked up by `orderNumber` rather than id, because that is what a packing
 * slip, an invoice and a customer email all carry — an operator reading a
 * number off paper should be able to type it into the URL.
 *
 * The linked invoice rides along so the screen can cross-link the two without a
 * second request; the buyer is populated for the same reason.
 */
export async function getOrder(orderNumber) {
  const order = await Order.findOne({ orderNumber })
    .populate('user', 'businessName contactName email phone')
    .lean();
  if (!order) throw ApiError.notFound('Order not found.', 'ORDER_NOT_FOUND');

  const invoice = await Invoice.findOne({ order: order._id }).select('number status').lean();

  return {
    order: {
      ...serializeOrder(order),
      businessName: order.user?.businessName ?? '—',
      contactName: order.user?.contactName ?? null,
      businessEmail: order.user?.email ?? null,
      userId: order.user?._id?.toString() ?? null,
      invoiceNumber: invoice?.number ?? null,
      invoiceStatus: invoice?.status ?? null,
    },
  };
}

/**
 * Advances an order and appends to its timeline.
 *
 * The timeline is append-only: it is what the buyer's tracking page renders, so
 * rewriting history there would mean rewriting what the customer was told.
 * Moving to `shipped` without a tracking number is refused — that transition is
 * exactly when the buyer expects one to appear.
 */
export async function updateOrderStatus(orderNumber, { status, note, tracking }) {
  const order = await Order.findOne({ orderNumber });
  if (!order) throw ApiError.notFound('Order not found.', 'ORDER_NOT_FOUND');

  if (order.status === 'delivered' && status !== 'delivered') {
    throw ApiError.badRequest('A delivered order cannot be moved back.', 'ORDER_FINALISED');
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextIndex = ORDER_STATUS_FLOW.indexOf(status);
  if (nextIndex !== -1 && currentIndex !== -1 && nextIndex < currentIndex) {
    throw ApiError.badRequest(
      'Order status only moves forward. Cancel the order instead.',
      'ORDER_BACKWARDS',
    );
  }

  if (tracking?.carrier || tracking?.number) {
    order.tracking = { ...order.tracking?.toObject?.(), ...tracking };
  }

  if (status === 'shipped' && !order.tracking?.number) {
    throw ApiError.badRequest(
      'Add a carrier and tracking number before marking an order shipped.',
      'TRACKING_REQUIRED',
    );
  }

  if (status !== order.status) {
    order.status = status;
    order.timeline.push({ status, at: new Date(), note: note || defaultNote(status) });
  } else if (note) {
    order.timeline.push({ status, at: new Date(), note });
  }

  await order.save();
  return serializeOrder(order.toObject());
}

function defaultNote(status) {
  return {
    placed: 'Order received and confirmed.',
    processing: 'Picking and quality-checking parts at the Toronto warehouse.',
    shipped: 'Handed to the carrier.',
    out_for_delivery: 'On the delivery vehicle.',
    delivered: 'Signed for at the delivery address.',
    cancelled: 'Order cancelled.',
  }[status];
}

// ---- invoices ---------------------------------------------------------------

/**
 * Overdue is **derived, never stored** — an unpaid invoice becomes overdue by
 * the passage of time, and writing that to the database would mean a nightly
 * job whose only job is to keep a column honest. The account side already reads
 * it this way; this matches it exactly so the two never disagree.
 */
function shapeAdminInvoice(invoice) {
  const balance = invoice.amount - invoice.amountPaid;
  const overdue =
    invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return {
    id: invoice._id.toString(),
    number: invoice.number,
    orderNumber: invoice.order?.orderNumber ?? null,
    businessName: invoice.user?.businessName ?? '—',
    contactName: invoice.user?.contactName ?? null,
    userId: invoice.user?._id?.toString() ?? null,
    amount: invoice.amount,
    amountPaid: invoice.amountPaid,
    balance,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    terms: invoice.terms,
    status: overdue ? 'overdue' : invoice.status,
    payments: (invoice.payments ?? []).map((payment) => ({
      amount: payment.amount,
      at: payment.at,
      method: payment.method ?? null,
      reference: payment.reference ?? null,
    })),
  };
}

/**
 * Recompute an invoice's paid total and status **from its own payments**.
 *
 * Never trust an incoming `amountPaid`: the sum of the ledger is the truth, and
 * recomputing it here means a corrected or removed payment cannot leave the
 * header disagreeing with the rows beneath it.
 */
function recomputeInvoice(invoice) {
  const paid = (invoice.payments ?? []).reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
  invoice.amountPaid = paid;

  if (paid <= 0) invoice.status = 'unpaid';
  else if (paid >= invoice.amount) invoice.status = 'paid';
  else invoice.status = 'partial';

  return invoice;
}

/**
 * Admin invoice list.
 *
 * `status=overdue` is a filter over derived state rather than a stored value,
 * so it is applied in the query as "not paid, and past due" — the dashboard
 * links straight here with it.
 */
export async function listInvoices({ status, q, from, to } = {}) {
  const now = new Date();
  const query = {};

  if (status === 'overdue') {
    query.status = { $ne: 'paid' };
    query.dueDate = { $lt: now };
  } else if (status && status !== 'all') {
    query.status = String(status);
  }

  if (from || to) {
    query.issuedAt = {};
    if (from) query.issuedAt.$gte = new Date(`${from}T00:00:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setHours(23, 59, 59, 999);
      query.issuedAt.$lte = end;
    }
  }

  if (q) {
    const rx = likeRegex(q);
    // An invoice number is the obvious search, but staff more often have the
    // business in front of them, so both resolve.
    const users = await User.find({ $or: [{ businessName: rx }, { email: rx }] })
      .select('_id')
      .lean();
    query.$or = [{ number: rx }, { user: { $in: users.map((user) => user._id) } }];
  }

  const invoices = await Invoice.find(query)
    .sort({ issuedAt: -1 })
    .limit(200)
    .populate('order', 'orderNumber')
    .populate('user', 'businessName contactName')
    .lean();

  // Counts come from the whole collection, not the filtered set — a pill that
  // showed "Overdue 0" because you are already filtered to Paid is useless.
  const [statusRows, overdueCount] = await Promise.all([
    Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Invoice.countDocuments({ status: { $ne: 'paid' }, dueDate: { $lt: now } }),
  ]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.overdue = overdueCount;
  counts.all = statusRows.reduce((sum, row) => sum + row.count, 0);

  const shaped = invoices.map(shapeAdminInvoice);

  return {
    invoices: shaped,
    counts,
    totals: {
      billed: shaped.reduce((sum, invoice) => sum + invoice.amount, 0),
      paid: shaped.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstanding: shaped.reduce((sum, invoice) => sum + invoice.balance, 0),
    },
  };
}

export async function getInvoice(number) {
  const invoice = await Invoice.findOne({ number })
    .populate('order', 'orderNumber items total status')
    .populate('user', 'businessName contactName email phone')
    .lean();

  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');
  return { invoice: shapeAdminInvoice(invoice) };
}

/**
 * Record a payment against an invoice.
 *
 * The client sends an amount, a date, a method and a reference — never a status
 * and never a running total. `amountPaid` and `status` are both recomputed from
 * the payment rows, server-side, exactly as the Instructions require of every
 * money total.
 */
export async function recordPayment(number, { amountDollars, at, method, reference }) {
  const invoice = await Invoice.findOne({ number });
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');

  const amount = Math.round(Number(amountDollars) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('Enter an amount to record.', 'INVALID_AMOUNT');
  }

  const outstanding = invoice.amount - invoice.amountPaid;
  if (amount > outstanding) {
    // Overpayment is a real situation, but it belongs in store credit rather
    // than an invoice that claims to be more than paid. Refuse and say so.
    throw ApiError.badRequest(
      `That is more than the ${(outstanding / 100).toFixed(2)} outstanding on this invoice.`,
      'PAYMENT_TOO_LARGE',
    );
  }

  invoice.payments.push({
    amount,
    at: at ? new Date(`${at}T12:00:00`) : new Date(),
    method: method || undefined,
    reference: reference || undefined,
  });

  recomputeInvoice(invoice);
  await invoice.save();

  // Referral commission accrues on payment, never on the order (§6.13) — an
  // unpaid invoice has earned nobody anything. Keyed on this payment's index,
  // so an invoice settled in instalments earns once per instalment and a
  // replayed request cannot pay twice.
  //
  // Deliberately not awaited into the response's success: `accrueForPayment`
  // swallows its own failures, because a commission that could not post is a
  // problem to investigate and never a reason to reject a payment that
  // genuinely happened.
  await referralService.accrueForPayment(invoice, invoice.payments.length - 1);

  return getInvoice(number);
}

/**
 * Void an invoice.
 *
 * Voiding is modelled as full forgiveness rather than a delete: the row stays,
 * the balance goes to zero, and the reason is recorded as a payment of type
 * `void`. An invoice that vanishes takes its own audit trail with it.
 */
export async function voidInvoice(number, { reason } = {}) {
  const invoice = await Invoice.findOne({ number });
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');
  if (invoice.status === 'paid' && invoice.amountPaid >= invoice.amount) {
    throw ApiError.badRequest('This invoice is already settled.', 'ALREADY_SETTLED');
  }

  const outstanding = invoice.amount - invoice.amountPaid;
  if (outstanding > 0) {
    invoice.payments.push({
      amount: outstanding,
      at: new Date(),
      method: 'void',
      reference: reason || 'Voided by an administrator',
    });
  }

  recomputeInvoice(invoice);
  await invoice.save();

  // Voiding forgives the balance, so any commission this invoice earned is
  // commission on money that never arrived. Every accrual against it is
  // reversed — commission on money that came back is money leaking out
  // (§6.13). Idempotent, so voiding twice does not claw back twice.
  await referralService.reverseForInvoice(invoice.number);

  return getInvoice(number);
}

/**
 * Every activity touching one account, newest first — the Activity tab on the
 * client profile.
 *
 * Assembled from what already exists rather than from an audit log: `AuditLog`
 * arrives in phase 11, and until it does, orders, invoices, payments and credit
 * movements are the record.
 */
export async function userActivity(id) {
  const user = await User.findById(id).lean();
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  const [orders, invoices, credits] = await Promise.all([
    Order.find({ user: id }).sort({ createdAt: -1 }).limit(40).lean(),
    Invoice.find({ user: id }).sort({ issuedAt: -1 }).limit(40).lean(),
    CreditTransaction.find({ user: id }).sort({ createdAt: -1 }).limit(40).lean(),
  ]);

  const events = [];

  for (const order of orders) {
    events.push({
      kind: 'order',
      at: order.createdAt,
      title: `Order ${order.orderNumber} placed`,
      detail: `${order.items.length} ${order.items.length === 1 ? 'line' : 'lines'}`,
      amount: order.total,
      reference: order.orderNumber,
    });

    // The timeline is where status history already lives, so it does not need
    // a second store to be reportable.
    for (const step of order.timeline ?? []) {
      if (step.status === 'placed') continue;
      events.push({
        kind: 'order-status',
        at: step.at,
        title: `Order ${order.orderNumber} → ${step.status.replace(/_/g, ' ')}`,
        detail: step.note ?? null,
        reference: order.orderNumber,
      });
    }
  }

  for (const invoice of invoices) {
    events.push({
      kind: 'invoice',
      at: invoice.issuedAt,
      title: `Invoice ${invoice.number} issued`,
      detail: invoice.terms,
      amount: invoice.amount,
      reference: invoice.number,
    });

    for (const payment of invoice.payments ?? []) {
      events.push({
        kind: payment.method === 'void' ? 'void' : 'payment',
        at: payment.at,
        title:
          payment.method === 'void'
            ? `Invoice ${invoice.number} voided`
            : `Payment on ${invoice.number}`,
        detail: payment.reference ?? payment.method ?? null,
        amount: payment.amount,
        reference: invoice.number,
      });
    }
  }

  for (const credit of credits) {
    events.push({
      kind: 'credit',
      at: credit.createdAt,
      title: `Store credit ${credit.amount > 0 ? 'added' : 'spent'} · ${credit.type}`,
      detail: credit.note ?? null,
      amount: credit.amount,
      reference: credit.orderNumber ?? null,
    });
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  return { activity: events.slice(0, 80) };
}

/**
 * Advance several orders at once.
 *
 * **Every rule the single-order route enforces still applies**, and it applies
 * here rather than being waved through because the request was plural: no
 * backwards moves, nothing out of a delivered order, and no marking an order
 * shipped without a tracking number.
 *
 * A batch is **partial by design**. One order that cannot make the move must
 * not fail the other forty, so each is attempted independently and the response
 * names what moved and what did not, with a reason per skip. The UI shows that
 * list — silently moving nineteen of twenty is how an operator comes to trust a
 * button that is lying to them.
 *
 * Bulk deliberately offers **no tracking field**: one tracking number across
 * many parcels is wrong, so bulk-to-shipped skips anything without one already
 * and says so.
 */
export async function bulkUpdateOrderStatus({ orderNumbers, status, note }) {
  const orders = await Order.find({ orderNumber: { $in: orderNumbers } });
  const byNumber = new Map(orders.map((order) => [order.orderNumber, order]));

  const updated = [];
  const skipped = [];

  for (const orderNumber of orderNumbers) {
    const order = byNumber.get(orderNumber);

    if (!order) {
      skipped.push({ orderNumber, reason: 'Not found.' });
      continue;
    }
    if (order.status === status) {
      skipped.push({ orderNumber, reason: `Already ${status.replace(/_/g, ' ')}.` });
      continue;
    }
    if (order.status === 'delivered') {
      skipped.push({ orderNumber, reason: 'Delivered orders cannot be moved.' });
      continue;
    }
    if (order.status === 'cancelled') {
      skipped.push({ orderNumber, reason: 'Cancelled orders cannot be moved.' });
      continue;
    }

    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
    const nextIndex = ORDER_STATUS_FLOW.indexOf(status);
    if (nextIndex !== -1 && currentIndex !== -1 && nextIndex < currentIndex) {
      skipped.push({ orderNumber, reason: 'Status only moves forward.' });
      continue;
    }

    if (status === 'shipped' && !order.tracking?.number) {
      skipped.push({ orderNumber, reason: 'Needs a tracking number — ship it individually.' });
      continue;
    }

    order.status = status;
    order.timeline.push({ status, at: new Date(), note: note || defaultNote(status) });
    await order.save();
    updated.push(order.orderNumber);
  }

  return { updated, skipped };
}

/**
 * The invoice document, for an admin.
 *
 * The buyer-facing route scopes its lookup to `user: req.user._id`, which is
 * correct there and means an admin gets a 404 on somebody else's invoice. This
 * renders **the same artefact through the same renderer** — a second rendering
 * would be free to drift from what the customer actually received, and then the
 * two would disagree in front of a customer.
 */
export async function invoiceDocument(number, { nonce } = {}) {
  const invoice = await Invoice.findOne({ number }).populate('order').lean();
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');

  const user = await User.findById(invoice.user).lean();
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  return renderInvoiceHtml({ invoice, order: invoice.order, user, nonce });
}
