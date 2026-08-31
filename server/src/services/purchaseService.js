const mongoose = require('mongoose');

const { default: Supplier } = require('../models/Supplier.js');
const { default: PurchaseOrder } = require('../models/PurchaseOrder.js');
const { default: Expense } = require('../models/Expense.js');
const { default: ExpenseCategory } = require('../models/ExpenseCategory.js');
const { default: StockMovement } = require('../models/StockMovement.js');
const { default: Product } = require('../models/Product.js');
const { default: ApiError } = require('../utils/ApiError.js');
const { likeRegex } = require('../utils/regex.js');

/**
 * Purchase — suppliers, purchase orders, expenses and the stock ledger
 * (ERP rework §6.7–6.10, phase 5).
 *
 * Three rules hold this file together, and every function below is an
 * application of one of them:
 *
 *   1. **Money is recomputed here, never accepted.** A client sends quantities
 *      and a negotiated unit cost; every subtotal, tax line and total is
 *      derived server-side, the same way `pricingService` owns a sale.
 *   2. **Stock only moves through `applyStockMovement`.** `Product.stock` has
 *      no history of its own, so a write that skips the ledger is a quantity
 *      nobody can ever explain. This is `storeCreditService`'s rule, applied to
 *      inventory.
 *   3. **A derived status is never stored as a decision.** A purchase order is
 *      `partial` or `received` because of what has arrived, recomputed on every
 *      receipt — exactly as an invoice's status is recomputed from its payments.
 */

const LOW_STOCK_FALLBACK = 50;

// ---- numbering --------------------------------------------------------------

/**
 * `PO-2026-00001`, `EXP-2026-00001` — sequential per year, matching the
 * `CVX-`/`INV-` convention already in `orderService` (§8).
 *
 * Same last-row-wins approach as order numbering: a race would need two rows
 * created in the same millisecond by two operators, and the unique index is the
 * backstop if it ever happens.
 */
async function nextNumber(Model, field, prefix) {
  const year = new Date().getFullYear();
  const full = `${prefix}-${year}-`;
  const last = await Model.findOne({ [field]: new RegExp(`^${full}`) })
    .sort({ [field]: -1 })
    .select(field)
    .lean();

  const sequence = last ? Number(last[field].slice(full.length)) + 1 : 1;
  return `${full}${String(sequence).padStart(5, '0')}`;
}

/** A `YYYY-MM-DD` day, or the fallback. Never a client-supplied timestamp. */
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

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value ?? ''));
}

// ---- the stock ledger -------------------------------------------------------

/**
 * The one place `Product.stock` changes.
 *
 * Increments the product and writes the movement that explains it, returning
 * the quantity the change produced. `qtyAfter` is read back from the updated
 * document rather than computed from a stale copy, so two concurrent receipts
 * cannot both record the same "after".
 *
 * Stock is never taken below zero: a negative quantity on hand is not a real
 * position, and an adjustment that would go there is refused rather than
 * silently floored — the operator meant something specific and should be told
 * which part of it could not happen.
 */
async function applyStockMovement({
  product,
  type,
  qtyChange,
  unitCost,
  reference,
  note,
  createdBy,
  outlet,
}) {
  const doc = await Product.findById(product).select('_id stock name sku');
  if (!doc) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  if (qtyChange < 0 && doc.stock + qtyChange < 0) {
    throw ApiError.badRequest(
      `${doc.sku} has ${doc.stock} on hand — that adjustment would take it below zero.`,
      'STOCK_BELOW_ZERO',
    );
  }

  const updated = await Product.findByIdAndUpdate(
    doc._id,
    { $inc: { stock: qtyChange } },
    { new: true, select: 'stock' },
  );

  await StockMovement.create({
    product: doc._id,
    outlet: outlet ?? undefined,
    type,
    qtyChange,
    qtyAfter: updated.stock,
    unitCost,
    reference,
    note,
    createdBy,
  });

  return updated.stock;
}

// ---- suppliers --------------------------------------------------------------

function shapeSupplier(supplier) {
  return {
    id: supplier._id.toString(),
    name: supplier.name,
    code: supplier.code ?? null,
    email: supplier.email ?? null,
    phone: supplier.phone ?? null,
    contactName: supplier.contactName ?? null,
    website: supplier.website ?? null,
    address: supplier.address ?? null,
    paymentTerms: supplier.paymentTerms,
    notes: supplier.notes ?? null,
    isActive: supplier.isActive,
    ordersCount: supplier.ordersCount ?? 0,
    totalSpent: supplier.totalSpent ?? 0,
  };
}

async function listSuppliers({ q, status } = {}) {
  const query = {};
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { code: rx }, { contactName: rx }, { email: rx }];
  }

  const suppliers = await Supplier.find(query).sort({ name: 1 }).limit(300).lean();

  // Counts come from the whole collection, not the filtered set — the same rule
  // the invoice pills follow, for the same reason.
  const [total, active] = await Promise.all([
    Supplier.countDocuments({}),
    Supplier.countDocuments({ isActive: true }),
  ]);

  return {
    suppliers: suppliers.map(shapeSupplier),
    counts: { all: total, active, inactive: total - active },
  };
}

