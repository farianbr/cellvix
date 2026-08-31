const { z } = require('zod');
const { addressSchema } = require('./checkout.js');

const profileSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter your business name.'),
  contactName: z.string().trim().min(2, 'Enter a contact name.'),
  phone: z.string().trim().min(7, 'Enter a phone number.'),
  website: z.string().trim().max(120).optional(),
  businessType: z.string().trim().max(80).optional(),
  taxId: z.string().trim().max(40).optional(),
  resellerCert: z.string().trim().max(60).optional(),
});

/** Saved addresses reuse the checkout address shape plus a label and defaults. */
const savedAddressSchema = addressSchema.extend({
  label: z.string().trim().min(1, 'Give this address a label.').max(40),
  isDefaultShipping: z.boolean().optional().default(false),
  isDefaultBilling: z.boolean().optional().default(false),
});

const paymentMethodSchema = z.object({
  type: z.enum(['card', 'ach']).default('card'),
  brand: z.string().trim().max(24).optional(),
  last4: z.string().trim().regex(/^\d{4}$/, 'Enter the last four digits.'),
  expMonth: z.coerce.number().int().min(1).max(12).optional(),
  expYear: z.coerce.number().int().min(2024).max(2100).optional(),
  isDefault: z.boolean().optional().default(false),
});

/**
 * Quick order pad: a list of SKUs and quantities, pasted or typed. Unresolvable
 * SKUs come back named rather than silently dropped.
 */
const bulkAddSchema = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string().trim().min(2).max(40),
        qty: z.coerce.number().int().min(1).max(9999).default(1),
      }),
    )
    .min(1, 'Add at least one SKU.')
    .max(200),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters.')
      .regex(/[A-Za-z]/, 'Include a letter.')
      .regex(/[0-9]/, 'Include a number.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

/** Sidebar sections, in render order. */
const ACCOUNT_NAV = [
  { key: 'overview', label: 'Overview', to: '/account', icon: 'LayoutDashboard' },
  { key: 'orders', label: 'Orders & tracking', to: '/account/orders', icon: 'Package' },
  { key: 'invoices', label: 'Invoices & statements', to: '/account/invoices', icon: 'FileText' },
  { key: 'credit', label: 'Credit & balance', to: '/account/credit', icon: 'Wallet' },
  { key: 'quick-order', label: 'Quick order pad', to: '/account/quick-order', icon: 'Zap' },
  { key: 'addresses', label: 'Saved addresses', to: '/account/addresses', icon: 'MapPin' },
  { key: 'payment', label: 'Payment methods', to: '/account/payment-methods', icon: 'CreditCard' },
  { key: 'company', label: 'Company & security', to: '/account/company', icon: 'Building2' },
];

/**
 * Advance recharge: the buyer prepays and holds the money as store credit.
 * Bounded at both ends — a $5 top-up costs more in gateway fees than it is
 * worth, and five figures should be a phone call to the trade desk.
 */
const rechargeSchema = z.object({
  amountDollars: z.coerce
    .number()
    .min(25, 'Top up at least $25.')
    .max(25_000, 'For a top-up this size, talk to your account rep.'),
  poNumber: z.string().trim().max(40).optional(),
});

// --- CommonJS exports -------------------------------------------------
exports.profileSchema = profileSchema;
exports.savedAddressSchema = savedAddressSchema;
exports.paymentMethodSchema = paymentMethodSchema;
exports.bulkAddSchema = bulkAddSchema;
exports.changePasswordSchema = changePasswordSchema;
exports.ACCOUNT_NAV = ACCOUNT_NAV;
exports.rechargeSchema = rechargeSchema;
