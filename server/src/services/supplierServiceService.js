import mongoose from 'mongoose';

import SupplierService, {
  CYCLE_DAYS,
} from '../models/SupplierService.js';
import { db } from '../db/models.js';
import '../models/Supplier.js';
import '../models/ExpenseCategory.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import * as purchaseService from './purchaseService.js';

/**
 * Bought-in services and supplier subscriptions (Purchase § Service Products,
 * § Subscription Plans).
 *
 * **Recording a charge creates a real `Expense`.** It does not accumulate a
 * private total, and there is no second money path: the P&L, the expense report
 * and the tax report all read `Expense`, so a cost that lived only here would
 * be a cost the business could not see. This is the same rule
 * `storeCreditService` holds for credit and `applyStockMovement` holds for
 * stock, applied to money out.
 *
 * **A cancelled plan is dated, not deleted.** "When did we stop paying for
 * this" is a question somebody asks six months later, and a deleted row cannot
 * answer it — while the expenses it already generated stay where they are,
 * because they really were spent.
 */

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value ?? ''));
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

/** Whole days from today to `target`, both zeroed to local midnight. */
function daysUntil(target) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setHours(0, 0, 0, 0);

  return Math.round((end - start) / 86_400_000);
}

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day westward. */
function isoDay(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * The next renewal after `from`.
 *
 * `one_off` never renews, so it answers `null` rather than a date nobody should
 * act on — a renewals board showing a one-time setup fee due again next month
 * would have somebody paying it twice.
 */
function advance(from, billing) {
  const days = CYCLE_DAYS[billing];
  if (!days) return null;

  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

function shape(row) {
  const cancelled = Boolean(row.cancelledAt);
  const recurring = row.billing !== 'one_off';

  /**
   * Days until renewal, negative once it is past. Only meaningful for a live
   * recurring plan; everything else answers `null` so the UI can say "not
   * applicable" rather than printing a misleading zero.
   *
   * Measured **whole day to whole day**, not by elapsed milliseconds. A plan
   * due at 00:00 today is due *today* — comparing timestamps made it a fraction
   * of a day in the past, which `Math.ceil` rendered as `-0` and which read as
   * neither due nor overdue on every board that asked. Zeroing both sides to
   * local midnight makes "today" a clean 0.
   */
  const dueInDays =
    recurring && !cancelled && row.nextRenewalAt ? daysUntil(row.nextRenewalAt) : null;

  return {
    id: row._id.toString(),
    name: row.name,
    code: row.code ?? null,
    description: row.description ?? null,
    supplier: row.supplier?.name
      ? { id: row.supplier._id.toString(), name: row.supplier.name }
      : { id: row.supplier?.toString() ?? null, name: row.supplierName ?? '—' },
    supplierName: row.supplierName ?? row.supplier?.name ?? '—',
    amount: row.amount ?? 0,
    billing: row.billing,
    recurring,
    category: row.category?.name
      ? {
          id: row.category._id.toString(),
          name: row.category.name,
          colorToken: row.category.colorToken ?? 'ink',
        }
      : { id: row.category?.toString() ?? null, name: '—', colorToken: 'ink' },
    startedAt: row.startedAt ?? null,
    nextRenewalAt: recurring && !cancelled ? (row.nextRenewalAt ?? null) : null,
    dueInDays,
    overdue: dueInDays != null && dueInDays < 0,
    cancelledAt: row.cancelledAt ?? null,
    cancelled,
    reference: row.reference ?? null,
    notes: row.notes ?? null,
    isActive: row.isActive !== false && !cancelled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * What a set of plans costs per year, for the KPI row.
 *
 * One-off items are excluded rather than counted once: they are not an annual
 * commitment, and folding them in would make the figure mean two things at once.
 */
function annualisedCost(rows) {
  return rows.reduce((sum, row) => {
    if (row.cancelled || !row.recurring) return sum;
    if (row.billing === 'monthly') return sum + row.amount * 12;
    if (row.billing === 'quarterly') return sum + row.amount * 4;
    if (row.billing === 'yearly') return sum + row.amount;
    return sum;
  }, 0);
}

// ---- read -------------------------------------------------------------------

/**
 * `kind` splits the two screens over one collection: `subscription` is anything
 * that repeats, `service` is anything that does not.
 */
async function listServices({ q, kind, supplier, status } = {}) {
  const query = {};

  if (kind === 'subscription') query.billing = { $ne: 'one_off' };
  else if (kind === 'service') query.billing = 'one_off';

  if (supplier && isObjectId(supplier)) query.supplier = supplier;

  if (status === 'active') query.cancelledAt = null;
  else if (status === 'cancelled') query.cancelledAt = { $ne: null };

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { code: rx }, { supplierName: rx }, { reference: rx }];
  }

  const rows = await SupplierService.find(query)
    .sort({ name: 1 })
    .limit(200)
    .populate('supplier', 'name')
    .populate('category', 'name colorToken')
    .lean();

  let shaped = rows.map(shape);

  // `due` is a reading of the renewal date, so it cannot be a Mongo filter —
  // applied after shaping, on the same computation the Due column shows.
  if (status === 'due') {
    shaped = shaped.filter((row) => row.dueInDays != null && row.dueInDays <= 14);
  }

  const live = shaped.filter((row) => !row.cancelled);

  return {
    services: shaped,
    counts: {
      all: shaped.length,
      active: live.length,
      cancelled: shaped.length - live.length,
      due: live.filter((row) => row.dueInDays != null && row.dueInDays <= 14).length,
      overdue: live.filter((row) => row.overdue).length,
    },
    annualised: annualisedCost(live),
  };
}

async function getService(id) {
  const row = await SupplierService.findById(id)
    .populate('supplier', 'name email phone')
    .populate('category', 'name colorToken')
    .lean();

  if (!row) throw ApiError.notFound('Not found.', 'SUPPLIER_SERVICE_NOT_FOUND');
  return { service: shape(row) };
}

// ---- write ------------------------------------------------------------------

async function createService(body, createdBy) {
  const supplier = await db().Supplier.findById(body.supplier).select('name').lean();
  if (!supplier) throw ApiError.badRequest('That supplier does not exist.', 'SUPPLIER_NOT_FOUND');

  const category = await db().ExpenseCategory.findById(body.category).select('_id').lean();
  if (!category) throw ApiError.badRequest('Pick an expense category.', 'CATEGORY_NOT_FOUND');

  const startedAt = toDate(body.startedAt, new Date());
  const recurring = body.billing !== 'one_off';

  const row = await SupplierService.create({
    name: body.name,
    code: body.code,
    description: body.description,
    supplier: supplier._id,
    supplierName: supplier.name,
    amount: body.amount,
    billing: body.billing,
    category: category._id,
    startedAt: recurring ? startedAt : undefined,
    // A plan is due one cycle after it starts, unless a first renewal is named.
    nextRenewalAt: recurring ? (toDate(body.nextRenewalAt) ?? advance(startedAt, body.billing)) : undefined,
    reference: body.reference,
    notes: body.notes,
    createdBy,
  });

  return getService(row._id);
}

async function updateService(id, body) {
  const row = await SupplierService.findById(id);
  if (!row) throw ApiError.notFound('Not found.', 'SUPPLIER_SERVICE_NOT_FOUND');

  if (body.supplier && String(body.supplier) !== String(row.supplier)) {
    const supplier = await db().Supplier.findById(body.supplier).select('name').lean();
    if (!supplier) throw ApiError.badRequest('That supplier does not exist.', 'SUPPLIER_NOT_FOUND');
    row.supplier = supplier._id;
    row.supplierName = supplier.name;
  }

  if (body.category) {
    const category = await db().ExpenseCategory.findById(body.category).select('_id').lean();
    if (!category) throw ApiError.badRequest('Pick an expense category.', 'CATEGORY_NOT_FOUND');
    row.category = category._id;
  }

  for (const field of ['name', 'amount', 'billing']) {
    if (body[field] != null) row[field] = body[field];
  }
  for (const field of ['code', 'description', 'reference', 'notes']) {
    if (body[field] != null) row[field] = body[field] || undefined;
  }

  if (body.nextRenewalAt) row.nextRenewalAt = toDate(body.nextRenewalAt);

  // Moving a plan to one-off drops its renewal date rather than leaving a
  // stale one behind that a renewals board would still act on.
  if (row.billing === 'one_off') {
    row.nextRenewalAt = undefined;
    row.startedAt = undefined;
  }

  await row.save();
  return getService(row._id);
}

/**
 * Record a charge against a plan or a service.
 *
 * **The expense is the artefact.** This writes a real `Expense` through
 * `purchaseService.createExpense`, so the charge appears in the expense list,
 * the P&L and the tax report exactly as a hand-entered one does — there is no
 * private total here for the reports to miss.
 *
 * Recurring plans then advance by one cycle. The advance is computed from the
 * **due date, not from today**: a plan paid three days late is still due on the
 * same day next month, and advancing from today would let a renewal date drift
 * forward every time somebody was slow.
 */
async function recordCharge(id, body, createdBy) {
  const row = await SupplierService.findById(id).populate('supplier', 'name').lean();
  if (!row) throw ApiError.notFound('Not found.', 'SUPPLIER_SERVICE_NOT_FOUND');

  if (row.cancelledAt) {
    throw ApiError.badRequest(
      `${row.name} was cancelled — reactivate it before recording another charge.`,
      'SERVICE_CANCELLED',
    );
  }

  const amount = body.amount ?? row.amount;
  const date = toDate(body.date, new Date());

  const { expense } = await purchaseService.createExpense(
    {
      // Always a real `YYYY-MM-DD`: `createExpense` tolerates an absent date,
      // but an expense dated by whichever server handled the request is a row
      // nobody can reconcile against a statement.
      date: body.date ?? isoDay(date),
      description: body.description || `${row.name} — ${row.supplierName}`,
      category: String(row.category),
      payee: row.supplierName,
      method: body.method,
      status: 'paid',
      amount,
      tax: body.tax ?? 0,
      taxIncluded: body.taxIncluded !== false,
      reference: body.reference || row.reference || undefined,
    },
    createdBy,
  );

  if (row.billing !== 'one_off') {
    const from = row.nextRenewalAt ? new Date(row.nextRenewalAt) : date;
    await SupplierService.updateOne(
      { _id: row._id },
      { $set: { nextRenewalAt: advance(from, row.billing) } },
    );
  }

  const refreshed = await getService(row._id);
  return { ...refreshed, expense };
}

/**
 * Cancel or reactivate.
 *
 * Dated rather than deleted, and the expenses already generated stay exactly
 * where they are — they really were spent, and a cancellation does not unspend
 * them.
 */
async function setCancelled(id, cancelled) {
  const row = await SupplierService.findById(id);
  if (!row) throw ApiError.notFound('Not found.', 'SUPPLIER_SERVICE_NOT_FOUND');

  row.cancelledAt = cancelled ? new Date() : undefined;
  row.isActive = !cancelled;

  // Reactivating a recurring plan with a renewal date in the past would put it
  // straight onto the overdue board for a period nobody was charged for, so it
  // restarts from today.
  if (!cancelled && row.billing !== 'one_off') {
    const due = row.nextRenewalAt ? new Date(row.nextRenewalAt) : null;
    if (!due || due < new Date()) row.nextRenewalAt = advance(new Date(), row.billing);
  }

  await row.save();
  return getService(row._id);
}

async function deleteService(id) {
  const row = await SupplierService.findById(id);
  if (!row) throw ApiError.notFound('Not found.', 'SUPPLIER_SERVICE_NOT_FOUND');

  await row.deleteOne();
  return { ok: true };
}

export { listServices, getService, createService, updateService, recordCharge, setCancelled, deleteService };