async function getSupplier(id) {
  if (!isObjectId(id)) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');

  const supplier = await Supplier.findById(id).lean();
  if (!supplier) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');

  const [orders, products, spendRows] = await Promise.all([
    PurchaseOrder.find({ supplier: id })
      .sort({ orderDate: -1 })
      .limit(50)
      .populate('supplier', 'name email')
      .lean(),
    Product.find({ supplier: id })
      .sort({ name: 1 })
      .limit(100)
      .select('name sku price cost stock minStock')
      .lean(),
    // Spend by month, from sent, partial and received POs only — a draft is a
    // plan, not money, and charting it would overstate what this supplier has
    // actually cost.
    PurchaseOrder.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(String(id)),
          status: { $nin: ['draft', 'cancelled'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$orderDate' } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 24 },
    ]),
  ]);

  return {
    supplier: shapeSupplier(supplier),
    orders: orders.map(shapePurchaseOrder),
    products: products.map((product) => ({
      id: product._id.toString(),
      name: product.name,
      sku: product.sku,
      price: product.price,
      cost: product.cost ?? 0,
      stock: product.stock,
      minStock: product.minStock ?? 0,
    })),
    spend: spendRows.map((row) => ({ label: row._id, total: row.total, count: row.count })),
  };
}

async function createSupplier(body) {
  const supplier = await Supplier.create({ ...body, code: body.code || undefined });
  return { supplier: shapeSupplier(supplier.toObject()) };
}

async function updateSupplier(id, body) {
  if (!isObjectId(id)) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');

  const supplier = await Supplier.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!supplier) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');
  return { supplier: shapeSupplier(supplier.toObject()) };
}

/**
 * Deactivate rather than delete — purchase orders reference a supplier by id,
 * exactly as orders reference a product, and a deleted row would leave a PO
 * whose origin nobody can name. Toggles, so the card's icon button can undo it.
 */
async function toggleSupplier(id) {
  if (!isObjectId(id)) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');

  const supplier = await Supplier.findById(id);
  if (!supplier) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');

  supplier.isActive = !supplier.isActive;
  await supplier.save();
  return { supplier: shapeSupplier(supplier.toObject()) };
}

/**
 * Recompute a supplier's card figures from its purchase orders.
 *
 * Called after every PO write. Recomputing beats incrementing: an incremented
 * cache drifts the first time a PO is cancelled, and nothing ever notices.
 * Drafts and cancellations are excluded for the same reason the spend chart
 * excludes them.
 */
async function refreshSupplierTotals(supplierId) {
  const [row] = await PurchaseOrder.aggregate([
    {
      $match: {
        supplier: new mongoose.Types.ObjectId(String(supplierId)),
        status: { $nin: ['draft', 'cancelled'] },
      },
    },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]);

  await Supplier.findByIdAndUpdate(supplierId, {
    ordersCount: row?.count ?? 0,
    totalSpent: row?.total ?? 0,
  });
}

// ---- purchase orders --------------------------------------------------------

/**
 * Overdue is **derived, never stored** — a purchase order becomes late by the
 * passage of time, the same way an invoice becomes overdue (§6.5). A received
 * or cancelled PO is never late, however far past its expected date it sits.
 */
function shapePurchaseOrder(po) {
  const outstanding = (po.items ?? []).reduce(
    (sum, item) => sum + Math.max(0, item.qtyOrdered - (item.qtyReceived ?? 0)),
    0,
  );
  const open = !['received', 'cancelled'].includes(po.status);
  const overdue = Boolean(open && po.expectedDate && new Date(po.expectedDate) < new Date());

  return {
    id: po._id.toString(),
    poNumber: po.poNumber,
    supplier: po.supplier?.name
      ? { id: po.supplier._id.toString(), name: po.supplier.name, email: po.supplier.email ?? null }
      : { id: po.supplier?.toString() ?? null, name: '—', email: null },
    status: po.status,
    orderDate: po.orderDate,
    expectedDate: po.expectedDate ?? null,
    receivedDate: po.receivedDate ?? null,
    overdue,
    items: (po.items ?? []).map((item) => ({
      product: item.product?.toString() ?? null,
      sku: item.sku,
      name: item.name,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived ?? 0,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
    })),
    itemCount: (po.items ?? []).length,
    qtyOutstanding: outstanding,
    subtotal: po.subtotal ?? 0,
    tax: po.tax ?? 0,
    shipping: po.shipping ?? 0,
    total: po.total ?? 0,
    payment: {
      status: po.payment?.status ?? 'unpaid',
      method: po.payment?.method ?? null,
      reference: po.payment?.reference ?? null,
      paidAt: po.payment?.paidAt ?? null,
      expense: po.payment?.expense?.toString() ?? null,
    },
    timeline: (po.timeline ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at,
      note: entry.note ?? null,
    })),
    notes: po.notes ?? null,
  };
}

/**
 * Totals from the lines. The client sends quantities and a negotiated unit
 * cost; every figure below is arithmetic the server does (invariant 8).
 */
function recomputeTotals(po) {
  po.items.forEach((item) => {
    item.lineTotal = item.qtyOrdered * item.unitCost;
  });
  po.subtotal = po.items.reduce((sum, item) => sum + item.lineTotal, 0);
  po.total = po.subtotal + (po.tax ?? 0) + (po.shipping ?? 0);
  return po;
}

