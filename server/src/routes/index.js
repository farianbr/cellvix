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
import * as supplierReturnController from '../controllers/supplierReturnController.js';
import * as supplierServiceController from '../controllers/supplierServiceController.js';
import * as reportController from '../controllers/reportController.js';
import * as salesController from '../controllers/salesController.js';
import * as ticketController from '../controllers/ticketController.js';
import * as contactController from '../controllers/contactController.js';
import * as contentController from '../controllers/contentController.js';
import * as accessController from '../controllers/accessController.js';
import * as marketingController from '../controllers/marketingController.js';
import * as referralController from '../controllers/referralController.js';
import * as settingsController from '../controllers/settingsController.js';
import * as auditController from '../controllers/auditController.js';
import * as credentialController from '../controllers/credentialController.js';
import * as taxonomyAdminController from '../controllers/taxonomyAdminController.js';
import * as invoiceStatusController from '../controllers/invoiceStatusController.js';
import * as appointmentController from '../controllers/appointmentController.js';
import * as webQuoteController from '../controllers/webQuoteController.js';
import * as searchController from '../controllers/searchController.js';
import * as profileController from '../controllers/profileController.js';
import * as exportController from '../controllers/exportController.js';
import * as notificationController from '../controllers/notificationController.js';
import * as rfqController from '../controllers/rfqController.js';
import * as supplierPortalController from '../controllers/supplierPortalController.js';

