import { asyncHandler } from '../utils/ApiError.js';
import * as purchaseService from '../services/purchaseService.js';
import * as auditService from '../services/auditService.js';

/**
 * Purchase — suppliers, purchase orders, expenses, categories and inventory
 * (ERP rework §6.7–6.10).
 *
 * Thin, like every other controller here: the service owns the rules, so the
 * receiving rule and the double-payment guard cannot be bypassed by a second
 * route calling the model directly.
 */

// ---- suppliers --------------------------------------------------------------

export const listSuppliers = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listSuppliers(req.query));
});

export const getSupplier = asyncHandler(async (req, res) => {
  res.json(await purchaseService.getSupplier(req.params.id));
});

export const createSupplier = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createSupplier(req.body));
});

export const updateSupplier = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateSupplier(req.params.id, req.body));
});

/** Deactivates rather than deletes — purchase orders reference a supplier. */
export const toggleSupplier = asyncHandler(async (req, res) => {
  res.json(await purchaseService.toggleSupplier(req.params.id));
});

// ---- purchase orders --------------------------------------------------------

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listPurchaseOrders(req.query));
});

export const getPurchaseOrder = asyncHandler(async (req, res) => {
  res.json(await purchaseService.getPurchaseOrder(req.params.id));
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createPurchaseOrder(req.body, req.user._id));
});

export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updatePurchaseOrder(req.params.id, req.body));
});

export const setPurchaseOrderStatus = asyncHandler(async (req, res) => {
  res.json(await purchaseService.setPurchaseOrderStatus(req.params.id, req.body));
});

/**
 * Receiving. Partial by design — the response names what moved and what did
 * not, with a reason per skip, and the UI shows the skips rather than
 * reporting a clean success.
 */
/** Receiving moves stock, so it is audited alongside the money (§7.6). */
export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const result = await purchaseService.receivePurchaseOrder(req.params.id, req.body, req.user._id);
  const po = result?.order;

  await auditService.record({
    req,
    action: 'purchase_order.receive',
    entity: { kind: 'purchaseOrder', id: req.params.id, label: po?.poNumber ?? '' },
    // What actually moved, from the service's own answer — `received` and
    // `skipped` are named in the response precisely because a partial receive
    // is normal, and the log should record which it was.
    after: {
      status: po?.status ?? null,
      received: result?.received ?? null,
      skipped: result?.skipped ?? null,
    },
    description: `Received stock against ${po?.poNumber ?? req.params.id}.`,
  });

  res.json(result);
});

/**
 * Creates the `Expense` row, once. A second call is refused by the service.
 *
 * Named in §7.6 as money-moving, so it is always audited with actor and IP.
 */
export const recordPurchasePayment = asyncHandler(async (req, res) => {
  const result = await purchaseService.recordPurchasePayment(
    req.params.id,
    req.body,
    req.user._id,
  );
  const po = result?.order;

  await auditService.record({
    req,
    action: 'purchase_order.payment',
    entity: { kind: 'purchaseOrder', id: req.params.id, label: po?.poNumber ?? '' },
    after: {
      amount: req.body?.amount ?? null,
      method: req.body?.method ?? '',
      reference: req.body?.reference ?? '',
      status: po?.payment?.status ?? null,
      // The expense this created, so the two halves of one transaction can be
      // found from either side.
      expense: result?.expense?.id ?? null,
    },
    description: `Recorded a payment against ${po?.poNumber ?? req.params.id}.`,
  });

  res.status(201).json(result);
});

// ---- expenses ---------------------------------------------------------------

export const listExpenses = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listExpenses(req.query));
});

export const createExpense = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createExpense(req.body, req.user._id));
});

export const updateExpense = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateExpense(req.params.id, req.body));
});

export const deleteExpense = asyncHandler(async (req, res) => {
  res.json(await purchaseService.deleteExpense(req.params.id));
});

// ---- expense categories -----------------------------------------------------

export const listExpenseCategories = asyncHandler(async (_req, res) => {
  res.json(await purchaseService.listExpenseCategories());
});

export const createExpenseCategory = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createExpenseCategory(req.body));
});

export const updateExpenseCategory = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateExpenseCategory(req.params.id, req.body));
});

/** A category in use is deactivated; the response says which happened. */
export const deleteExpenseCategory = asyncHandler(async (req, res) => {
  res.json(await purchaseService.deleteExpenseCategory(req.params.id));
});

// ---- inventory --------------------------------------------------------------

export const listInventory = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listInventory(req.query));
});

export const getInventoryItem = asyncHandler(async (req, res) => {
  res.json(await purchaseService.getInventoryItem(req.params.id));
});

export const updateInventoryOps = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateInventoryOps(req.params.id, req.body));
});

/**
 * Every stock change goes through the ledger — this one included.
 *
 * A manual adjustment is the one stock movement with no document behind it, so
 * it is also the one that most needs an actor on record: "why is this 40 and
 * not 47" is answered by the reason, and "who decided that" by this row.
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const result = await purchaseService.adjustStock(req.params.id, req.body, req.user._id);

  await auditService.record({
    req,
    action: 'stock.adjust',
    entity: { kind: 'product', id: req.params.id, label: result?.product?.sku ?? '' },
    after: {
      qtyChange: req.body?.qtyChange ?? null,
      type: req.body?.type ?? '',
      note: req.body?.note ?? '',
      qtyAfter: result?.qtyAfter ?? null,
    },
    description: `Adjusted stock for ${result?.product?.sku ?? req.params.id}.`,
  });

  res.status(201).json(result);
});

export const listStockMovements = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listStockMovements(req.query));
});