/**
 * Status from receiving, not from a client.
 *
 * `draft` and `cancelled` are decisions and are left alone; everything else is
 * a reading of the lines. A PO with nothing received stays `sent`, one with a
 * short line is `partial`, and only a PO with every line complete is
 * `received`. Same shape as `recomputeInvoice` in `adminService`, for the same
 * reason: a header that disagrees with its rows is a header nobody can trust.
 */
function recomputeStatus(po) {
  if (po.status === 'draft' || po.status === 'cancelled') return po;

  const received = po.items.reduce((sum, item) => sum + (item.qtyReceived ?? 0), 0);
  const ordered = po.items.reduce((sum, item) => sum + item.qtyOrdered, 0);

  if (received <= 0) po.status = 'sent';
  else if (received >= ordered) po.status = 'received';
  else po.status = 'partial';

  po.receivedDate = po.status === 'received' ? (po.receivedDate ?? new Date()) : null;
  return po;
}

async function listPurchaseOrders({ q, status, supplier, from, to } = {}) {
  const query = {};

  if (status === 'overdue') {
    query.status = { $nin: ['received', 'cancelled'] };
    query.expectedDate = { $lt: new Date() };
  } else if (status && status !== 'all') {
    query.status = String(status);
  }

  if (supplier && isObjectId(supplier)) query.supplier = supplier;

  if (from || to) {
    query.orderDate = {};
    if (from) query.orderDate.$gte = toDate(from);
    if (to) query.orderDate.$lte = endOfDay(to);
  }

  if (q) {
    const rx = likeRegex(q);
    // Staff have either the PO in front of them or the supplier's name, so
    // both resolve — the same courtesy the invoice search extends.
    const suppliers = await Supplier.find({ $or: [{ name: rx }, { code: rx }] })
      .select('_id')
      .lean();
    query.$or = [{ poNumber: rx }, { supplier: { $in: suppliers.map((s) => s._id) } }];
  }

  const orders = await PurchaseOrder.find(query)
    .sort({ orderDate: -1 })
    .limit(200)
    .populate('supplier', 'name email')
    .lean();

  const [statusRows, pendingRow] = await Promise.all([
    PurchaseOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    // Pending value is money committed and not yet landed — the number an
    // operator uses to answer "what is on the water". A cancelled PO is not
    // committed and a received one has arrived, so neither counts.
    PurchaseOrder.aggregate([
      { $match: { status: { $in: ['draft', 'sent', 'partial'] } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
  ]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.all = statusRows.reduce((sum, row) => sum + row.count, 0);

  return {
    orders: orders.map(shapePurchaseOrder),
    counts,
    totals: { pendingValue: pendingRow[0]?.total ?? 0 },
  };
}

async function getPurchaseOrder(id) {
  const query = isObjectId(id) ? { _id: id } : { poNumber: String(id) };
  const po = await PurchaseOrder.findOne(query)
    .populate('supplier', 'name email phone paymentTerms')
    .lean();
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');

  const movements = await StockMovement.find({
    'reference.kind': 'purchase_order',
    'reference.id': po._id,
  })
    .sort({ createdAt: -1 })
    .populate('product', 'name sku')
    .lean();

  return {
    order: shapePurchaseOrder(po),
    movements: movements.map((movement) => ({
      id: movement._id.toString(),
      product: movement.product
        ? {
            id: movement.product._id.toString(),
            name: movement.product.name,
            sku: movement.product.sku,
          }
        : null,
      qtyChange: movement.qtyChange,
      qtyAfter: movement.qtyAfter,
      at: movement.createdAt,
      note: movement.note ?? null,
    })),
  };
}

/**
 * Create a purchase order.
 *
 * Line names and SKUs are snapshotted from the catalogue at creation, the way
 * an order line is — a PO raised in March must still read correctly when the
 * product is renamed in June.
 */
async function createPurchaseOrder(body, createdBy) {
  const supplier = await Supplier.findById(body.supplier).lean();
  if (!supplier) throw ApiError.badRequest('Pick a supplier.', 'SUPPLIER_NOT_FOUND');

  const ids = body.items.map((item) => item.product).filter(isObjectId);
  const products = await Product.find({ _id: { $in: ids } }).select('name sku').lean();
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
      qtyOrdered: item.qtyOrdered,
      qtyReceived: 0,
      unitCost: item.unitCost,
      lineTotal: item.qtyOrdered * item.unitCost,
    };
  });

  const po = new PurchaseOrder({
    poNumber: await nextNumber(PurchaseOrder, 'poNumber', 'PO'),
    supplier: supplier._id,
    status: 'draft',
    orderDate: toDate(body.orderDate, new Date()),
    expectedDate: toDate(body.expectedDate),
    items,
    tax: body.tax ?? 0,
    shipping: body.shipping ?? 0,
    notes: body.notes,
    createdBy,
    timeline: [{ status: 'draft', at: new Date(), note: 'Purchase order created.' }],
  });

  recomputeTotals(po);
  await po.save();
  await refreshSupplierTotals(supplier._id);

  return { order: shapePurchaseOrder(po.toObject()) };
}

/** Edits stop at `draft` — once a PO has been sent, the supplier is working
 *  from a document this one no longer matches. */
async function updatePurchaseOrder(id, body) {
  const query = isObjectId(id) ? { _id: id } : { poNumber: String(id) };
  const po = await PurchaseOrder.findOne(query);
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');

  if (po.status !== 'draft') {
    throw ApiError.badRequest(
      `${po.poNumber} has already been sent — cancel it and raise a new one rather than editing it.`,
      'PO_NOT_EDITABLE',
    );
  }

  const supplier = await Supplier.findById(body.supplier).lean();
  if (!supplier) throw ApiError.badRequest('Pick a supplier.', 'SUPPLIER_NOT_FOUND');

  const previousSupplier = po.supplier;

  const ids = body.items.map((item) => item.product).filter(isObjectId);
  const products = await Product.find({ _id: { $in: ids } }).select('name sku').lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  po.supplier = supplier._id;
  po.orderDate = toDate(body.orderDate, po.orderDate);
  po.expectedDate = toDate(body.expectedDate);
  po.tax = body.tax ?? 0;
  po.shipping = body.shipping ?? 0;
  po.notes = body.notes;
  po.items = body.items.map((item) => {
    const product = byId.get(String(item.product));
    if (!product) {
      throw ApiError.badRequest('One of those products no longer exists.', 'PRODUCT_NOT_FOUND');
    }
    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: 0,
      unitCost: item.unitCost,
      lineTotal: item.qtyOrdered * item.unitCost,
    };
  });

  recomputeTotals(po);
  await po.save();

  // Both suppliers are refreshed when the PO moved between them, or the old
  // one keeps counting money it is no longer owed.
  await refreshSupplierTotals(supplier._id);
  if (String(previousSupplier) !== String(supplier._id)) {
    await refreshSupplierTotals(previousSupplier);
  }

  return { order: shapePurchaseOrder(po.toObject()) };
}

/**
 * `draft → sent`, or cancel.
 *
 * Cancelling a PO that has already taken delivery is refused: that stock is on
 * the shelf, and cancelling the paperwork behind it would leave a quantity with
 * no document to explain it. Receive the rest, or leave it partial.
 */
async function setPurchaseOrderStatus(id, { status, note }) {
  const query = isObjectId(id) ? { _id: id } : { poNumber: String(id) };
  const po = await PurchaseOrder.findOne(query);
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');

  if (status === 'sent') {
    if (po.status !== 'draft') {
      throw ApiError.badRequest(`${po.poNumber} has already been sent.`, 'PO_ALREADY_SENT');
    }
    if (!po.items.length) {
      throw ApiError.badRequest('Add a line before sending this order.', 'PO_EMPTY');
    }
    po.status = 'sent';
  } else {
    if (po.status === 'cancelled') {
      throw ApiError.badRequest(`${po.poNumber} is already cancelled.`, 'PO_ALREADY_CANCELLED');
    }
    const received = po.items.reduce((sum, item) => sum + (item.qtyReceived ?? 0), 0);
    if (received > 0) {
      throw ApiError.badRequest(
        `${po.poNumber} has already taken delivery of ${received} unit(s) — that stock is on the shelf, and cancelling would leave it unexplained.`,
        'PO_PARTIALLY_RECEIVED',
      );
    }
    po.status = 'cancelled';
  }

  po.timeline.push({ status: po.status, at: new Date(), note });
  await po.save();
  await refreshSupplierTotals(po.supplier);

  return { order: shapePurchaseOrder(po.toObject()) };
}

/**
 * Receive a delivery (§6.8, automation contract).
 *
 * The client sends what arrived **in this delivery**, per SKU. The server adds
 * it to what has already arrived, refuses an over-receipt line by line, moves
 * stock through the ledger, and re-derives the status. Nothing about a status
 * or a running total is accepted from the request.
 *
 * Partial by design, in the same sense the bulk order action is: one line that
 * cannot be received must not fail the rest of the delivery, so each is
 * attempted independently and the response names what moved and what did not,
 * with a reason per skip. Silently receiving nineteen of twenty lines is how an
 * operator comes to trust a button that is lying to them.
 */
async function receivePurchaseOrder(id, { lines, note }, receivedBy) {
  const query = isObjectId(id) ? { _id: id } : { poNumber: String(id) };
  const po = await PurchaseOrder.findOne(query);
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');

  if (po.status === 'draft') {
    throw ApiError.badRequest(`${po.poNumber} has not been sent to the supplier yet.`, 'PO_NOT_SENT');
  }
  if (po.status === 'cancelled') {
    throw ApiError.badRequest(`${po.poNumber} is cancelled.`, 'PO_CANCELLED');
  }
  if (po.status === 'received') {
    throw ApiError.badRequest(`${po.poNumber} is already fully received.`, 'PO_ALREADY_RECEIVED');
  }

  const received = [];
  const skipped = [];

  for (const line of lines) {
    if (line.qty <= 0) continue;

    const item = po.items.find((candidate) => candidate.sku === line.sku);
    if (!item) {
      skipped.push({ sku: line.sku, reason: 'That SKU is not on this purchase order.' });
      continue;
    }

    const outstanding = item.qtyOrdered - (item.qtyReceived ?? 0);
    if (outstanding <= 0) {
      skipped.push({ sku: line.sku, reason: 'Already fully received.' });
      continue;
    }
    if (line.qty > outstanding) {
      // Over-receipt is refused rather than clamped: receiving more than was
      // ordered is either a supplier error or a typo, and quietly accepting it
      // puts a quantity on the shelf that no document accounts for.
      skipped.push({
        sku: line.sku,
        reason: `Only ${outstanding} outstanding — receiving ${line.qty} would exceed the order.`,
      });
      continue;
    }

    let qtyAfter;
    try {
      qtyAfter = await applyStockMovement({
        product: item.product,
        type: 'purchase',
        qtyChange: line.qty,
        unitCost: item.unitCost,
        reference: { kind: 'purchase_order', id: po._id, label: po.poNumber },
        note,
        createdBy: receivedBy,
      });
    } catch (error) {
      skipped.push({ sku: line.sku, reason: error.message });
      continue;
    }

    item.qtyReceived = (item.qtyReceived ?? 0) + line.qty;
    received.push({ sku: line.sku, name: item.name, qty: line.qty, qtyAfter });

    // A receipt is the moment the true cost of this part is known, so the
    // catalogue's cost follows it. `price` is untouched — what Cellvix pays and
    // what a client pays are two decisions, and only one of them belongs to the
    // supplier.
    await Product.findByIdAndUpdate(item.product, { cost: item.unitCost });
  }

  if (received.length) {
    recomputeStatus(po);
    po.timeline.push({
      status: po.status,
      at: new Date(),
      note: note ?? `Received ${received.reduce((sum, row) => sum + row.qty, 0)} unit(s).`,
    });
    await po.save();
  }

  return { order: shapePurchaseOrder(po.toObject()), received, skipped };
}

/**
 * Record a PO payment — which creates the `Expense` row (§6.8).
 *
 * Written once and only once: a PO already carrying `payment.expense` is
 * refused, because the alternative is an operator double-clicking their way
 * into a P&L that counts the same money twice.
 *
 * The expense amount is `po.total`, read from the order and never from the
 * request — the same rule that stops a client sending a price.
 */
async function recordPurchasePayment(id, { method, reference, paidAt, category }, createdBy) {
  const query = isObjectId(id) ? { _id: id } : { poNumber: String(id) };
  const po = await PurchaseOrder.findOne(query).populate('supplier', 'name');
  if (!po) throw ApiError.notFound('Purchase order not found.', 'PO_NOT_FOUND');

  if (po.status === 'draft') {
    throw ApiError.badRequest(`${po.poNumber} has not been sent to the supplier yet.`, 'PO_NOT_SENT');
  }
  if (po.status === 'cancelled') {
    throw ApiError.badRequest(`${po.poNumber} is cancelled.`, 'PO_CANCELLED');
  }
  if (po.payment?.expense) {
    throw ApiError.badRequest(
      `${po.poNumber} is already recorded as paid — see the expense it created.`,
      'PO_ALREADY_PAID',
    );
  }

  const categoryDoc = await resolvePurchaseCategory(category);

  const when = toDate(paidAt, new Date());

  const expense = await Expense.create({
    number: await nextNumber(Expense, 'number', 'EXP'),
    date: when,
    description: `Purchase Order ${po.poNumber} — ${po.supplier?.name ?? 'supplier'}`,
    category: categoryDoc._id,
    payee: po.supplier?.name,
    method,
    status: 'paid',
    amount: po.total,
    tax: po.tax ?? 0,
    taxIncluded: true,
    reference: reference ?? po.poNumber,
    purchaseOrder: po._id,
    createdBy,
  });

  po.payment = { status: 'paid', method, reference, paidAt: when, expense: expense._id };
  po.timeline.push({
    status: po.status,
    at: new Date(),
    note: `Payment recorded — ${expense.number}.`,
  });
  await po.save();

  const populated = await Expense.findById(expense._id)
    .populate('category', 'name colorToken')
    .populate('purchaseOrder', 'poNumber')
    .lean();

  return { order: shapePurchaseOrder(po.toObject()), expense: shapeExpense(populated) };
}

/**
 * Where a PO payment is filed.
 *
 * The operator's choice wins; otherwise the seeded stock category, and failing
 * that the first active one. A PO payment with nowhere to file it is refused
 * rather than filed nowhere — an expense with no category is invisible to
 * every report that groups by one.
 */
async function resolvePurchaseCategory(category) {
  if (category && isObjectId(category)) {
    const chosen = await ExpenseCategory.findById(category).lean();
    if (chosen) return chosen;
  }

  const stock = await ExpenseCategory.findOne({ slug: 'inventory-purchases' }).lean();
  if (stock) return stock;

  const first = await ExpenseCategory.findOne({ isActive: true }).sort({ order: 1 }).lean();
  if (first) return first;

  throw ApiError.badRequest(
    'No expense category exists to file this against — add one first.',
    'NO_EXPENSE_CATEGORY',
  );
}

// ---- expenses ---------------------------------------------------------------

function shapeExpense(expense) {
  return {
    id: expense._id.toString(),
    number: expense.number,
    date: expense.date,
    description: expense.description,
    category: expense.category?.name
      ? {
          id: expense.category._id.toString(),
          name: expense.category.name,
          colorToken: expense.category.colorToken ?? 'ink',
        }
      : { id: expense.category?.toString() ?? null, name: '—', colorToken: 'ink' },
    payee: expense.payee ?? null,
    method: expense.method ?? null,
    status: expense.status,
    amount: expense.amount,
    tax: expense.tax ?? 0,
    taxIncluded: expense.taxIncluded,
    reference: expense.reference ?? null,
    // A PO-generated row is labelled and links back, so an operator can tell
    // what they entered from what the system entered for them (§6.9).
    purchaseOrder: expense.purchaseOrder
      ? {
          id: (expense.purchaseOrder._id ?? expense.purchaseOrder).toString(),
          poNumber: expense.purchaseOrder.poNumber ?? null,
        }
      : null,
    notes: expense.notes ?? null,
  };
}

async function listExpenses({ q, category, status, from, to } = {}) {
  const query = {};

  if (status && status !== 'all') query.status = String(status);
  if (category && isObjectId(category)) query.category = category;

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = toDate(from);
    if (to) query.date.$lte = endOfDay(to);
  }

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ description: rx }, { payee: rx }, { reference: rx }, { number: rx }];
  }

  const expenses = await Expense.find(query)
    .sort({ date: -1 })
    .limit(300)
    .populate('category', 'name colorToken')
    .populate('purchaseOrder', 'poNumber')
    .lean();

  const shaped = expenses.map(shapeExpense);

  // The KPI row describes the **filtered** set, because that is what is on
  // screen — a total that ignored the date filter would contradict the rows
  // beneath it. The status counts are the exception and come from the whole
  // collection, for the pill rule (§6.5).
  const statusRows = await Expense.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.all = statusRows.reduce((sum, row) => sum + row.count, 0);

  return {
    expenses: shaped,
    counts,
    totals: {
      total: shaped.reduce((sum, expense) => sum + expense.amount, 0),
      entries: shaped.length,
      pending: shaped
        .filter((expense) => expense.status === 'pending')
        .reduce((sum, expense) => sum + expense.amount, 0),
      tax: shaped.reduce((sum, expense) => sum + expense.tax, 0),
    },
  };
}

