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
import * as contactController from '../controllers/contactController.js';
import * as contentController from '../controllers/contentController.js';

import validate from '../middleware/validate.js';
import { requireAuth, requireApproved, requireAdmin } from '../middleware/auth.js';
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
router.get('/cart', requireAuth, cartController.get);
router.post('/cart/items', requireAuth, validate(addItemSchema), cartController.addItem);
router.patch('/cart/items/:productId', requireAuth, validate(setQtySchema), cartController.setQty);
router.delete('/cart/items/:productId', requireAuth, cartController.removeItem);
router.post('/cart/merge', requireAuth, validate(mergeCartSchema), cartController.merge);
router.post('/cart/save', requireAuth, validate(saveCartSchema), cartController.save);
router.delete('/cart', requireAuth, cartController.clear);

// Combos and promo codes are priced things, so they need approval — a pending
// business can still hold loose parts in its cart while it waits.
router.post('/cart/bundles', requireAuth, requireApproved, validate(addBundleSchema), cartController.addBundle);
router.patch('/cart/bundles/:offerId', requireAuth, requireApproved, validate(setBundleQtySchema), cartController.setBundleQty);
router.delete('/cart/bundles/:offerId', requireAuth, requireApproved, cartController.removeBundle);
router.post('/cart/promo', requireAuth, requireApproved, validate(promoCodeSchema), cartController.applyPromo);
router.delete('/cart/promo', requireAuth, requireApproved, cartController.clearPromo);

// Saved carts and the quick order pad need trade pricing, so they are gated.
router.get('/cart/saved', requireAuth, requireApproved, cartController.listSaved);
router.post('/cart/saved/:savedCartId/restore', requireAuth, requireApproved, cartController.restoreSaved);
router.delete('/cart/saved/:savedCartId', requireAuth, requireApproved, cartController.deleteSaved);
router.post('/cart/bulk', requireAuth, requireApproved, validate(bulkAddSchema), cartController.bulkAdd);

// --- orders ----------------------------------------------------------------
router.get('/orders/quote', requireAuth, requireApproved, orderController.quote);
router.post('/orders', requireAuth, requireApproved, validate(checkoutSchema), orderController.create);
router.get('/orders', requireAuth, requireApproved, orderController.list);
router.get('/orders/:orderNumber', requireAuth, requireApproved, orderController.detail);

// --- account ---------------------------------------------------------------
const account = [requireAuth, requireApproved];

router.get('/account/summary', ...account, accountController.summary);
router.patch('/account/profile', ...account, validate(profileSchema), accountController.updateProfile);

router.post('/account/addresses', ...account, validate(savedAddressSchema), accountController.addAddress);
router.patch('/account/addresses/:addressId', ...account, validate(savedAddressSchema), accountController.updateAddress);
router.delete('/account/addresses/:addressId', ...account, accountController.removeAddress);

router.post('/account/payment-methods', ...account, validate(paymentMethodSchema), accountController.addPaymentMethod);
router.delete('/account/payment-methods/:methodId', ...account, accountController.removePaymentMethod);

// Password change is available to any signed-in user, approved or not.
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
router.post('/admin/users/:id/store-credit', ...admin, validate(storeCreditSchema), adminController.allocateStoreCredit);

router.get('/admin/products', ...admin, adminController.listProducts);
router.post('/admin/products', ...admin, validate(productSchema), adminController.createProduct);
router.patch('/admin/products/:id', ...admin, validate(productSchema), adminController.updateProduct);
// Toggles isActive rather than deleting — orders reference products by id.
router.delete('/admin/products/:id', ...admin, adminController.toggleProduct);

router.get('/admin/orders', ...admin, adminController.listOrders);
router.patch('/admin/orders/:orderNumber/status', ...admin, validate(orderStatusSchema), adminController.updateOrderStatus);
// Refunds go to store credit — there is no gateway to send money back through.
router.post('/admin/orders/:orderNumber/refund', ...admin, validate(refundSchema), adminController.refundOrder);

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
