import mongoose from 'mongoose';

import SupplierReturn, {
  SUPPLIER_RETURN_OPEN_STATUSES,
} from '../models/SupplierReturn.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Product from '../models/Product.js';
import Settings from '../models/Settings.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import { applyStockMovement } from './purchaseService.js';

/**
 * Returns to a supplier (Purchase § RMA / Returns).
 *
 * The customer-side `rmaService` is the model this follows, and the two rules it
 * enforces are the same two, pointing the other way:
 *
 *   - **Stock moves only through `applyStockMovement`.** Shipping a return takes
 *     parts off the shelf, and that decrement gets a `StockMovement` like every
 *     other — a quantity with no document behind it is one nobody can explain.
 *   - **The ladder is enforced, not trusted.** A return cannot be credited
 *     before it has been shipped, for the same reason a customer RMA cannot be
 *     resolved before the goods physically arrive.
 */

/**
 * Forward-only, with one escape.
 *
 * `rejected` is reachable from every open rung — a supplier can refuse a claim
 * the moment they hear it, not only after the parts are in their warehouse.
 * `credited` is reachable only from `shipped`: crediting something still on our
 * own shelf is the mistake the ladder exists to prevent.
 */
const TRANSITIONS = {
  draft: ['requested', 'rejected'],
  requested: ['authorised', 'rejected'],
  authorised: ['shipped', 'rejected'],
  shipped: ['credited', 'rejected'],
  credited: [],
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

/** `SRT-2026-00001`, matching the `PO-`/`EXP-` convention already in purchaseService. */
async function nextReturnNumber() {
  const year = new Date().getFullYear();
  const prefix = `SRT-${year}-`;
  const last = await SupplierReturn.findOne({ returnNumber: new RegExp(`^${prefix}`) })
    .sort({ returnNumber: -1 })
    .select('returnNumber')
    .lean();

  const sequence = last ? Number(last.returnNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(5, '0')}`;
}

/**
 * Age in whole days, and whether it has passed the SLA.
 *
 * Stops counting once the return closes, exactly as RMA age does: a claim
 * settled in two days should not still be accruing age six months later, and a
 * closed row shouting for attention teaches an operator to ignore the column.
 */
function ageOf(row, slaDays) {
  const closed = ['credited', 'rejected'].includes(row.status);
  const until = closed ? new Date(row.updatedAt) : new Date();
  const days = Math.max(0, Math.floor((until - new Date(row.createdAt)) / 86_400_000));

  return { days, overSla: !closed && days > slaDays, closed };
}

function expectedCreditOf(row) {
  return (row.items ?? []).reduce((sum, item) => sum + (item.unitCost ?? 0) * item.qty, 0);
}

function shape(row, slaDays) {
  const age = ageOf(row, slaDays);
  const expected = row.expectedCredit || expectedCreditOf(row);

  return {
    id: row._id.toString(),
    returnNumber: row.returnNumber,
    supplier: row.supplier?.name
      ? { id: row.supplier._id.toString(), name: row.supplier.name }
      : { id: row.supplier?.toString() ?? null, name: row.supplierName ?? '—' },
    supplierName: row.supplierName ?? row.supplier?.name ?? '—',
    purchaseOrder: row.purchaseOrder
      ? {
          id: (row.purchaseOrder._id ?? row.purchaseOrder).toString(),
          number: row.purchaseOrder.poNumber ?? row.purchaseOrderNumber ?? null,
        }
      : null,
    purchaseOrderNumber: row.purchaseOrderNumber ?? row.purchaseOrder?.poNumber ?? null,
    status: row.status,
    items: (row.items ?? []).map((item) => ({
      product: item.product?.toString() ?? null,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      unitCost: item.unitCost ?? 0,
      lineValue: (item.unitCost ?? 0) * item.qty,
      reason: item.reason,
      note: item.note ?? null,
      shipped: Boolean(item.shippedAt),
    })),
    itemCount: (row.items ?? []).length,
    qty: (row.items ?? []).reduce((sum, item) => sum + item.qty, 0),
    reason: row.reason ?? null,
    supplierRmaNumber: row.supplierRmaNumber ?? null,
    expectedCredit: expected,
    creditAmount: row.creditAmount ?? 0,
    // The gap between what was claimed and what was given — the figure that
    // makes a short-paid claim visible instead of quietly absorbed.
    creditShortfall: row.status === 'credited' ? expected - (row.creditAmount ?? 0) : 0,
    creditReference: row.creditReference ?? null,
    creditedAt: row.creditedAt ?? null,
    carrier: row.carrier ?? null,
    trackingNumber: row.trackingNumber ?? null,
    notes: row.notes ?? null,
    age: age.days,
    overSla: age.overSla,
    closed: age.closed,
    timeline: (row.timeline ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at,
      note: entry.note ?? null,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---- read -------------------------------------------------------------------

async function listReturns({ q, status, supplier, from, to } = {}) {
  const settings = await Settings.load();
  const slaDays = settings?.operations?.rmaSlaDays ?? 14;

  const query = {};

  if (status === 'open') query.status = { $in: SUPPLIER_RETURN_OPEN_STATUSES };
  else if (status === 'overdue') query.status = { $in: SUPPLIER_RETURN_OPEN_STATUSES };
  else if (status && status !== 'all') query.status = String(status);

  if (supplier && isObjectId(supplier)) query.supplier = supplier;

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = toDate(from);
    if (to) query.createdAt.$lte = endOfDay(to);
  }

  if (q) {
    const rx = likeRegex(q);
    query.$or = [
      { returnNumber: rx },
      { supplierName: rx },
      { purchaseOrderNumber: rx },
      { supplierRmaNumber: rx },
    ];
  }

  const rows = await SupplierReturn.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('supplier', 'name')
    .populate('purchaseOrder', 'poNumber')
    .lean();

  let shaped = rows.map((row) => shape(row, slaDays));

  // `overdue` is a reading of age, so it cannot be a Mongo filter — applied
  // after shaping, on the same computation the Age column shows.
  if (status === 'overdue') shaped = shaped.filter((row) => row.overSla);

  const [statusRows, openRows] = await Promise.all([
    SupplierReturn.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SupplierReturn.find({ status: { $in: SUPPLIER_RETURN_OPEN_STATUSES } })
      .select('createdAt status updatedAt')
      .lean(),
  ]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.all = rows.length;
  counts.open = openRows.length;
  counts.overdue = openRows.filter((row) => ageOf(row, slaDays).overSla).length;

  // What is still owed to us: claims raised and not yet credited.
  const outstanding = shaped
    .filter((row) => !row.closed)
    .reduce((sum, row) => sum + row.expectedCredit, 0);

  return { returns: shaped, counts, slaDays, outstanding };
}

async function getReturn(id) {
  const settings = await Settings.load();
  const slaDays = settings?.operations?.rmaSlaDays ?? 14;

  const query = isObjectId(id) ? { _id: id } : { returnNumber: String(id) };
  const row = await SupplierReturn.findOne(query)
    .populate('supplier', 'name email phone contactName')
    .populate('purchaseOrder', 'poNumber total status')
    .lean();

  if (!row) throw ApiError.notFound('Return not found.', 'SUPPLIER_RETURN_NOT_FOUND');

  return { supplierReturn: shape(row, slaDays) };
}

// ---- write ------------------------------------------------------------------

/**
 * Open a return against a supplier.
 *
 * Costs are snapshotted from the purchase order where one is named, and from
 * the product otherwise — a supplier credits what was paid, and reading a live
 * cost later would change the expected credit every time they moved a price.
 */
async function createReturn(body, createdBy) {
  const supplier = await Supplier.findById(body.supplier).select('name').lean();
  if (!supplier) throw ApiError.badRequest('That supplier does not exist.', 'SUPPLIER_NOT_FOUND');

  let po = null;
  if (body.purchaseOrder) {
    po = await PurchaseOrder.findById(body.purchaseOrder).select('poNumber items supplier').lean();
    if (!po) throw ApiError.badRequest('That purchase order does not exist.', 'PO_NOT_FOUND');
    if (String(po.supplier) !== String(supplier._id)) {
      throw ApiError.badRequest(
        `${po.poNumber} belongs to a different supplier.`,
        'PO_SUPPLIER_MISMATCH',
      );
    }
  }

  const costByProduct = new Map(
    (po?.items ?? []).map((item) => [String(item.product), item.unitCost ?? 0]),
  );

  const products = await Product.find({ _id: { $in: body.items.map((line) => line.product) } })
    .select('sku name cost')
    .lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));

  const items = body.items.map((line) => {
    const product = byId.get(String(line.product));
    if (!product) {
      throw ApiError.badRequest('One of those products no longer exists.', 'PRODUCT_NOT_FOUND');
    }

    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      qty: line.qty,
      // The PO's cost wins where there is one; the product's own cost is the
      // fallback for a fault found without paperwork.
      unitCost: costByProduct.get(String(product._id)) ?? product.cost ?? 0,
      reason: line.reason ?? 'faulty',
      note: line.note,
    };
  });

  const row = await SupplierReturn.create({
    returnNumber: await nextReturnNumber(),
    supplier: supplier._id,
    supplierName: supplier.name,
    purchaseOrder: po?._id,
    purchaseOrderNumber: po?.poNumber,
    status: 'draft',
    items,
    reason: body.reason,
    supplierRmaNumber: body.supplierRmaNumber,
    expectedCredit: items.reduce((sum, item) => sum + item.unitCost * item.qty, 0),
    notes: body.notes,
    timeline: [{ status: 'draft', at: new Date(), note: 'Return opened.' }],
    createdBy,
  });

  return getReturn(row._id);
}

/**
 * Move a return along the ladder.
 *
 * **`shipped` is where stock actually leaves**, and it is idempotent per line:
 * a line already carrying `shippedAt` is not decremented again, so a repeated
 * save cannot take the same parts off the shelf twice.
 */
async function setStatus(id, { status, note, carrier, trackingNumber }, actor) {
  const query = isObjectId(id) ? { _id: id } : { returnNumber: String(id) };
  const row = await SupplierReturn.findOne(query);
  if (!row) throw ApiError.notFound('Return not found.', 'SUPPLIER_RETURN_NOT_FOUND');

  const allowed = TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `A ${row.status} return cannot move to ${status}.`,
      'ILLEGAL_TRANSITION',
    );
  }

  if (status === 'shipped') {
    for (const item of row.items) {
      if (item.shippedAt) continue;

      await applyStockMovement({
        product: item.product,
        type: 'return',
        // Negative: these parts are leaving the building.
        qtyChange: -item.qty,
        unitCost: item.unitCost,
        reference: { kind: 'manual', label: row.returnNumber },
        note: `Returned to ${row.supplierName}`,
        createdBy: actor,
      });

      item.shippedAt = new Date();
    }

    if (carrier) row.carrier = carrier;
    if (trackingNumber) row.trackingNumber = trackingNumber;
  }

  row.status = status;
  row.timeline.push({ status, at: new Date(), note });
  await row.save();

  return getReturn(row._id);
}

/**
 * Record the credit the supplier actually gave.
 *
 * Separate from the status move because the amount is the point: a supplier who
 * credits less than was claimed is the case worth seeing, and `creditShortfall`
 * exists so it is visible rather than absorbed.
 */
async function recordCredit(id, { amount, reference, note }, _actor) {
  const query = isObjectId(id) ? { _id: id } : { returnNumber: String(id) };
  const row = await SupplierReturn.findOne(query);
  if (!row) throw ApiError.notFound('Return not found.', 'SUPPLIER_RETURN_NOT_FOUND');

  if (row.status !== 'shipped') {
    throw ApiError.badRequest(
      'A return is credited once it has been shipped back — nothing has left yet.',
      'NOT_SHIPPED',
    );
  }

  row.creditAmount = amount;
  row.creditReference = reference;
  row.creditedAt = new Date();
  row.status = 'credited';
  row.timeline.push({
    status: 'credited',
    at: new Date(),
    note: note ?? `Credited ${(amount / 100).toFixed(2)}.`,
  });

  await row.save();
  return getReturn(row._id);
}

async function deleteReturn(id) {
  const query = isObjectId(id) ? { _id: id } : { returnNumber: String(id) };
  const row = await SupplierReturn.findOne(query);
  if (!row) throw ApiError.notFound('Return not found.', 'SUPPLIER_RETURN_NOT_FOUND');

  // Once stock has moved there is a `StockMovement` pointing at this number;
  // deleting the row would leave that movement referring to nothing.
  if (row.items.some((item) => item.shippedAt)) {
    throw ApiError.badRequest(
      `${row.returnNumber} has already shipped — it cannot be deleted without orphaning its stock movements.`,
      'ALREADY_SHIPPED',
    );
  }

  await row.deleteOne();
  return { ok: true };
}

export { listReturns, getReturn, createReturn, setStatus, recordCredit, deleteReturn };