async function createExpense(body, createdBy) {
  const category = await ExpenseCategory.findById(body.category).lean();
  if (!category) throw ApiError.badRequest('Pick a category.', 'CATEGORY_NOT_FOUND');

  const expense = await Expense.create({
    ...body,
    number: await nextNumber(Expense, 'number', 'EXP'),
    date: toDate(body.date, new Date()),
    createdBy,
  });

  const populated = await Expense.findById(expense._id)
    .populate('category', 'name colorToken')
    .lean();

  return { expense: shapeExpense(populated) };
}

/**
 * A PO-generated expense is owned by its purchase order and cannot be edited
 * here — the two would drift, and the P&L would be reading a number the PO no
 * longer agrees with.
 */
async function updateExpense(id, body) {
  if (!isObjectId(id)) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');

  const expense = await Expense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');

  if (expense.purchaseOrder) {
    throw ApiError.badRequest(
      'This expense belongs to a purchase order — edit it there.',
      'EXPENSE_FROM_PO',
    );
  }

  const category = await ExpenseCategory.findById(body.category).lean();
  if (!category) throw ApiError.badRequest('Pick a category.', 'CATEGORY_NOT_FOUND');

  Object.assign(expense, body, { date: toDate(body.date, expense.date) });
  await expense.save();

  const populated = await Expense.findById(expense._id)
    .populate('category', 'name colorToken')
    .lean();

  return { expense: shapeExpense(populated) };
}

