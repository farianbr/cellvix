import { asyncHandler } from '../utils/ApiError.js';
import * as purchaseService from '../services/purchaseService.js';

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
export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  res.json(await purchaseService.receivePurchaseOrder(req.params.id, req.body, req.user._id));
});

/** Creates the `Expense` row, once. A second call is refused by the service. */
export const recordPurchasePayment = asyncHandler(async (req, res) => {
  res.status(201).json(
    await purchaseService.recordPurchasePayment(req.params.id, req.body, req.user._id),
  );
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

/** Every stock change goes through the ledger — this one included. */
export const adjustStock = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.adjustStock(req.params.id, req.body, req.user._id));
});

export const listStockMovements = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listStockMovements(req.query));
});
