import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import env from '../config/env.js';

import * as authController from '../controllers/authController.js';
import * as productController from '../controllers/productController.js';
import * as taxonomyController from '../controllers/taxonomyController.js';
import * as cartController from '../controllers/cartController.js';
import * as orderController from '../controllers/orderController.js';
import * as accountController from '../controllers/accountController.js';
import * as adminController from '../controllers/adminController.js';
import * as purchaseController from '../controllers/purchaseController.js';
import * as reportController from '../controllers/reportController.js';
import * as salesController from '../controllers/salesController.js';
import * as contactController from '../controllers/contactController.js';
import * as contentController from '../controllers/contentController.js';

import validate from '../middleware/validate.js';
import { requireAuth, requireApproved, requireAdmin, denyAdmin } from '../middleware/auth.js';
import { loginSchema, registerSchema, forgotPasswordSchema } from '../../../shared/schemas/auth.js';
import {
  addItemSchema,
  setQtySchema,
  mergeCartSchema,
  saveCartSchema,
  addBundleSchema,
  setBundleQtySchema,
  promoCodeSchema,
} from '../../../shared/schemas/cart.js';
import { checkoutSchema } from '../../../shared/schemas/checkout.js';
import {
  profileSchema,
  savedAddressSchema,
  paymentMethodSchema,
  bulkAddSchema,
  changePasswordSchema,
  rechargeSchema,
} from '../../../shared/schemas/account.js';
import {
  approveUserSchema,
  rejectUserSchema,
  creditSchema,
  refundSchema,
  storeCreditSchema,
  userStatusSchema,
  productSchema,
  orderStatusSchema,
  invoicePaymentSchema,
  invoiceVoidSchema,
  bulkOrderStatusSchema,
  supplierSchema,
  purchaseOrderSchema,
  purchaseOrderStatusSchema,
  purchaseReceiveSchema,
  purchasePaymentSchema,
  expenseSchema,
  expenseCategorySchema,
  stockAdjustSchema,
  productOpsSchema,
  quoteSchema,
  quoteStatusSchema,
  quoteConvertSchema,
  rmaSchema,
  rmaStatusSchema,
  rmaInspectSchema,
  rmaResolveSchema,
} from '../../../shared/schemas/admin.js';
import { contactSchema } from '../../../shared/schemas/contact.js';
import { blogPostSchema, faqSchema, offerSchema } from '../../../shared/schemas/content.js';

const router = Router();

// Credential endpoints are the only ones worth rate-limiting at this stage.
// The screenshot runner signs in once per scenario, so a production-tight limit
// would throttle a local capture run rather than an attacker.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 40 : 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again shortly.' } },
});