async function deleteExpense(id) {
  if (!isObjectId(id)) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');

  const expense = await Expense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');

  if (expense.purchaseOrder) {
    throw ApiError.badRequest(
      'This expense belongs to a purchase order — delete it there, or it comes back the moment the PO is read.',
      'EXPENSE_FROM_PO',
    );
  }

  await expense.deleteOne();
  return { ok: true };
}

// ---- expense categories -----------------------------------------------------

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function shapeCategory(category, usage = 0) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    colorToken: category.colorToken ?? 'ink',
    gstApplicable: category.gstApplicable,
    isActive: category.isActive,
    order: category.order ?? 0,
    usage,
  };
}

/** Usage comes back with the list so the UI can explain why a delete will be
 *  refused **before** the operator clicks it, rather than after. */
async function listExpenseCategories() {
  const [categories, usageRows] = await Promise.all([
    ExpenseCategory.find({}).sort({ order: 1, name: 1 }).lean(),
    Expense.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);

  const usage = new Map(usageRows.map((row) => [String(row._id), row.count]));
  return {
    categories: categories.map((category) =>
      shapeCategory(category, usage.get(category._id.toString()) ?? 0),
    ),
  };
}

async function createExpenseCategory(body) {
  const slug = slugify(body.name);
  const clash = await ExpenseCategory.findOne({ slug }).lean();
  if (clash) throw ApiError.conflict('A category by that name already exists.', 'CATEGORY_EXISTS');

  const category = await ExpenseCategory.create({ ...body, slug });
  return { category: shapeCategory(category.toObject()) };
}

async function updateExpenseCategory(id, body) {
  if (!isObjectId(id)) throw ApiError.notFound('Category not found.', 'CATEGORY_NOT_FOUND');

  const category = await ExpenseCategory.findById(id);
  if (!category) throw ApiError.notFound('Category not found.', 'CATEGORY_NOT_FOUND');

  const slug = slugify(body.name);
  const clash = await ExpenseCategory.findOne({ slug, _id: { $ne: category._id } }).lean();
  if (clash) throw ApiError.conflict('A category by that name already exists.', 'CATEGORY_EXISTS');

  Object.assign(category, body, { slug });
  await category.save();
  return { category: shapeCategory(category.toObject()) };
}

/**
 * A category in use is deactivated, never deleted (§6.9) — deleting one would
 * silently re-bucket every historical expense that pointed at it, and the P&L
 * would change shape for a reason nobody could find later. The response says
 * which of the two happened rather than reporting a delete either way.
 */
async function deleteExpenseCategory(id) {
  if (!isObjectId(id)) throw ApiError.notFound('Category not found.', 'CATEGORY_NOT_FOUND');

  const category = await ExpenseCategory.findById(id);
  if (!category) throw ApiError.notFound('Category not found.', 'CATEGORY_NOT_FOUND');

  const usage = await Expense.countDocuments({ category: category._id });
  if (usage > 0) {
    category.isActive = false;
    await category.save();
    return {
      category: shapeCategory(category.toObject(), usage),
      deactivated: true,
      message: `${category.name} is used by ${usage} expense(s), so it has been deactivated rather than deleted.`,
    };
  }

  await category.deleteOne();
  return { ok: true, deactivated: false };
}

// ---- inventory --------------------------------------------------------------

/**
 * A row on the Inventory screen (§6.10).
 *
 * Exact quantities, reorder points and costs — all of which are admin-only. The
 * storefront's binary in stock / out of stock is produced by
 * `productService.serialize`, which is an allowlist and is untouched by
 * anything here.
 *
 * `minStock` of zero means "no reorder point set", which reads as never low
 * rather than always low; a product with no point falls back to the same
 * threshold the dashboard uses, so the two screens agree on what "low" means.
 */
function shapeInventoryRow(product) {
  const threshold = product.minStock > 0 ? product.minStock : LOW_STOCK_FALLBACK;
  const stockStatus = product.stock <= 0 ? 'out' : product.stock <= threshold ? 'low' : 'in';

  return {
    id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    slug: product.slug,
    image: product.image ?? null,
    grade: product.grade,
    partTypeLabel: product.partTypeLabel ?? product.partType,
    brandName: product.brandName ?? null,
    modelName: product.modelName ?? null,
    stock: product.stock,
    minStock: product.minStock ?? 0,
    stockStatus,
    price: product.price,
    cost: product.cost ?? 0,
    // Valued at cost, not at retail: inventory is worth what it cost to
    // acquire, and valuing it at price books a profit that has not happened
    // yet. Falls back to price when no cost is recorded, so the tile is not
    // silently zero for a catalogue that predates cost tracking.
    totalValue: product.stock * (product.cost > 0 ? product.cost : product.price),
    location: product.location ?? null,
    barcode: product.barcode ?? null,
    supplier: product.supplier?.name
      ? { id: product.supplier._id.toString(), name: product.supplier.name }
      : null,
    isActive: product.isActive,
  };
}

async function listInventory({ q, stock, brand, grade } = {}) {
  const query = {};
  if (brand) query.brandSlug = String(brand);
  if (grade) query.grade = String(grade);

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { sku: rx }, { barcode: rx }];
  }

  const products = await Product.find(query)
    .sort({ name: 1 })
    .limit(500)
    .populate('supplier', 'name')
    .lean();

  let rows = products.map(shapeInventoryRow);
  if (stock && stock !== 'all') rows = rows.filter((row) => row.stockStatus === stock);

  // The pills and the KPI row describe the whole catalogue, not the filtered
  // set: a pill reading "Low stock 0" because you are already filtered to
  // Out of stock tells the operator nothing (the invoice-pill rule, §6.5).
  const all = await Product.find({}).select('stock minStock price cost').lean();
  const classify = (product) => {
    const threshold = product.minStock > 0 ? product.minStock : LOW_STOCK_FALLBACK;
    return product.stock <= 0 ? 'out' : product.stock <= threshold ? 'low' : 'in';
  };

  const counts = { all: all.length, in: 0, low: 0, out: 0 };
  let totalStock = 0;
  let totalValue = 0;
  for (const product of all) {
    counts[classify(product)] += 1;
    totalStock += product.stock;
    totalValue += product.stock * (product.cost > 0 ? product.cost : product.price);
  }

  return {
    products: rows,
    counts,
    totals: {
      items: all.length,
      stock: totalStock,
      lowStock: counts.low,
      outOfStock: counts.out,
      value: totalValue,
    },
  };
}