import validate from '../middleware/validate.js';
import {
  requireAuth,
  requireApproved,
  requireAdmin,
  requireStaff,
  denyAdmin,
  requirePermission,
} from '../middleware/auth.js';
import { requireSupplier } from '../middleware/supplierAuth.js';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  supplierApplicationSchema,
} from '../../../shared/schemas/auth.js';
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
  invoicePaymentSchema as accountInvoicePaymentSchema,
  creditPayoffSchema,
} from '../../../shared/schemas/account.js';
import {
  approveUserSchema,
  rejectUserSchema,
  creditSchema,
  clientSchema,
  clientUpdateSchema,
  contactConsentSchema,
  tierSchema,
  internalNoteSchema,
  adminOrderSchema,
  adminInvoiceSchema,
  refundSchema,
  storeCreditSchema,
  userStatusSchema,
  productSchema,
  orderStatusSchema,
  invoicePaymentSchema,
  invoiceVoidSchema,
  invoiceUpdateSchema,
  webQuoteStatusSchema,
  creditPaymentSchema,
  bulkOrderStatusSchema,
  supplierSchema,
  supplierReturnSchema,
  supplierReturnStatusSchema,
  supplierCreditSchema,
  supplierServiceSchema,
  supplierServiceUpdateSchema,
  supplierChargeSchema,
  purchaseOrderSchema,
  purchaseOrderStatusSchema,
  purchaseReceiveSchema,
  purchasePaymentSchema,
  rfqSchema,
  rfqSendSchema,
  rfqInviteSchema,
  rfqAwardSchema,
  rfqCancelSchema,
  supplierQuoteSchema,
  supplierDeclineSchema,
  supplierLoginSchema,
  supplierForgotSchema,
  supplierResetSchema,
  supplierPasswordSchema,
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
  ticketSchema,
  ticketUpdateSchema,
  ticketStatusSchema,
  outletSchema,
  roleSchema,
  staffUserSchema,
  staffUserUpdateSchema,
  messageSchema,
  callLogSchema,
  messageTemplateSchema,
  campaignSchema,
  unsubscribeSchema,
  referralRateSchema,
  businessInfoSchema,
  saleSettingsSchema,
  shippingSettingsSchema,
  paymentMethodsSettingsSchema,
  inventorySettingsSchema,
  providerCredentialSchema,
  taxonomyNodeSchema,
  invoiceStatusRuleSchema,
  communicationsSettingsSchema,
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
// Completing the reset. Rate-limited like the request half: the token is the
// whole authorisation, so this is the endpoint somebody would guess against.
router.post(
  '/auth/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
// Creates no account, so it sits with auth rather than under /admin: it is the
// other half of the storefront sign-up. Rate-limited like every other
// unauthenticated write.
router.post(
  '/auth/supplier-application',
  authLimiter,
  validate(supplierApplicationSchema),
  authController.applyAsSupplier,
);

// --- contact ---------------------------------------------------------------
// Open to guests; rate-limited because it is an unauthenticated write.
router.post('/contact', authLimiter, validate(contactSchema), contactController.submit);

// --- unsubscribe (phase 9) --------------------------------------------------
// Deliberately unauthenticated: CASL requires the mechanism to work in no more
// than two clicks, and the person clicking is very often not signed in. The
// HMAC in the link authorises it, so a guessed account id gets nowhere. Rate
// limited like every other unauthenticated write.
router.post('/unsubscribe', authLimiter, validate(unsubscribeSchema), marketingController.unsubscribe);

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

// Saved carts and the quick order pad need wholesale pricing, so they are gated.
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

// Paying. Neither route takes an amount: what is owed is a fact the server
// already holds, and §5.3 is explicit that the client never sends a figure that
// decides what money moves. `payoff` settles every amount outstanding on the
// line of credit, oldest first, in one charge.
router.post('/invoices/:number/pay', ...account, validate(accountInvoicePaymentSchema), accountController.payInvoice);
router.post('/account/credit/payoff', ...account, validate(creditPayoffSchema), accountController.payOffCredit);

// The account's own history — the same feed the admin client profile reads, so
// a buyer and their account rep are never looking at two different stories.
router.get('/account/activity', ...account, accountController.activity);

// The same history, filtered and paged, for the activity screen. A separate
// route rather than query params on the one above so the dashboard's panel and
// the page cannot break each other: the panel wants the last few events, the
// page wants an envelope with counts in it.
router.get('/account/activity/history', ...account, accountController.activityPage);

// The buyer's referral standing (§6.13). Read-only: a code is minted at
// approval and a commission is earned by a payment, so there is nothing here
// for a buyer to write.
router.get('/account/referrals', ...account, accountController.referrals);

// --- admin -----------------------------------------------------------------
// Panel access. `requireStaff` admits an admin or a staff member holding a
// role; `requirePermission` on each route below decides what they may do with
// it. Routes that must stay admin-only regardless of role use `adminOnly`.
const admin = [requireAuth, requireStaff];
const adminOnly = [requireAuth, requireAdmin];

// Deliberately not permissioned: the sidebar badges read this on every screen,
// so gating it by area would blank the counters for a role that can still see
// the pages behind them. It returns counts, never records.
router.get('/admin/stats', ...admin, adminController.stats);

router.get('/admin/users', ...admin, requirePermission('clients', 'view'), adminController.listUsers);
// Opening a client account is a `full` action, not a `view` one — a hidden
// `+ Create` entry is a courtesy, this is the permission (§7.6).
router.post('/admin/users', ...admin, requirePermission('clients', 'full'), validate(clientSchema), adminController.createUser);
router.get('/admin/users/:id', ...admin, requirePermission('clients', 'view'), adminController.getUser);
router.patch('/admin/users/:id', ...admin, requirePermission('clients', 'full'), validate(clientUpdateSchema), adminController.updateUser);
router.patch('/admin/users/:id/consent', ...admin, requirePermission('clients', 'full'), validate(contactConsentSchema), adminController.setContactConsent);
router.patch('/admin/users/:id/tier', ...admin, requirePermission('clients', 'full'), validate(tierSchema), adminController.setTier);
router.post('/admin/users/:id/notes', ...admin, requirePermission('clients', 'full'), validate(internalNoteSchema), adminController.addInternalNote);
router.delete('/admin/users/:id/notes/:noteId', ...admin, requirePermission('clients', 'full'), adminController.deleteInternalNote);
router.patch('/admin/users/:id/approve', ...admin, requirePermission('clients', 'full'), validate(approveUserSchema), adminController.approveUser);
router.patch('/admin/users/:id/reject', ...admin, requirePermission('clients', 'full'), validate(rejectUserSchema), adminController.rejectUser);
router.patch('/admin/users/:id/status', ...admin, requirePermission('clients', 'full'), validate(userStatusSchema), adminController.setUserStatus);
router.patch('/admin/users/:id/credit', ...admin, requirePermission('clients', 'full'), validate(creditSchema), adminController.setCredit);
// The line of credit above is edited; store credit below is posted to.
router.get('/admin/users/:id/store-credit', ...admin, requirePermission('clients', 'view'), adminController.storeCreditStatement);
// The printable account statement — every invoice and payment on the account,
// which is a different document from the store-credit ledger above it.
// Cash at the counter against the line of credit. It settles real invoices
// oldest-first rather than decrementing a balance, so the account and its
// invoices can never disagree about what is still owed.
router.post('/admin/users/:id/credit-payment', ...admin, requirePermission('clients', 'full'), validate(creditPaymentSchema), adminController.recordCreditPayment);
router.get('/admin/users/:id/statement', ...admin, requirePermission('clients', 'view'), adminController.accountStatement);
// The Activity tab on the client profile. Assembled from orders, invoices,
// payments and credit movements until `AuditLog` lands in phase 11.
router.get('/admin/users/:id/activity', ...admin, requirePermission('clients', 'view'), adminController.userActivity);
router.post('/admin/users/:id/store-credit', ...admin, requirePermission('clients', 'full'), validate(storeCreditSchema), adminController.allocateStoreCredit);

router.get('/admin/products', ...admin, requirePermission('purchase', 'view'), adminController.listProducts);
router.post('/admin/products', ...admin, requirePermission('purchase', 'full'), validate(productSchema), adminController.createProduct);
router.patch('/admin/products/:id', ...admin, requirePermission('purchase', 'full'), validate(productSchema), adminController.updateProduct);
// Toggles isActive rather than deleting — orders reference products by id.
router.delete('/admin/products/:id', ...admin, requirePermission('purchase', 'full'), adminController.toggleProduct);

router.get('/admin/orders', ...admin, requirePermission('sales', 'view'), adminController.listOrders);
// An order raised by hand — a phone or email order. Same rules as a converted
// quote, because it runs the same code (`services/orderBuilder.js`).
router.post('/admin/orders', ...admin, requirePermission('sales', 'full'), validate(adminOrderSchema), adminController.createOrder);
// Registered ahead of the `:orderNumber` routes so a literal path can never be
// swallowed by a parameter. Partial by design — the response names what moved
// and what did not.
router.patch('/admin/orders/bulk-status', ...admin, requirePermission('sales', 'full'), validate(bulkOrderStatusSchema), adminController.bulkUpdateOrderStatus);
router.get('/admin/orders/:orderNumber', ...admin, requirePermission('sales', 'view'), adminController.getOrder);
router.patch('/admin/orders/:orderNumber/status', ...admin, requirePermission('sales', 'full'), validate(orderStatusSchema), adminController.updateOrderStatus);
// Refunds go to store credit — there is no gateway to send money back through.
router.post('/admin/orders/:orderNumber/refund', ...admin, requirePermission('sales', 'full'), validate(refundSchema), adminController.refundOrder);

// Invoices. `amountPaid` and the status are recomputed server-side from the
// payment rows on every write — the client never sends either.
router.get('/admin/invoices', ...admin, requirePermission('sales', 'view'), adminController.listInvoices);
// A standalone invoice — one with no order behind it (§7.2).
router.post('/admin/invoices', ...admin, requirePermission('sales', 'full'), validate(adminInvoiceSchema), adminController.createInvoice);
router.get('/admin/invoices/:number', ...admin, requirePermission('sales', 'view'), adminController.getInvoice);
// The same artefact the customer receives, rendered by the same renderer — the
// buyer route scopes its lookup to the signed-in user, so an admin needs this.
router.get('/admin/invoices/:number/document', ...admin, requirePermission('sales', 'view'), adminController.invoiceDocument);
router.post('/admin/invoices/:number/payments', ...admin, requirePermission('sales', 'full'), validate(invoicePaymentSchema), adminController.recordInvoicePayment);
// Voiding forgives the balance and keeps the row: an invoice that vanishes
// takes its own audit trail with it.
router.post('/admin/invoices/:number/void', ...admin, requirePermission('sales', 'full'), validate(invoiceVoidSchema), adminController.voidInvoice);
// Reversing one payment. Never a delete: the original row and its reversal are
// both true, and a customer holding a receipt must still find it on the record.
router.post('/admin/invoices/:number/payments/:index/reverse', ...admin, requirePermission('sales', 'full'), adminController.reverseInvoicePayment);
// Emailing the invoice sends the same document the print route renders, so the
// copy in the customer's inbox and the copy on screen can never disagree.
router.post('/admin/invoices/:number/email', ...admin, requirePermission('sales', 'full'), adminController.emailInvoice);
// Clerical corrections only — the amount is not editable; see invoiceUpdateSchema.
router.patch('/admin/invoices/:number', ...admin, requirePermission('sales', 'full'), validate(invoiceUpdateSchema), adminController.updateInvoice);
// Refused once a payment exists: that case is a void, which keeps the record.
router.delete('/admin/invoices/:number', ...admin, requirePermission('sales', 'full'), adminController.deleteInvoice);

// --- purchase (phase 5) ----------------------------------------------------
// Suppliers, purchase orders, expenses and the stock ledger. Every rule lives
// in `purchaseService`; these routes only decide who may call it.

router.get('/admin/suppliers', ...admin, requirePermission('purchase', 'view'), purchaseController.listSuppliers);
router.get('/admin/suppliers/:id', ...admin, requirePermission('purchase', 'view'), purchaseController.getSupplier);
router.post('/admin/suppliers', ...admin, requirePermission('purchase', 'full'), validate(supplierSchema), purchaseController.createSupplier);
router.patch('/admin/suppliers/:id', ...admin, requirePermission('purchase', 'full'), validate(supplierSchema), purchaseController.updateSupplier);
// Toggles isActive rather than deleting — purchase orders reference suppliers.
router.delete('/admin/suppliers/:id', ...admin, requirePermission('purchase', 'full'), purchaseController.toggleSupplier);

// --- returns to a supplier (Purchase § RMA / Returns) ------------------------
// The purchase-side counterpart of `/admin/rma`: stock going back out, and a
// credit claimed from the supplier rather than given to a customer.
router.get('/admin/supplier-returns', ...admin, requirePermission('purchase', 'view'), supplierReturnController.list);
router.post('/admin/supplier-returns', ...admin, requirePermission('purchase', 'full'), validate(supplierReturnSchema), supplierReturnController.create);
router.get('/admin/supplier-returns/:id', ...admin, requirePermission('purchase', 'view'), supplierReturnController.get);
router.patch('/admin/supplier-returns/:id/status', ...admin, requirePermission('purchase', 'full'), validate(supplierReturnStatusSchema), supplierReturnController.setStatus);
router.post('/admin/supplier-returns/:id/credit', ...admin, requirePermission('purchase', 'full'), validate(supplierCreditSchema), supplierReturnController.recordCredit);
router.delete('/admin/supplier-returns/:id', ...admin, requirePermission('purchase', 'full'), supplierReturnController.remove);

// --- bought-in services & supplier subscriptions -----------------------------
// One collection behind two screens: `?kind=service` is anything billed once,
// `?kind=subscription` is anything that repeats. Recording a charge writes a
// real Expense, so the P&L sees it like every other cost.
router.get('/admin/supplier-services', ...admin, requirePermission('purchase', 'view'), supplierServiceController.list);
router.post('/admin/supplier-services', ...admin, requirePermission('purchase', 'full'), validate(supplierServiceSchema), supplierServiceController.create);
router.get('/admin/supplier-services/:id', ...admin, requirePermission('purchase', 'view'), supplierServiceController.get);
router.patch('/admin/supplier-services/:id', ...admin, requirePermission('purchase', 'full'), validate(supplierServiceUpdateSchema), supplierServiceController.update);
router.post('/admin/supplier-services/:id/charges', ...admin, requirePermission('purchase', 'full'), validate(supplierChargeSchema), supplierServiceController.recordCharge);
router.patch('/admin/supplier-services/:id/cancel', ...admin, requirePermission('purchase', 'full'), supplierServiceController.setCancelled);
router.delete('/admin/supplier-services/:id', ...admin, requirePermission('purchase', 'full'), supplierServiceController.remove);

router.get('/admin/purchase-orders', ...admin, requirePermission('purchase', 'view'), purchaseController.listPurchaseOrders);
router.post('/admin/purchase-orders', ...admin, requirePermission('purchase', 'full'), validate(purchaseOrderSchema), purchaseController.createPurchaseOrder);
router.get('/admin/purchase-orders/:id', ...admin, requirePermission('purchase', 'view'), purchaseController.getPurchaseOrder);
// Edits stop at draft; the service refuses a sent order rather than the route.
router.patch('/admin/purchase-orders/:id', ...admin, requirePermission('purchase', 'full'), validate(purchaseOrderSchema), purchaseController.updatePurchaseOrder);
router.patch('/admin/purchase-orders/:id/status', ...admin, requirePermission('purchase', 'full'), validate(purchaseOrderStatusSchema), purchaseController.setPurchaseOrderStatus);
// Receiving increments stock and writes a StockMovement per line, server-side.
// Partial by design: the response names what moved and what did not.
router.post('/admin/purchase-orders/:id/receive', ...admin, requirePermission('purchase', 'full'), validate(purchaseReceiveSchema), purchaseController.receivePurchaseOrder);
// Recording a payment creates the Expense row — once. A second call is refused.
router.post('/admin/purchase-orders/:id/payment', ...admin, requirePermission('purchase', 'full'), validate(purchasePaymentSchema), purchaseController.recordPurchasePayment);

// --- requests for quote (supplier process flow, §6.8a) ----------------------
// The step before a purchase order: ask several suppliers, compare, award. Same
// `purchase` permission area as the PO routes it feeds, because it is the same
// job — awarding one raises a real purchase order, so anybody who may do this
// may already raise one by hand.
//
// The supplier picker is registered ahead of `/admin/rfqs/:id`, or the literal
// path is swallowed as an id — the ordering the expense categories need too.
router.get('/admin/rfqs/suppliers', ...admin, requirePermission('purchase', 'view'), rfqController.suppliersForComponentTypes);
router.get('/admin/rfqs', ...admin, requirePermission('purchase', 'view'), rfqController.listRfqs);
router.post('/admin/rfqs', ...admin, requirePermission('purchase', 'full'), validate(rfqSchema), rfqController.createRfq);
router.get('/admin/rfqs/:id', ...admin, requirePermission('purchase', 'view'), rfqController.getRfq);
router.patch('/admin/rfqs/:id', ...admin, requirePermission('purchase', 'full'), validate(rfqSchema), rfqController.updateRfq);
router.post('/admin/rfqs/:id/send', ...admin, requirePermission('purchase', 'full'), validate(rfqSendSchema), rfqController.sendRfq);
router.post('/admin/rfqs/:id/invite', ...admin, requirePermission('purchase', 'full'), validate(rfqInviteSchema), rfqController.inviteSupplier);
// Commits money to one supplier and raises the PO. Audited by name.
router.post('/admin/rfqs/:id/award', ...admin, requirePermission('purchase', 'full'), validate(rfqAwardSchema), rfqController.awardRfq);
router.post('/admin/rfqs/:id/cancel', ...admin, requirePermission('purchase', 'full'), validate(rfqCancelSchema), rfqController.cancelRfq);

// Issues a credential, so it needs `full` rather than `view` — and it is
// audited as a security event in the controller.
router.post('/admin/suppliers/:id/portal-invite', ...admin, requirePermission('purchase', 'full'), purchaseController.invitePortal);

// --- the supplier portal (supplier process flow, §6.8a) ---------------------
//
// **A separate population behind a separate cookie.** These routes are guarded
// by `requireSupplier`, which reads the supplier session and resolves it in
// `Supplier` — a buyer or admin token satisfies none of them, and a supplier
// token satisfies nothing above. See `middleware/supplierAuth.js` for why the
// guarantee is structural rather than a matter of having audited each route.
//
// Credential endpoints take the same rate limiter as the buyer side.
router.post('/supplier-portal/login', authLimiter, validate(supplierLoginSchema), supplierPortalController.login);
router.post('/supplier-portal/logout', supplierPortalController.logout);
// Not `requireSupplier`: signed out is a valid answer, as it is for `/auth/me`.
router.get('/supplier-portal/me', supplierPortalController.me);
router.post('/supplier-portal/forgot-password', authLimiter, validate(supplierForgotSchema), supplierPortalController.forgotPassword);
router.post('/supplier-portal/reset-password', authLimiter, validate(supplierResetSchema), supplierPortalController.resetPassword);
router.post('/supplier-portal/password', requireSupplier, validate(supplierPasswordSchema), supplierPortalController.changePassword);

router.get('/supplier-portal/rfqs', requireSupplier, supplierPortalController.listRfqs);
router.get('/supplier-portal/rfqs/:id', requireSupplier, supplierPortalController.getRfq);
router.post('/supplier-portal/rfqs/:id/quote', requireSupplier, validate(supplierQuoteSchema), supplierPortalController.submitQuote);
router.post('/supplier-portal/rfqs/:id/decline', requireSupplier, validate(supplierDeclineSchema), supplierPortalController.declineQuote);

// Categories are registered ahead of `/admin/expenses/:id` so a literal path
// can never be swallowed by a parameter — the same ordering the bulk order
// route needs.
router.get('/admin/expenses/categories', ...admin, requirePermission('purchase', 'view'), purchaseController.listExpenseCategories);
router.post('/admin/expenses/categories', ...admin, requirePermission('purchase', 'full'), validate(expenseCategorySchema), purchaseController.createExpenseCategory);
router.patch('/admin/expenses/categories/:id', ...admin, requirePermission('purchase', 'full'), validate(expenseCategorySchema), purchaseController.updateExpenseCategory);
// Deactivates a category that is in use rather than deleting it.
router.delete('/admin/expenses/categories/:id', ...admin, requirePermission('purchase', 'full'), purchaseController.deleteExpenseCategory);

router.get('/admin/expenses', ...admin, requirePermission('purchase', 'view'), purchaseController.listExpenses);
router.post('/admin/expenses', ...admin, requirePermission('purchase', 'full'), validate(expenseSchema), purchaseController.createExpense);
router.patch('/admin/expenses/:id', ...admin, requirePermission('purchase', 'full'), validate(expenseSchema), purchaseController.updateExpense);
router.delete('/admin/expenses/:id', ...admin, requirePermission('purchase', 'full'), purchaseController.deleteExpense);

// Inventory. Exact counts and costs are admin-only; the storefront's binary
// in stock / out of stock is produced by productService.serialize and is not
// affected by anything here.
router.get('/admin/inventory', ...admin, requirePermission('purchase', 'view'), purchaseController.listInventory);
router.get('/admin/inventory/movements', ...admin, requirePermission('purchase', 'view'), purchaseController.listStockMovements);
router.get('/admin/inventory/:id', ...admin, requirePermission('purchase', 'view'), purchaseController.getInventoryItem);
router.patch('/admin/inventory/:id/ops', ...admin, requirePermission('purchase', 'full'), validate(productOpsSchema), purchaseController.updateInventoryOps);
// A manual correction, through the same ledger as every other stock movement.
router.post('/admin/inventory/:id/adjust', ...admin, requirePermission('purchase', 'full'), validate(stockAdjustSchema), purchaseController.adjustStock);

// --- quotes & RMA (phase 7) ------------------------------------------------
// A quote's stored price is honoured only while the quote is valid, and
// conversion re-prices against live products before it writes an order.

router.get('/admin/quotes', ...admin, requirePermission('sales', 'view'), salesController.listQuotes);
router.post('/admin/quotes', ...admin, requirePermission('sales', 'full'), validate(quoteSchema), salesController.createQuote);
router.get('/admin/quotes/:id', ...admin, requirePermission('sales', 'view'), salesController.getQuote);
router.patch('/admin/quotes/:id', ...admin, requirePermission('sales', 'full'), validate(quoteSchema), salesController.updateQuote);
router.patch('/admin/quotes/:id/status', ...admin, requirePermission('sales', 'full'), validate(quoteStatusSchema), salesController.setQuoteStatus);
// Refuses with QUOTE_PRICE_DRIFT and the full comparison when catalogue prices
// have moved and the admin has not acknowledged them.
router.post('/admin/quotes/:id/convert', ...admin, requirePermission('sales', 'full'), validate(quoteConvertSchema), salesController.convertQuote);
router.delete('/admin/quotes/:id', ...admin, requirePermission('sales', 'full'), salesController.deleteQuote);

// Refunds route through storeCreditService and restocking through the stock
// ledger — an RMA is not an exception to either rule.
router.get('/admin/rma', ...admin, requirePermission('sales', 'view'), salesController.listRmas);
router.post('/admin/rma', ...admin, requirePermission('sales', 'full'), validate(rmaSchema), salesController.createRma);
router.get('/admin/rma/:id', ...admin, requirePermission('sales', 'view'), salesController.getRma);
router.patch('/admin/rma/:id/status', ...admin, requirePermission('sales', 'full'), validate(rmaStatusSchema), salesController.setRmaStatus);
router.patch('/admin/rma/:id/inspect', ...admin, requirePermission('sales', 'full'), validate(rmaInspectSchema), salesController.inspectRma);
// Resolving decides money and stock, so it carries that decision rather than
// being reachable through the status route.
router.post('/admin/rma/:id/resolve', ...admin, requirePermission('sales', 'full'), validate(rmaResolveSchema), salesController.resolveRma);

// Repair tickets. The status route is separate from the update route because
// only it records the move on the ticket timeline.
router.get('/admin/tickets', ...admin, requirePermission('sales', 'view'), ticketController.listTickets);
router.post('/admin/tickets', ...admin, requirePermission('sales', 'full'), validate(ticketSchema), ticketController.createTicket);
router.get('/admin/tickets/:id', ...admin, requirePermission('sales', 'view'), ticketController.getTicket);
router.patch('/admin/tickets/:id', ...admin, requirePermission('sales', 'full'), validate(ticketUpdateSchema), ticketController.updateTicket);
router.patch('/admin/tickets/:id/status', ...admin, requirePermission('sales', 'full'), validate(ticketStatusSchema), ticketController.setTicketStatus);
router.delete('/admin/tickets/:id', ...admin, requirePermission('sales', 'full'), ticketController.deleteTicket);

// --- outlets, roles & staff (phase 8) ---------------------------------------
// Outlets are an ordinary permissioned area. Roles and user accounts are NOT:
// they stay `requireAdmin` regardless of role, because a role that can grant
// itself power is not a permission system (§7.6).

const outletView = [...admin, requirePermission('outlet', 'view')];
const outletFull = [...admin, requirePermission('outlet', 'full')];

router.get('/admin/outlets', ...outletView, accessController.listOutlets);
// Registered ahead of `/:id` so the literal path cannot be swallowed.
router.get('/admin/outlets/next-code', ...outletFull, accessController.nextOutletCode);
router.get('/admin/outlets/:id', ...outletView, accessController.getOutlet);
router.post('/admin/outlets', ...outletFull, validate(outletSchema), accessController.createOutlet);
router.patch('/admin/outlets/:id', ...outletFull, validate(outletSchema), accessController.updateOutlet);
// Its own route rather than a field on the form, so "exactly one default" is
// decided in one place.
router.patch('/admin/outlets/:id/default', ...outletFull, accessController.setDefaultOutlet);
router.delete('/admin/outlets/:id', ...outletFull, accessController.deleteOutlet);

router.get('/admin/roles', ...adminOnly, accessController.listRoles);
router.post('/admin/roles', ...adminOnly, validate(roleSchema), accessController.createRole);
router.patch('/admin/roles/:id', ...adminOnly, validate(roleSchema), accessController.updateRole);
router.delete('/admin/roles/:id', ...adminOnly, accessController.deleteRole);

router.get('/admin/staff', ...adminOnly, accessController.listStaff);
router.post('/admin/staff', ...adminOnly, validate(staffUserSchema), accessController.createStaff);
router.patch('/admin/staff/:id', ...adminOnly, validate(staffUserUpdateSchema), accessController.updateStaff);
router.delete('/admin/staff/:id', ...adminOnly, accessController.deleteStaff);

// --- reports (phase 6) -----------------------------------------------------
// Read-only, always (§9.6). One GET per tab and no write verb on this path at
// all — a report that can mutate is a report nobody can safely re-run.
router.get('/admin/reports/:tab', ...admin, requirePermission('reports', 'view'), reportController.report);

// Editorial content. Unlike products, none of these are referenced by an order,
// so a delete here leaves nothing dangling and really deletes.
router.get('/admin/blog', ...admin, requirePermission('marketing', 'view'), contentController.adminListPosts);
router.get('/admin/blog/:id', ...admin, requirePermission('marketing', 'view'), contentController.adminGetPost);
router.post('/admin/blog', ...admin, requirePermission('marketing', 'full'), validate(blogPostSchema), contentController.adminCreatePost);
router.patch('/admin/blog/:id', ...admin, requirePermission('marketing', 'full'), validate(blogPostSchema), contentController.adminUpdatePost);
router.delete('/admin/blog/:id', ...admin, requirePermission('marketing', 'full'), contentController.adminDeletePost);

router.get('/admin/faqs', ...admin, requirePermission('marketing', 'view'), contentController.adminListFaqs);
router.post('/admin/faqs', ...admin, requirePermission('marketing', 'full'), validate(faqSchema), contentController.adminCreateFaq);
router.patch('/admin/faqs/:id', ...admin, requirePermission('marketing', 'full'), validate(faqSchema), contentController.adminUpdateFaq);
router.delete('/admin/faqs/:id', ...admin, requirePermission('marketing', 'full'), contentController.adminDeleteFaq);

router.get('/admin/offers', ...admin, requirePermission('marketing', 'view'), contentController.adminListOffers);
router.post('/admin/offers', ...admin, requirePermission('marketing', 'full'), validate(offerSchema), contentController.adminCreateOffer);
router.patch('/admin/offers/:id', ...admin, requirePermission('marketing', 'full'), validate(offerSchema), contentController.adminUpdateOffer);
router.delete('/admin/offers/:id', ...admin, requirePermission('marketing', 'full'), contentController.adminDeleteOffer);

// --- marketing channels (phase 9) -------------------------------------------
// Composing is a `full` action on every channel, including the three that
// cannot send: an unconfigured channel still writes contact history, and
// writing history is not a read.

const marketingView = [...admin, requirePermission('marketing', 'view')];
const marketingFull = [...admin, requirePermission('marketing', 'full')];

router.get('/admin/marketing/summary', ...marketingView, marketingController.summary);
router.get('/admin/marketing/messages', ...marketingView, marketingController.listMessages);

// One route per channel rather than a `:channel` parameter, so the channel is
// decided by the path and never by the payload — see the controller.
router.post('/admin/marketing/sms', ...marketingFull, validate(messageSchema), marketingController.sendSms);
router.post('/admin/marketing/whatsapp', ...marketingFull, validate(messageSchema), marketingController.sendWhatsapp);
router.post('/admin/marketing/email', ...marketingFull, validate(messageSchema), marketingController.sendEmail);
// A call is a record of something that already happened, so its payload is
// notes rather than a message body and it needs no template.
router.post('/admin/marketing/calls', ...marketingFull, validate(callLogSchema), marketingController.logCall);

router.get('/admin/marketing/templates', ...marketingView, marketingController.listTemplates);
router.post('/admin/marketing/templates', ...marketingFull, validate(messageTemplateSchema), marketingController.createTemplate);
router.patch('/admin/marketing/templates/:id', ...marketingFull, validate(messageTemplateSchema), marketingController.updateTemplate);
router.delete('/admin/marketing/templates/:id', ...marketingFull, marketingController.deleteTemplate);

// Registered ahead of `/campaigns/:id` so the literal path cannot be swallowed.
router.get('/admin/marketing/unsubscribes', ...marketingView, marketingController.listUnsubscribes);
// Re-subscribing records a NEW consent rather than clearing the old refusal —
// it is a claim that somebody asked to be put back, and needs its own date.
router.post('/admin/marketing/unsubscribes/:id/resubscribe', ...marketingFull, marketingController.resubscribe);

router.get('/admin/marketing/campaigns', ...marketingView, marketingController.listCampaigns);
router.post('/admin/marketing/campaigns', ...marketingFull, validate(campaignSchema), marketingController.createCampaign);
router.get('/admin/marketing/campaigns/:id', ...marketingView, marketingController.getCampaign);
router.patch('/admin/marketing/campaigns/:id', ...marketingFull, validate(campaignSchema), marketingController.updateCampaign);
router.delete('/admin/marketing/campaigns/:id', ...marketingFull, marketingController.deleteCampaign);
// The audience is resolved here, not at compose time, so consent is applied to
// the list as it stands at this moment (§6.13).
router.post('/admin/marketing/campaigns/:id/send', ...marketingFull, marketingController.sendCampaign);

// --- referral commission (phase 10) -----------------------------------------
// **Admin-only, not merely `marketing: full`** (§6.13). This feature pays real
// money on an automatic trigger, and the rate control multiplies every future
// payout — that is a decision for whoever owns the money, not for anyone who
// can write a blog post.
//
// Read and rate only. There is no route that writes an accrual or edits an
// attribution: commission is earned by a payment and reversed by a refund, both
// inside the services that own those events, and `referredBy` is set once at
// registration and never edited.
router.get('/admin/referrals', ...adminOnly, referralController.list);
router.patch('/admin/referrals/rate', ...adminOnly, validate(referralRateSchema), referralController.setRate);

// ---- phase 11a: settings ----------------------------------------------------
// Reading is `settings: view`; every write is `settings: full`. There is no
// whole-document PUT — each route touches only the paths its own screen owns,
// so one form cannot revert another's field by posting back a stale copy.
//
// `financial.referralPercent` is deliberately absent from all of these: it is
// admin-only through `/admin/referrals/rate` (§6.13), and a `settings: full`
// role must not gain a second door onto the number that multiplies every payout.
router.get('/admin/settings', ...admin, requirePermission('settings', 'view'), settingsController.get);
router.patch('/admin/settings/business', ...admin, requirePermission('settings', 'full'), validate(businessInfoSchema), settingsController.updateBusiness);
router.patch('/admin/settings/sale', ...admin, requirePermission('settings', 'full'), validate(saleSettingsSchema), settingsController.updateSale);
router.patch('/admin/settings/shipping', ...admin, requirePermission('settings', 'full'), validate(shippingSettingsSchema), settingsController.updateShipping);
router.patch('/admin/settings/payment-methods', ...admin, requirePermission('settings', 'full'), validate(paymentMethodsSettingsSchema), settingsController.updatePaymentMethods);
router.patch('/admin/settings/inventory', ...admin, requirePermission('settings', 'full'), validate(inventorySettingsSchema), settingsController.updateInventory);

// ---- phase 11b: the audit trail ---------------------------------------------
// Read-only by design — rows are written as a side effect of the operations
// being logged, and there is deliberately no route that creates, edits or
// deletes one (§6.15: neither log is ever deletable from the UI).
//
// The security log is **admin-only**, not `settings: view`: its rows name
// accounts and addresses that failed to sign in, which is exactly what helps
// somebody who is guessing at them.
// --- web quotes -------------------------------------------------------------
// Enquiries the storefront contact form sent in. They are ContactMessage rows,
// not a new record type — see the controller for why.
router.get('/admin/web-quotes', ...admin, requirePermission('sales', 'view'), webQuoteController.list);
router.patch('/admin/web-quotes/:id/status', ...admin, requirePermission('sales', 'full'), validate(webQuoteStatusSchema), webQuoteController.setStatus);

router.get('/admin/audit/activity', ...admin, requirePermission('settings', 'view'), auditController.activity);
router.get('/admin/audit/security', ...adminOnly, auditController.security);

// ---- phase 11c: provider credentials ----------------------------------------
// **`adminOnly`, never `requirePermission('settings', …)`.** §6.15: API keys are
// settable only by an admin and never by a role. A `settings: full` role that
// could write provider credentials would be able to point the SMS channel at a
// host of its choosing.
//
// The GET returns previews and a `configured` flag. **There is no route that
// returns a stored secret** — not masked-then-revealed, not to an admin. The
// only function that decrypts is `credentialService.valuesFor`, which nothing
// here calls and which exists for the code that talks to a provider.
router.get('/admin/credentials', ...adminOnly, credentialController.list);
// PATCH rather than PUT: a write names only the fields being changed, and an
// absent field means "leave it alone" rather than "clear it". Clearing is an
// explicit empty string.
router.patch('/admin/credentials/:provider', ...adminOnly, validate(providerCredentialSchema), credentialController.save);
router.delete('/admin/credentials/:provider', ...adminOnly, credentialController.clear);

// ---- phase 11d: taxonomy & invoice status rules -----------------------------
// Both sit under `settings`, matching where §6.15 files them. The taxonomy
// decides what the storefront can be filtered by and the rules decide what gets
// emailed to customers automatically, so neither is a `view`-level write.
router.get('/admin/taxonomy', ...admin, requirePermission('settings', 'view'), taxonomyAdminController.list);
router.get('/admin/taxonomy/:id', ...admin, requirePermission('settings', 'view'), taxonomyAdminController.get);
router.patch('/admin/taxonomy/:id', ...admin, requirePermission('settings', 'full'), validate(taxonomyNodeSchema), taxonomyAdminController.update);
router.delete('/admin/taxonomy/:id', ...admin, requirePermission('settings', 'full'), taxonomyAdminController.remove);

router.get('/admin/invoice-rules', ...admin, requirePermission('settings', 'view'), invoiceStatusController.list);
router.post('/admin/invoice-rules', ...admin, requirePermission('settings', 'full'), validate(invoiceStatusRuleSchema), invoiceStatusController.create);
router.patch('/admin/invoice-rules/:id', ...admin, requirePermission('settings', 'full'), validate(invoiceStatusRuleSchema), invoiceStatusController.update);
router.delete('/admin/invoice-rules/:id', ...admin, requirePermission('settings', 'full'), invoiceStatusController.remove);
// Running sends real email, so it needs `full` even in dry-run form — the dry
// run reveals which accounts would be contacted, which is not a `view` fact.
router.post('/admin/invoice-rules/run', ...admin, requirePermission('settings', 'full'), invoiceStatusController.run);

// ---- phase 11e: email settings & the scheduling board -----------------------
router.patch('/admin/settings/communications', ...admin, requirePermission('settings', 'full'), validate(communicationsSettingsSchema), settingsController.updateCommunications);

// Read-only, and there is **no write route** — §6b U1–U2: the board ships as
// interface without wiring, and an endpoint that accepted a booking would be
// the "fake success" rule 4 forbids.
router.get('/admin/appointments', ...admin, requirePermission('settings', 'view'), appointmentController.list);

// ---- phase 12: global search ------------------------------------------------
// Staff-level only, with no per-area guard here on purpose: the service decides
// which groups this caller may see from their own role. A single
// `requirePermission` would be wrong in both directions — too strict for a role
// holding one area, too loose for one holding none.
router.get('/admin/search', ...admin, searchController.search);

// The signed-in staff member's own profile. No permission guard: it returns
// nothing but what this account already knows about itself, and editing lives
// on Settings > Users behind the admin-only guard that owns the self-demotion
// and last-admin rules.
router.get('/admin/profile', ...admin, profileController.me);

// ---- phase 12b: list exports (§7.4) -----------------------------------------
// Each export runs the SAME service function its list runs, with the same query
// string — §7.4: an export that ignores the active filters is a bug. Each also
// carries the same permission guard as the list it mirrors, so an export can
// never be the weaker door onto the same rows.
router.get('/admin/export/clients', ...admin, requirePermission('clients', 'view'), exportController.clients);
router.get('/admin/export/orders', ...admin, requirePermission('sales', 'view'), exportController.orders);
router.get('/admin/export/invoices', ...admin, requirePermission('sales', 'view'), exportController.invoices);
router.get('/admin/export/inventory', ...admin, requirePermission('purchase', 'view'), exportController.inventory);
router.get('/admin/export/expenses', ...admin, requirePermission('purchase', 'view'), exportController.expenses);

// ---- phase 12c: notifications (§7.3) ----------------------------------------
// Staff-level only, with no per-area guard here on purpose — the same reasoning
// global search uses: the service decides which areas this caller's role may
// receive from, and a single `requirePermission` would be wrong in both
// directions, too strict for a role holding one area and too loose for one
// holding none. The two writes move nothing but who has seen what, so they need
// no `full`; the service still scopes what they touch to that caller's areas.
router.get('/admin/notifications', ...admin, notificationController.list);
router.post('/admin/notifications/read', ...admin, notificationController.markRead);
router.post('/admin/notifications/clear', ...admin, notificationController.clearAll);

export default router;
