import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import Taxonomy from '../models/Taxonomy.js';
import ApiError from '../utils/ApiError.js';
import * as storeCredit from './storeCreditService.js';
import { likeRegex } from '../utils/regex.js';
import { serializeOrder } from './orderService.js';
import { invalidateTree } from './taxonomyService.js';
import { ORDER_STATUS_FLOW } from '../../../shared/schemas/admin.js';

const LOW_STOCK_THRESHOLD = 50;

/** Admin home: what needs attention today, not vanity metrics. */
export async function stats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    pendingUsers,
    approvedUsers,
    openOrders,
    revenueRows,
    outstandingRows,
    lowStock,
    outOfStock,
    productCount,
    recentOrders,
    pendingQueue,
  ] = await Promise.all([
    User.countDocuments({ status: 'pending' }),
    User.countDocuments({ status: 'approved', role: 'buyer' }),
    Order.countDocuments({ status: { $in: ['placed', 'processing', 'shipped', 'out_for_delivery'] } }),

    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),

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

    Product.countDocuments({ isActive: true, stock: { $gt: 0, $lt: LOW_STOCK_THRESHOLD } }),
    Product.countDocuments({ isActive: true, stock: 0 }),
    Product.countDocuments({ isActive: true }),

    Order.find({}).sort({ createdAt: -1 }).limit(6).populate('user', 'businessName').lean(),
    User.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(5).lean(),
  ]);

  return {
    users: { pending: pendingUsers, approved: approvedUsers },
    orders: { open: openOrders, last30Days: revenueRows[0]?.count ?? 0 },
    revenue: { last30Days: revenueRows[0]?.total ?? 0 },
    receivables: {
      outstanding: outstandingRows[0]?.outstanding ?? 0,
      overdue: outstandingRows[0]?.overdue ?? 0,
    },
    inventory: { total: productCount, lowStock, outOfStock },
    recentOrders: recentOrders.map((order) => ({
      ...serializeOrder(order),
      businessName: order.user?.businessName ?? '—',
    })),
    pendingQueue: pendingQueue.map(shapeUser),
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

export async function listProducts({ q, stock, page = 1, limit = 40 } = {}) {
  const query = {};

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { sku: rx }, { modelName: rx }];
  }

  if (stock === 'out') query.stock = 0;
  else if (stock === 'low') query.stock = { $gt: 0, $lt: LOW_STOCK_THRESHOLD };
  else if (stock === 'inactive') query.isActive = false;

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Number(limit) || 40);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ updatedAt: -1 })
      .skip((pageNumber - 1) * pageSize)
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