async function getInventoryItem(id) {
  if (!isObjectId(id)) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  const product = await Product.findById(id).populate('supplier', 'name email phone').lean();
  if (!product) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  const [movements, purchaseOrders] = await Promise.all([
    StockMovement.find({ product: id }).sort({ createdAt: -1 }).limit(50).lean(),
    PurchaseOrder.find({ 'items.product': id })
      .sort({ orderDate: -1 })
      .limit(20)
      .populate('supplier', 'name')
      .lean(),
  ]);

  return {
    product: {
      ...shapeInventoryRow(product),
      description: product.description ?? null,
      compareAtPrice: product.compareAtPrice ?? null,
      competitors: product.competitors ?? [],
      deviceTypeName: product.deviceTypeName ?? null,
      seriesName: product.seriesName ?? null,
      partType: product.partType,
    },
    movements: movements.map((movement) => ({
      id: movement._id.toString(),
      type: movement.type,
      qtyChange: movement.qtyChange,
      qtyAfter: movement.qtyAfter,
      unitCost: movement.unitCost ?? null,
      reference: movement.reference ?? null,
      note: movement.note ?? null,
      at: movement.createdAt,
    })),
    // Price history in the sense that matters for purchasing: what this part
    // has cost, per delivery. A retail price history needs a change log the
    // catalogue does not keep yet.
    purchases: purchaseOrders.map((po) => {
      const line = po.items.find((item) => String(item.product) === String(id));
      return {
        id: po._id.toString(),
        poNumber: po.poNumber,
        supplier: po.supplier?.name ?? '—',
        orderDate: po.orderDate,
        status: po.status,
        qtyOrdered: line?.qtyOrdered ?? 0,
        qtyReceived: line?.qtyReceived ?? 0,
        unitCost: line?.unitCost ?? 0,
      };
    }),
  };
}