router.get('/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

// --- auth ------------------------------------------------------------------
router.post('/auth/register', authLimiter, validate(registerSchema), authController.register);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.post('/auth/logout', authController.logout);
// Deliberately not `requireAuth`: a guest is a valid answer here, see the controller.
router.get('/auth/me', authController.me);
router.post(
  '/auth/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

// --- contact ---------------------------------------------------------------
// Open to guests; rate-limited because it is an unauthenticated write.
router.post('/contact', authLimiter, validate(contactSchema), contactController.submit);

// --- catalogue -------------------------------------------------------------
router.get('/taxonomy', taxonomyController.tree);
router.get('/products', productController.list);
router.get('/products/search', productController.search);
router.get('/products/:slug', productController.detail);

// --- editorial content -----------------------------------------------------
// Open to guests. Offers read `req.user` (attached by `authenticate` in app.js)
// so the price gate can hide bundle economics from anyone unapproved.
router.get('/blog', contentController.listPosts);
router.get('/blog/:slug', contentController.getPost);
router.get('/faq', contentController.listFaqs);
router.get('/offers', contentController.listOffers);
router.get('/offers/:slug', contentController.getOffer);

// --- cart ------------------------------------------------------------------
// Signed in is enough to hold a cart; approval is only needed to check out.
router.get('/cart', requireAuth, denyAdmin, cartController.get);
router.post('/cart/items', requireAuth, denyAdmin, validate(addItemSchema), cartController.addItem);
router.patch('/cart/items/:productId', requireAuth, denyAdmin, validate(setQtySchema), cartController.setQty);
router.delete('/cart/items/:productId', requireAuth, denyAdmin, cartController.removeItem);
router.post('/cart/merge', requireAuth, denyAdmin, validate(mergeCartSchema), cartController.merge);
router.post('/cart/save', requireAuth, denyAdmin, validate(saveCartSchema), cartController.save);
router.delete('/cart', requireAuth, denyAdmin, cartController.clear);

// Combos and promo codes are priced things, so they need approval — a pending
// business can still hold loose parts in its cart while it waits.
router.post('/cart/bundles', requireAuth, denyAdmin, requireApproved, validate(addBundleSchema), cartController.addBundle);
router.patch('/cart/bundles/:offerId', requireAuth, denyAdmin, requireApproved, validate(setBundleQtySchema), cartController.setBundleQty);
router.delete('/cart/bundles/:offerId', requireAuth, denyAdmin, requireApproved, cartController.removeBundle);
router.post('/cart/promo', requireAuth, denyAdmin, requireApproved, validate(promoCodeSchema), cartController.applyPromo);
router.delete('/cart/promo', requireAuth, denyAdmin, requireApproved, cartController.clearPromo);

// Saved carts and the quick order pad need trade pricing, so they are gated.
router.get('/cart/saved', requireAuth, denyAdmin, requireApproved, cartController.listSaved);
router.post('/cart/saved/:savedCartId/restore', requireAuth, denyAdmin, requireApproved, cartController.restoreSaved);
router.delete('/cart/saved/:savedCartId', requireAuth, denyAdmin, requireApproved, cartController.deleteSaved);
router.post('/cart/bulk', requireAuth, denyAdmin, requireApproved, validate(bulkAddSchema), cartController.bulkAdd);

// --- orders ----------------------------------------------------------------
router.get('/orders/quote', requireAuth, denyAdmin, requireApproved, orderController.quote);
router.post('/orders', requireAuth, denyAdmin, requireApproved, validate(checkoutSchema), orderController.create);
router.get('/orders', requireAuth, denyAdmin, requireApproved, orderController.list);
router.get('/orders/:orderNumber', requireAuth, denyAdmin, requireApproved, orderController.detail);

// --- account ---------------------------------------------------------------
const account = [requireAuth, denyAdmin, requireApproved];

router.get('/account/summary', ...account, accountController.summary);
router.patch('/account/profile', ...account, validate(profileSchema), accountController.updateProfile);

router.post('/account/addresses', ...account, validate(savedAddressSchema), accountController.addAddress);
router.patch('/account/addresses/:addressId', ...account, validate(savedAddressSchema), accountController.updateAddress);
router.delete('/account/addresses/:addressId', ...account, accountController.removeAddress);

router.post('/account/payment-methods', ...account, validate(paymentMethodSchema), accountController.addPaymentMethod);
router.delete('/account/payment-methods/:methodId', ...account, accountController.removePaymentMethod);

// Password change is available to any signed-in user, approved or not — and
// deliberately not denyAdmin: it is the only way a staff account changes its
// own password, and it touches no buyer data.
router.post('/account/password', requireAuth, validate(changePasswordSchema), accountController.changePassword);

// Store credit: the statement, and the advance recharge that adds to it.
router.get('/account/store-credit', ...account, accountController.storeCredit);
// Line-of-credit movements, reconstructed from the invoices behind them.
router.get('/account/credit-activity', ...account, accountController.creditActivity);
router.post('/account/store-credit/recharge', ...account, validate(rechargeSchema), accountController.rechargeStoreCredit);

router.get('/invoices', ...account, accountController.listInvoices);
router.get('/invoices/:number', ...account, accountController.getInvoice);
router.get('/invoices/:number/document', ...account, accountController.invoiceDocument);

// --- admin -----------------------------------------------------------------
const admin = [requireAuth, requireAdmin];

router.get('/admin/stats', ...admin, adminController.stats);

router.get('/admin/users', ...admin, adminController.listUsers);
router.get('/admin/users/:id', ...admin, adminController.getUser);
router.patch('/admin/users/:id/approve', ...admin, validate(approveUserSchema), adminController.approveUser);
router.patch('/admin/users/:id/reject', ...admin, validate(rejectUserSchema), adminController.rejectUser);
router.patch('/admin/users/:id/status', ...admin, validate(userStatusSchema), adminController.setUserStatus);
router.patch('/admin/users/:id/credit', ...admin, validate(creditSchema), adminController.setCredit);
// The line of credit above is edited; store credit below is posted to.
router.get('/admin/users/:id/store-credit', ...admin, adminController.storeCreditStatement);
// The Activity tab on the client profile. Assembled from orders, invoices,
// payments and credit movements until `AuditLog` lands in phase 11.
router.get('/admin/users/:id/activity', ...admin, adminController.userActivity);
router.post('/admin/users/:id/store-credit', ...admin, validate(storeCreditSchema), adminController.allocateStoreCredit);

router.get('/admin/products', ...admin, adminController.listProducts);
router.post('/admin/products', ...admin, validate(productSchema), adminController.createProduct);
router.patch('/admin/products/:id', ...admin, validate(productSchema), adminController.updateProduct);
// Toggles isActive rather than deleting — orders reference products by id.
router.delete('/admin/products/:id', ...admin, adminController.toggleProduct);

router.get('/admin/orders', ...admin, adminController.listOrders);
// Registered ahead of the `:orderNumber` routes so a literal path can never be
// swallowed by a parameter. Partial by design — the response names what moved
// and what did not.
router.patch('/admin/orders/bulk-status', ...admin, validate(bulkOrderStatusSchema), adminController.bulkUpdateOrderStatus);
router.patch('/admin/orders/:orderNumber/status', ...admin, validate(orderStatusSchema), adminController.updateOrderStatus);
// Refunds go to store credit — there is no gateway to send money back through.
router.post('/admin/orders/:orderNumber/refund', ...admin, validate(refundSchema), adminController.refundOrder);

// Invoices. `amountPaid` and the status are recomputed server-side from the
// payment rows on every write — the client never sends either.
router.get('/admin/invoices', ...admin, adminController.listInvoices);
router.get('/admin/invoices/:number', ...admin, adminController.getInvoice);
// The same artefact the customer receives, rendered by the same renderer — the
// buyer route scopes its lookup to the signed-in user, so an admin needs this.
router.get('/admin/invoices/:number/document', ...admin, adminController.invoiceDocument);
router.post('/admin/invoices/:number/payments', ...admin, validate(invoicePaymentSchema), adminController.recordInvoicePayment);
// Voiding forgives the balance and keeps the row: an invoice that vanishes
// takes its own audit trail with it.
router.post('/admin/invoices/:number/void', ...admin, validate(invoiceVoidSchema), adminController.voidInvoice);

// --- purchase (phase 5) ----------------------------------------------------
// Suppliers, purchase orders, expenses and the stock ledger. Every rule lives
// in `purchaseService`; these routes only decide who may call it.

router.get('/admin/suppliers', ...admin, purchaseController.listSuppliers);
router.get('/admin/suppliers/:id', ...admin, purchaseController.getSupplier);
router.post('/admin/suppliers', ...admin, validate(supplierSchema), purchaseController.createSupplier);
router.patch('/admin/suppliers/:id', ...admin, validate(supplierSchema), purchaseController.updateSupplier);
// Toggles isActive rather than deleting — purchase orders reference suppliers.
router.delete('/admin/suppliers/:id', ...admin, purchaseController.toggleSupplier);

router.get('/admin/purchase-orders', ...admin, purchaseController.listPurchaseOrders);
router.post('/admin/purchase-orders', ...admin, validate(purchaseOrderSchema), purchaseController.createPurchaseOrder);
router.get('/admin/purchase-orders/:id', ...admin, purchaseController.getPurchaseOrder);
// Edits stop at draft; the service refuses a sent order rather than the route.
router.patch('/admin/purchase-orders/:id', ...admin, validate(purchaseOrderSchema), purchaseController.updatePurchaseOrder);
router.patch('/admin/purchase-orders/:id/status', ...admin, validate(purchaseOrderStatusSchema), purchaseController.setPurchaseOrderStatus);
// Receiving increments stock and writes a StockMovement per line, server-side.
// Partial by design: the response names what moved and what did not.
router.post('/admin/purchase-orders/:id/receive', ...admin, validate(purchaseReceiveSchema), purchaseController.receivePurchaseOrder);
// Recording a payment creates the Expense row — once. A second call is refused.
router.post('/admin/purchase-orders/:id/payment', ...admin, validate(purchasePaymentSchema), purchaseController.recordPurchasePayment);

// Categories are registered ahead of `/admin/expenses/:id` so a literal path
// can never be swallowed by a parameter — the same ordering the bulk order
// route needs.
router.get('/admin/expenses/categories', ...admin, purchaseController.listExpenseCategories);
router.post('/admin/expenses/categories', ...admin, validate(expenseCategorySchema), purchaseController.createExpenseCategory);
router.patch('/admin/expenses/categories/:id', ...admin, validate(expenseCategorySchema), purchaseController.updateExpenseCategory);
// Deactivates a category that is in use rather than deleting it.
router.delete('/admin/expenses/categories/:id', ...admin, purchaseController.deleteExpenseCategory);

router.get('/admin/expenses', ...admin, purchaseController.listExpenses);
router.post('/admin/expenses', ...admin, validate(expenseSchema), purchaseController.createExpense);
router.patch('/admin/expenses/:id', ...admin, validate(expenseSchema), purchaseController.updateExpense);
router.delete('/admin/expenses/:id', ...admin, purchaseController.deleteExpense);

// Inventory. Exact counts and costs are admin-only; the storefront's binary
// in stock / out of stock is produced by productService.serialize and is not
// affected by anything here.
router.get('/admin/inventory', ...admin, purchaseController.listInventory);
router.get('/admin/inventory/movements', ...admin, purchaseController.listStockMovements);
router.get('/admin/inventory/:id', ...admin, purchaseController.getInventoryItem);
router.patch('/admin/inventory/:id/ops', ...admin, validate(productOpsSchema), purchaseController.updateInventoryOps);
// A manual correction, through the same ledger as every other stock movement.
router.post('/admin/inventory/:id/adjust', ...admin, validate(stockAdjustSchema), purchaseController.adjustStock);

// --- quotes & RMA (phase 7) ------------------------------------------------
// A quote's stored price is honoured only while the quote is valid, and
// conversion re-prices against live products before it writes an order.

router.get('/admin/quotes', ...admin, salesController.listQuotes);
router.post('/admin/quotes', ...admin, validate(quoteSchema), salesController.createQuote);
router.get('/admin/quotes/:id', ...admin, salesController.getQuote);
router.patch('/admin/quotes/:id', ...admin, validate(quoteSchema), salesController.updateQuote);
router.patch('/admin/quotes/:id/status', ...admin, validate(quoteStatusSchema), salesController.setQuoteStatus);
// Refuses with QUOTE_PRICE_DRIFT and the full comparison when catalogue prices
// have moved and the admin has not acknowledged them.
router.post('/admin/quotes/:id/convert', ...admin, validate(quoteConvertSchema), salesController.convertQuote);
router.delete('/admin/quotes/:id', ...admin, salesController.deleteQuote);

// Refunds route through storeCreditService and restocking through the stock
// ledger — an RMA is not an exception to either rule.
router.get('/admin/rma', ...admin, salesController.listRmas);
router.post('/admin/rma', ...admin, validate(rmaSchema), salesController.createRma);
router.get('/admin/rma/:id', ...admin, salesController.getRma);
router.patch('/admin/rma/:id/status', ...admin, validate(rmaStatusSchema), salesController.setRmaStatus);
router.patch('/admin/rma/:id/inspect', ...admin, validate(rmaInspectSchema), salesController.inspectRma);
// Resolving decides money and stock, so it carries that decision rather than
// being reachable through the status route.
router.post('/admin/rma/:id/resolve', ...admin, validate(rmaResolveSchema), salesController.resolveRma);

// --- reports (phase 6) -----------------------------------------------------
// Read-only, always (§9.6). One GET per tab and no write verb on this path at
// all — a report that can mutate is a report nobody can safely re-run.
router.get('/admin/reports/:tab', ...admin, reportController.report);

// Editorial content. Unlike products, none of these are referenced by an order,
// so a delete here leaves nothing dangling and really deletes.
router.get('/admin/blog', ...admin, contentController.adminListPosts);
router.get('/admin/blog/:id', ...admin, contentController.adminGetPost);
router.post('/admin/blog', ...admin, validate(blogPostSchema), contentController.adminCreatePost);
router.patch('/admin/blog/:id', ...admin, validate(blogPostSchema), contentController.adminUpdatePost);
router.delete('/admin/blog/:id', ...admin, contentController.adminDeletePost);

router.get('/admin/faqs', ...admin, contentController.adminListFaqs);
router.post('/admin/faqs', ...admin, validate(faqSchema), contentController.adminCreateFaq);
router.patch('/admin/faqs/:id', ...admin, validate(faqSchema), contentController.adminUpdateFaq);
router.delete('/admin/faqs/:id', ...admin, contentController.adminDeleteFaq);

router.get('/admin/offers', ...admin, contentController.adminListOffers);
router.post('/admin/offers', ...admin, validate(offerSchema), contentController.adminCreateOffer);
router.patch('/admin/offers/:id', ...admin, validate(offerSchema), contentController.adminUpdateOffer);
router.delete('/admin/offers/:id', ...admin, contentController.adminDeleteOffer);

export default router;
