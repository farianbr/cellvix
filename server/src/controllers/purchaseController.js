import { asyncHandler } from '../utils/ApiError.js';
import * as purchaseService from '../services/purchaseService.js';
import auditService from '../services/auditService.js';
import * as supplierPortalService from '../services/supplierPortalService.js';

/**
 * Purchase — suppliers, purchase orders, expenses, categories and inventory
 * (ERP rework §6.7–6.10).
 *
 * Thin, like every other controller here: the service owns the rules, so the
 * receiving rule and the double-payment guard cannot be bypassed by a second
 * route calling the model directly.
 */

// ---- suppliers --------------------------------------------------------------

const listSuppliers = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listSuppliers(req.query));
});

const getSupplier = asyncHandler(async (req, res) => {
  res.json(await purchaseService.getSupplier(req.params.id));
});

const createSupplier = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createSupplier(req.body));
});

const updateSupplier = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateSupplier(req.params.id, req.body));
});

/** Deactivates rather than deletes — purchase orders reference a supplier. */
const toggleSupplier = asyncHandler(async (req, res) => {
  res.json(await purchaseService.toggleSupplier(req.params.id));
});

/**
 * Send this supplier their portal link and a fresh password.
 *
 * The manual counterpart of the invite a new supplier gets automatically — for
 * the address that bounced, the contact who left, the supplier onboarded before
 * the portal existed. **Always a new password**: the stored value is a bcrypt
 * hash, so the old one cannot be read back out, and keeping a plaintext copy so
 * this button could resend it would be a worse trade than asking them to use a
 * new one.
 *
 * Audited: it is a credential being issued, and who issued it is a security
 * question. `delivered` in the response is what lets the screen say "saved, but
 * the email did not send" rather than claiming a success mail never had.
 */
const invitePortal = asyncHandler(async (req, res) => {
  const result = await supplierPortalService.invitePortal(req.params.id);

  await auditService.record({
    req,
    kind: 'security',
    action: 'supplier.portal.invite',
    entity: { kind: 'supplier', id: req.params.id, label: result.supplier.name },
    description: result.delivered
      ? `Portal credentials emailed to ${result.supplier.email}.`
      : `Portal credentials reset for ${result.supplier.email}, but the email did not send.`,
  });

  res.json(result);
});

// ---- purchase orders --------------------------------------------------------

const listPurchaseOrders = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listPurchaseOrders(req.query));
});

const getPurchaseOrder = asyncHandler(async (req, res) => {
  res.json(await purchaseService.getPurchaseOrder(req.params.id));
});

const createPurchaseOrder = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createPurchaseOrder(req.body, req.user._id));
});

const updatePurchaseOrder = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updatePurchaseOrder(req.params.id, req.body));
});

const setPurchaseOrderStatus = asyncHandler(async (req, res) => {
  res.json(await purchaseService.setPurchaseOrderStatus(req.params.id, req.body));
});

/**
 * Receiving. Partial by design — the response names what moved and what did
 * not, with a reason per skip, and the UI shows the skips rather than
 * reporting a clean success.
 */
/** Receiving moves stock, so it is audited alongside the money (§7.6). */
const receivePurchaseOrder = asyncHandler(async (req, res) => {
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
const recordPurchasePayment = asyncHandler(async (req, res) => {
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

const listExpenses = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listExpenses(req.query));
});

const createExpense = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createExpense(req.body, req.user._id));
});

const updateExpense = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateExpense(req.params.id, req.body));
});

const deleteExpense = asyncHandler(async (req, res) => {
  res.json(await purchaseService.deleteExpense(req.params.id));
});

// ---- expense categories -----------------------------------------------------

const listExpenseCategories = asyncHandler(async (_req, res) => {
  res.json(await purchaseService.listExpenseCategories());
});

const createExpenseCategory = asyncHandler(async (req, res) => {
  res.status(201).json(await purchaseService.createExpenseCategory(req.body));
});

const updateExpenseCategory = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateExpenseCategory(req.params.id, req.body));
});

/** A category in use is deactivated; the response says which happened. */
const deleteExpenseCategory = asyncHandler(async (req, res) => {
  res.json(await purchaseService.deleteExpenseCategory(req.params.id));
});

// ---- inventory --------------------------------------------------------------

const listInventory = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listInventory(req.query));
});

const getInventoryItem = asyncHandler(async (req, res) => {
  res.json(await purchaseService.getInventoryItem(req.params.id));
});

const updateInventoryOps = asyncHandler(async (req, res) => {
  res.json(await purchaseService.updateInventoryOps(req.params.id, req.body));
});

/**
 * Every stock change goes through the ledger — this one included.
 *
 * A manual adjustment is the one stock movement with no document behind it, so
 * it is also the one that most needs an actor on record: "why is this 40 and
 * not 47" is answered by the reason, and "who decided that" by this row.
 */
const adjustStock = asyncHandler(async (req, res) => {
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

const listStockMovements = asyncHandler(async (req, res) => {
  res.json(await purchaseService.listStockMovements(req.query));
});

export { listSuppliers, getSupplier, createSupplier, updateSupplier, toggleSupplier, invitePortal, listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, setPurchaseOrderStatus, receivePurchaseOrder, recordPurchasePayment, listExpenses, createExpense, updateExpense, deleteExpense, listExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, listInventory, getInventoryItem, updateInventoryOps, adjustStock, listStockMovements };