/** The ERP fields (§6.10). Kept apart from `updateProduct` so the catalogue
 *  form and the operations form cannot overwrite each other's fields. */
async function updateInventoryOps(id, body) {
  if (!isObjectId(id)) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  const patch = {
    minStock: body.minStock ?? 0,
    cost: body.cost ?? 0,
    location: body.location ?? null,
    barcode: body.barcode ?? null,
    supplier: body.supplier && isObjectId(body.supplier) ? body.supplier : null,
  };

  const product = await Product.findByIdAndUpdate(id, patch, { new: true })
    .populate('supplier', 'name')
    .lean();
  if (!product) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  return { product: shapeInventoryRow(product) };
}

/** A manual correction. Goes through the ledger like every other movement. */
async function adjustStock(id, { qtyChange, type, note }, createdBy) {
  if (!isObjectId(id)) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  const qtyAfter = await applyStockMovement({
    product: id,
    type,
    qtyChange,
    reference: { kind: 'manual', label: 'Manual adjustment' },
    note,
    createdBy,
  });

  const product = await Product.findById(id).populate('supplier', 'name').lean();
  return { product: shapeInventoryRow(product), qtyAfter };
}

async function listStockMovements({ product, type, from, to } = {}) {
  const query = {};
  if (product && isObjectId(product)) query.product = product;
  if (type && type !== 'all') query.type = String(type);
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = toDate(from);
    if (to) query.createdAt.$lte = endOfDay(to);
  }

  const movements = await StockMovement.find(query)
    .sort({ createdAt: -1 })
    .limit(300)
    .populate('product', 'name sku')
    .lean();

  return {
    movements: movements.map((movement) => ({
      id: movement._id.toString(),
      product: movement.product
        ? {
            id: movement.product._id.toString(),
            name: movement.product.name,
            sku: movement.product.sku,
          }
        : null,
      type: movement.type,
      qtyChange: movement.qtyChange,
      qtyAfter: movement.qtyAfter,
      unitCost: movement.unitCost ?? null,
      reference: movement.reference ?? null,
      note: movement.note ?? null,
      at: movement.createdAt,
    })),
  };
}

// --- CommonJS exports -------------------------------------------------
exports.applyStockMovement = applyStockMovement;
exports.listSuppliers = listSuppliers;
exports.getSupplier = getSupplier;
exports.createSupplier = createSupplier;
exports.updateSupplier = updateSupplier;
exports.toggleSupplier = toggleSupplier;
exports.listPurchaseOrders = listPurchaseOrders;
exports.getPurchaseOrder = getPurchaseOrder;
exports.createPurchaseOrder = createPurchaseOrder;
exports.updatePurchaseOrder = updatePurchaseOrder;
exports.setPurchaseOrderStatus = setPurchaseOrderStatus;
exports.receivePurchaseOrder = receivePurchaseOrder;
exports.recordPurchasePayment = recordPurchasePayment;
exports.listExpenses = listExpenses;
exports.createExpense = createExpense;
exports.updateExpense = updateExpense;
exports.deleteExpense = deleteExpense;
exports.listExpenseCategories = listExpenseCategories;
exports.createExpenseCategory = createExpenseCategory;
exports.updateExpenseCategory = updateExpenseCategory;
exports.deleteExpenseCategory = deleteExpenseCategory;
exports.listInventory = listInventory;
exports.getInventoryItem = getInventoryItem;
exports.updateInventoryOps = updateInventoryOps;
exports.adjustStock = adjustStock;
exports.listStockMovements = listStockMovements;
