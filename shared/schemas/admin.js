const { z } = require('zod');
// The one password rule, shared rather than restated: an account an admin opens
// must not be allowed a weaker password than one a business opens for itself.
const { passwordSchema } = require('./auth.js');

const cents = z.coerce.number().int().min(0).max(100_000_000);

/**
 * Approving a business is where credit terms get set — it is one decision, not
 * two, so the approval payload carries them.
 */
const approveUserSchema = z.object({
  creditLimit: cents.default(0),
  terms: z.enum(['prepaid', 'net15', 'net30', 'net60']).default('prepaid'),
  accountRep: z
    .object({
      name: z.string().trim().max(80).optional(),
      email: z.string().trim().email().or(z.literal('')).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .optional(),
});

const rejectUserSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason — it goes in the notification email.').max(400),
});

const creditSchema = z.object({
  creditLimit: cents,
  terms: z.enum(['prepaid', 'net15', 'net30', 'net60']),
});

/**
 * An admin opening a client account directly, rather than waiting for the
 * business to register itself (§7.2's `+ Create > Client`).
 *
 * Deliberately **not** `registerSchema` with extra fields. Two differences
 * matter enough to keep them apart: an admin-opened account defaults to
 * `approved` — the admin is the approval, and making them create a pending
 * account only to approve it a second later is a step that means nothing — and
 * the account it opens carries credit terms from the first moment, which a
 * self-registration never does.
 */
const clientSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter a business name.').max(160),
  contactName: z.string().trim().min(2, 'Enter a contact name.').max(80),
  // A real address, not the empty-string-tolerant idiom `supplierSchema` uses:
  // this one is the account's sign-in identity, so it cannot be blank.
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a phone number.').max(40),
  password: passwordSchema,
  businessType: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(40).optional(),
  address: z
    .object({
      line1: z.string().trim().min(2, 'Enter a street address.').max(120),
      line2: z.string().trim().max(120).optional(),
      city: z.string().trim().min(2, 'Enter a city.').max(80),
      region: z.string().trim().min(2, 'Select a province.').max(2),
      postal: z
        .string()
        .trim()
        .regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, 'Enter a valid postal code.'),
    })
    .optional(),
  status: z.enum(['pending', 'approved']).default('approved'),
  creditLimit: cents.default(0),
  terms: z.enum(['prepaid', 'net15', 'net30', 'net60']).default('prepaid'),
});

/**
 * Editing a customer's profile.
 *
 * Not `clientSchema.partial()`: this endpoint writes a **strictly smaller set
 * of fields**. Password is absent because a reset is its own flow, and status,
 * `creditLimit` and `terms` are absent because each has an endpoint that does
 * more than set the field — an edit form that also wrote `status` would be a
 * second approval path with no reason, no rep and no audit trail of its own.
 *
 * The optional descriptors accept an empty string so an operator can clear a
 * tax ID they typed by mistake; the identity fields keep `clientSchema`'s
 * minimums, because they are still what the account is known by.
 */
const clientUpdateSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter a business name.').max(160).optional(),
  contactName: z.string().trim().min(2, 'Enter a contact name.').max(80).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').optional(),
  phone: z.string().trim().min(7, 'Enter a phone number.').max(40).optional(),
  businessType: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(40).optional(),
  address: z
    .object({
      line1: z.string().trim().min(2, 'Enter a street address.').max(120),
      line2: z.string().trim().max(120).optional(),
      city: z.string().trim().min(2, 'Enter a city.').max(80),
      region: z.string().trim().min(2, 'Select a province.').max(2),
      postal: z
        .string()
        .trim()
        .regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, 'Enter a valid postal code.'),
    })
    .optional(),
});

/** The contact channels consent is recorded against (CASL, §6.13). */
const CONSENT_CHANNELS = ['sms', 'whatsapp', 'email', 'call'];

/**
 * What a customer agreed to be contacted on.
 *
 * Every channel is required rather than optional: this endpoint records an
 * *answer*, and a partial payload would leave the unnamed channels at whatever
 * they were, which is indistinguishable from having been asked about them. The
 * form always sends all four.
 */
const contactConsentSchema = z.object({
  sms: z.boolean(),
  whatsapp: z.boolean(),
  email: z.boolean(),
  call: z.boolean(),
});

/** Membership tiers. A label — it never touches price (see the User model). */
const MEMBERSHIP_TIERS = [
  { value: 'standard', label: 'Standard' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
];

const tierSchema = z.object({
  tier: z.enum(['standard', 'silver', 'gold', 'platinum']),
});

const internalNoteSchema = z.object({
  body: z.string().trim().min(1, 'Write the note.').max(2000),
});

/**
 * Admin store-credit allocation. Signed: a negative amount is a correction, and
 * the reason is required for one because "where did $200 go" is a question
 * somebody will ask later.
 */
const storeCreditSchema = z.object({
  amountDollars: z.coerce
    .number()
    .refine((value) => value !== 0, 'Enter an amount.')
    .refine((value) => Math.abs(value) <= 1_000_000, 'That is more than this form will take.'),
  note: z.string().trim().max(240).optional(),
});

/** Refunds go to store credit — see storeCreditService.refundOrder. */
const refundSchema = z.object({
  amountDollars: z.coerce.number().positive('Enter an amount to refund.'),
  note: z.string().trim().max(240).optional(),
});

const userStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
});

const productSchema = z.object({
  sku: z.string().trim().min(3, 'Enter a SKU.').max(40),
  name: z.string().trim().min(3, 'Enter a product name.').max(160),
  description: z.string().trim().max(2000).optional(),
  partType: z.string().trim().min(2, 'Enter a part type slug.'),
  partTypeLabel: z.string().trim().min(2, 'Enter a part type label.'),
  grade: z.enum(['NEW', 'OEM', 'PULL-A', 'PULL-B', 'AFTERMARKET']),
  price: cents,
  compareAtPrice: cents.optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  deviceTypeSlug: z.string().trim().min(1, 'Select a device type.'),
  brandSlug: z.string().trim().min(1, 'Select a brand.'),
  seriesSlug: z.string().trim().min(1, 'Select a series.'),
  modelSlug: z.string().trim().min(1, 'Select a model.'),
  isActive: z.boolean().default(true),
});

const ORDER_STATUS_FLOW = [
  'placed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

const orderStatusSchema = z.object({
  status: z.enum([...ORDER_STATUS_FLOW, 'cancelled']),
  note: z.string().trim().max(300).optional(),
  tracking: z
    .object({
      carrier: z.string().trim().max(60).optional(),
      number: z.string().trim().max(60).optional(),
      url: z.string().trim().max(300).optional(),
    })
    .optional(),
});

const CARRIERS = [
  { value: 'Purolator', label: 'Purolator', url: 'https://www.purolator.com/en/shipping/tracker' },
  {
    value: 'Canada Post',
    label: 'Canada Post',
    url: 'https://www.canadapost-postescanada.ca/track-reperage',
  },
  { value: 'FedEx Canada', label: 'FedEx Canada', url: 'https://www.fedex.com/fedextrack' },
  { value: 'UPS Canada', label: 'UPS Canada', url: 'https://www.ups.com/track' },
];

/**
 * The admin sidebar, two levels deep (ERP rework §5).
 *
 * Shape: a flat `Home` row, then six groups whose children are the real
 * screens. `icon` names a lucide export; the shell maps it — the schema stays
 * a plain data module so the server can read it too.
 *
 * `badge` names a counter on `GET /admin/stats`; the sidebar renders it when
 * the count is non-zero.
 *
 * `area` is the permission area this item lives under (§7.6). Group-level, so
 * every child inherits its parent's area — a per-page matrix is twenty rows
 * nobody maintains correctly.
 */
const ADMIN_NAV = [
  { key: 'home', label: 'Home', to: '/admin', icon: 'Home', area: 'home' },
  {
    key: 'sales',
    label: 'Sales',
    icon: 'ShoppingBag',
    area: 'sales',
    children: [
      {
        // "Customers" in the sidebar; the key and the route stay `clients`,
        // because the key is what highlighting and permissions match on and
        // the URL is linked to from the dashboard, the bell and bookmarks.
        key: 'clients',
        label: 'Customers',
        to: '/admin/clients',
        icon: 'Users',
        badge: 'pendingUsers',
      },
      {
        key: 'tickets',
        label: 'Tickets',
        to: '/admin/tickets',
        icon: 'ClipboardList',
        badge: 'openTickets',
      },
      { key: 'rma', label: 'RMA / Returns', to: '/admin/rma', icon: 'RotateCcw', badge: 'openRmas' },
      { key: 'orders', label: 'Orders', to: '/admin/orders', icon: 'Package' },
      {
        key: 'invoices',
        label: 'Invoices',
        to: '/admin/invoices',
        icon: 'FileText',
        badge: 'overdueInvoices',
      },
      { key: 'quotes', label: 'Quotes', to: '/admin/quotes', icon: 'FileSignature' },
    ],
  },
  {
    key: 'purchase',
    label: 'Purchase',
    icon: 'ShoppingCart',
    area: 'purchase',
    children: [
      { key: 'suppliers', label: 'Suppliers', to: '/admin/suppliers', icon: 'Truck' },
      {
        key: 'pos',
        label: 'Purchase Orders',
        to: '/admin/purchase-orders',
        icon: 'ClipboardList',
      },
      {
        // The purchase-side counterpart of Sales § RMA: stock going back OUT to
        // a supplier, and a credit claimed rather than given.
        key: 'supplier-returns',
        label: 'RMA / Returns',
        to: '/admin/supplier-returns',
        icon: 'RotateCcw',
      },
      {
        key: 'supplier-subscriptions',
        label: 'Subscription Plans',
        to: '/admin/supplier-subscriptions',
        icon: 'CalendarClock',
      },
      {
        key: 'supplier-services',
        label: 'Service Products',
        to: '/admin/supplier-services',
        icon: 'Wrench',
      },
      { key: 'expenses', label: 'Expenses', to: '/admin/expenses', icon: 'Receipt' },
      { key: 'inventory', label: 'Inventory', to: '/admin/inventory', icon: 'Boxes', badge: 'lowStock' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'BarChart3',
    area: 'reports',
    children: [
      { key: 'business', label: 'Business Overview', to: '/admin/reports/business', icon: 'LineChart' },
      // `isDefault` marks the view a bare `/admin/reports` lands on. The page
      // deletes `?tab=summary` from the URL rather than carrying a redundant
      // parameter, so without this the sidebar would highlight nothing there.
      {
        key: 'summary',
        label: 'Summary',
        to: '/admin/reports?tab=summary',
        icon: 'PieChart',
        isDefault: true,
      },
      { key: 'pl', label: 'Profit & Loss', to: '/admin/reports?tab=pl', icon: 'Scale' },
      { key: 'r-sales', label: 'Sales', to: '/admin/reports?tab=sales', icon: 'FileText' },
      { key: 'r-expense', label: 'Expense', to: '/admin/reports?tab=expense', icon: 'Receipt' },
      { key: 'r-inv', label: 'Inventory', to: '/admin/reports?tab=inventory', icon: 'Boxes' },
      { key: 'r-tax', label: 'Tax', to: '/admin/reports?tab=tax', icon: 'Percent' },
      { key: 'r-staff', label: 'Staff Performance', to: '/admin/reports?tab=staff', icon: 'Users' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: 'Megaphone',
    area: 'marketing',
    children: [
      { key: 'calls', label: 'Call', to: '/admin/marketing/calls', icon: 'Phone' },
      { key: 'email', label: 'Email', to: '/admin/marketing/email', icon: 'Mail' },
      { key: 'sms', label: 'SMS', to: '/admin/marketing/sms', icon: 'MessageSquare' },
      { key: 'whatsapp', label: 'WhatsApp', to: '/admin/marketing/whatsapp', icon: 'MessageCircle' },
      { key: 'referrals', label: 'Referrals', to: '/admin/marketing/referrals', icon: 'Gift' },
      { key: 'offers', label: 'Offers', to: '/admin/marketing/offers', icon: 'Tag' },
      { key: 'blog', label: 'Blog', to: '/admin/marketing/blog', icon: 'Newspaper' },
      { key: 'faq', label: 'FAQ', to: '/admin/marketing/faq', icon: 'HelpCircle' },
    ],
  },
  {
    key: 'outlet',
    label: 'Outlet',
    icon: 'Store',
    area: 'outlet',
    children: [
      { key: 'outlet-add', label: 'Add Outlet', to: '/admin/outlets/add', icon: 'PlusCircle' },
      { key: 'outlet-list', label: 'List Outlet', to: '/admin/outlets', icon: 'List' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'Settings',
    area: 'settings',
    children: [
      { key: 's-summary', label: 'Summary', to: '/admin/settings', icon: 'LayoutGrid' },
      {
        key: 's-business',
        label: 'Business',
        to: '/admin/settings?cat=business',
        icon: 'Building2',
      },
      { key: 's-finance', label: 'Financial', to: '/admin/settings?cat=financial', icon: 'Coins' },
      {
        key: 's-users',
        label: 'Users & Access',
        to: '/admin/settings?cat=users',
        icon: 'UsersRound',
      },
      {
        key: 's-sched',
        label: 'Scheduling & Booking',
        to: '/admin/settings?cat=scheduling',
        icon: 'CalendarDays',
      },
      {
        key: 's-comms',
        // The sidebar is 220px wide; the full name is what the breadcrumb and
        // the Settings summary card use.
        label: 'Communications',
        to: '/admin/settings?cat=communications',
        icon: 'Bell',
      },
      {
        key: 's-system',
        label: 'System & Logs',
        to: '/admin/settings?cat=system',
        icon: 'ClipboardList',
      },
      {
        key: 's-api',
        label: 'Integrations & API',
        to: '/admin/settings?cat=integrations',
        icon: 'Plug',
      },
    ],
  },
];

/**
 * Old flat-admin URLs, kept alive as redirects rather than 404s (§4). Someone
 * has `/admin/products` bookmarked and there is no reason to punish them.
 */
const ADMIN_LEGACY_REDIRECTS = {
  '/admin/approvals': '/admin/clients?status=pending',
  '/admin/products': '/admin/inventory',
  '/admin/customers': '/admin/clients',
  '/admin/offers': '/admin/marketing/offers',
  '/admin/blog': '/admin/marketing/blog',
  '/admin/faqs': '/admin/marketing/faq',
  '/admin/expenses/categories': '/admin/settings/expense-categories',
};

/**
 * Recording a payment against an invoice.
 *
 * The client sends an amount, a date, a method and a reference — never a status
 * and never a running total. `amountPaid` and the invoice status are both
 * recomputed server-side from the payment rows.
 */
const invoicePaymentSchema = z.object({
  amountDollars: z.coerce.number().positive('Enter an amount to record.'),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.')
    .optional(),
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(80).optional(),
});

/** Voiding forgives the balance and keeps the row, so the reason is required. */
const invoiceVoidSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason — it stays on the invoice.').max(240),
});

/**
 * Bulk order status advancement.
 *
 * Same rule as the single-order route: only forward transitions, and the server
 * decides which of the selected orders can actually make the move rather than
 * trusting the client's selection.
 */
const bulkOrderStatusSchema = z.object({
  orderNumbers: z
    .array(z.string().trim().min(3))
    .min(1, 'Select at least one order.')
    .max(100, 'That is more orders than this action will take at once.'),
  status: z.enum([...ORDER_STATUS_FLOW, 'cancelled']),
  note: z.string().trim().max(300).optional(),
});

// ---- phase 5: purchase ------------------------------------------------------

/**
 * A supplier. `paymentTerms` reuses the same vocabulary as a client's line of
 * credit, read the other way round — what Cellvix owes, not what it is owed.
 */
const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Enter a supplier name.').max(120),
  code: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Enter a valid email.').or(z.literal('')).optional(),
  phone: z.string().trim().max(40).optional(),
  contactName: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  address: z
    .object({
      line1: z.string().trim().max(120).optional(),
      line2: z.string().trim().max(120).optional(),
      city: z.string().trim().max(80).optional(),
      region: z.string().trim().max(2).optional(),
      postal: z.string().trim().max(10).optional(),
      country: z.string().trim().max(2).default('CA'),
    })
    .optional(),
  paymentTerms: z.enum(['prepaid', 'net15', 'net30', 'net60']).default('net30'),
  notes: z.string().trim().max(2000).optional(),
  isActive: z.boolean().default(true),
});

/**
 * A purchase-order line.
 *
 * `unitCost` is what Cellvix pays and **is** sent by the client — unlike a
 * sales price, which is always read from the catalogue. A purchase price is
 * negotiated per order and has no server-side source of truth to read it from;
 * what the server still owns is every total computed from it (§8, invariant 8).
 */
const purchaseOrderItemSchema = z.object({
  product: z.string().trim().min(1, 'Pick a product.'),
  qtyOrdered: z.coerce.number().int().min(1, 'Order at least one.').max(100_000),
  unitCost: cents,
});

const purchaseOrderSchema = z.object({
  supplier: z.string().trim().min(1, 'Pick a supplier.'),
  items: z.array(purchaseOrderItemSchema).min(1, 'Add at least one line.').max(200),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  tax: cents.default(0),
  shipping: cents.default(0),
  notes: z.string().trim().max(2000).optional(),
});

/** `draft → sent` and `cancelled` are the only operator-chosen transitions. */
const purchaseOrderStatusSchema = z.object({
  status: z.enum(['sent', 'cancelled']),
  note: z.string().trim().max(300).optional(),
});

/**
 * Receiving. The client sends quantities received **in this delivery**, never a
 * running total and never a status: the status is derived from whether any line
 * is still short, and stock is incremented server-side with a `StockMovement`
 * written for each line (§6.8, automation contract).
 */
const purchaseReceiveSchema = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        qty: z.coerce.number().int().min(0).max(100_000),
      }),
    )
    .min(1, 'Nothing to receive.')
    .max(200),
  note: z.string().trim().max(300).optional(),
});

/** Recording a PO payment creates an `Expense` row — server-side, once. */
const purchasePaymentSchema = z.object({
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(80).optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  category: z.string().trim().optional(),
});

const expenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.'),
  description: z.string().trim().min(2, 'Say what this was for.').max(240),
  category: z.string().trim().min(1, 'Pick a category.'),
  payee: z.string().trim().max(120).optional(),
  method: z.string().trim().max(40).optional(),
  status: z.enum(['pending', 'paid']).default('paid'),
  amount: cents.refine((value) => value > 0, 'Enter an amount.'),
  tax: cents.default(0),
  taxIncluded: z.boolean().default(true),
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const expenseCategorySchema = z.object({
  name: z.string().trim().min(2, 'Enter a category name.').max(60),
  colorToken: z.string().trim().max(24).default('ink'),
  gstApplicable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  order: z.coerce.number().int().min(0).max(999).default(0),
});

/**
 * A manual stock adjustment.
 *
 * Signed, and the reason is required: "why is this 40 and not 47" is a question
 * somebody asks later, and an unexplained correction cannot answer it.
 */
const stockAdjustSchema = z.object({
  qtyChange: z.coerce
    .number()
    .int()
    .refine((value) => value !== 0, 'Enter a change.')
    .refine((value) => Math.abs(value) <= 1_000_000, 'That is more than this form will take.'),
  type: z.enum(['adjustment', 'damage', 'return', 'transfer']).default('adjustment'),
  note: z.string().trim().min(3, 'Give a reason — it stays on the movement.').max(300),
});

/** The ERP fields on a product (§6.10). Separate from `productSchema` so the
 *  existing product form is unchanged and this can be sent on its own. */
const productOpsSchema = z.object({
  minStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  cost: cents.default(0),
  location: z.string().trim().max(40).optional(),
  supplier: z.string().trim().optional(),
  barcode: z.string().trim().max(60).optional(),
});

// ---- phase 7: quotes & RMA --------------------------------------------------

/**
 * A quote line.
 *
 * `unitPrice` **is** sent by the client here, unlike a sale — a quote is a
 * negotiated number and has no server-side source of truth to read it from.
 * Zero means "use the catalogue price", so an operator quoting at list does not
 * have to retype it. Every total computed from it stays the server's.
 */
const quoteItemSchema = z.object({
  product: z.string().trim().min(1, 'Pick a product.'),
  qty: z.coerce.number().int().min(1, 'Quote at least one.').max(100_000),
  unitPrice: cents.default(0),
});

const quoteSchema = z.object({
  user: z.string().trim().min(1, 'Pick a client.'),
  items: z.array(quoteItemSchema).min(1, 'Add at least one line.').max(200),
  shipping: cents.default(0),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.')
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * `converted` is absent on purpose: that status is written only as the result
 * of an order actually being created, never chosen by hand. A status that can
 * be set directly is a status that can lie about whether an order exists.
 */
const quoteStatusSchema = z.object({
  status: z.enum(['sent', 'accepted', 'rejected']),
  note: z.string().trim().max(300).optional(),
});

/**
 * Conversion. `acknowledgeDrift` is the admin confirming they have seen the
 * catalogue prices that moved since the quote was issued — without it the
 * server refuses and returns the comparison instead.
 */
const quoteConvertSchema = z.object({
  acknowledgeDrift: z.boolean().default(false),
  deliveryCode: z.enum(['ground', 'express', 'pickup']).default('ground'),
});

/**
 * An admin raising an order directly — a phone order, a walk-in, an account
 * that placed it by email (§7.2's `+ Create > Order`).
 *
 * Shaped like `quoteSchema` because it is the same act one step further along,
 * and `unitPrice` carries the same meaning: zero means "use the catalogue
 * price". What it does **not** carry is any total, discount or tax — those are
 * recomputed server-side from live products, exactly as at checkout, because a
 * client that can send a price is a client that can set one.
 */
const adminOrderSchema = z.object({
  user: z.string().trim().min(1, 'Pick a client.'),
  items: z.array(quoteItemSchema).min(1, 'Add at least one line.').max(200),
  shipping: cents.default(0),
  deliveryCode: z.enum(['ground', 'express', 'pickup']).default('ground'),
  poNumber: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * A standalone invoice — one raised against an account for something no order
 * covers: a restocking fee, a repair, an agreed adjustment (§7.2's
 * `+ Create > Invoice`).
 *
 * `Invoice.order` has always been optional; this is the first thing to use
 * that. There are no line items because the model has no place to put them —
 * an invoice stores a single `amount`, and inventing an items array here would
 * mean the number on screen and the number in the database came from different
 * places.
 */
const adminInvoiceSchema = z.object({
  user: z.string().trim().min(1, 'Pick a client.'),
  amount: cents.refine((value) => value > 0, 'Enter an amount.'),
  terms: z.enum(['prepaid', 'net15', 'net30', 'net60']).default('prepaid'),
  issuedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.')
    .optional(),
  // Left blank, the server derives it from the terms. Sent, it wins — an
  // agreed due date is a fact about the arrangement, not about the terms table.
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.')
    .optional(),
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const RMA_ITEM_DISPOSITIONS = ['pending', 'restock', 'scrap', 'return_to_supplier', 'reject'];

const rmaSchema = z.object({
  orderNumber: z.string().trim().min(3, 'Enter the order number.'),
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        qty: z.coerce.number().int().min(1, 'Return at least one.').max(100_000),
        reason: z.string().trim().max(300).optional(),
      }),
    )
    .min(1, 'Add at least one line.')
    .max(100),
  reason: z.string().trim().min(3, 'Say why this is coming back.').max(500),
});

/**
 * `resolved` is absent: resolving decides money and stock, so it goes through
 * its own action which carries that decision with it.
 */
const rmaStatusSchema = z.object({
  status: z.enum(['approved', 'in_transit', 'received', 'inspecting', 'rejected']),
  note: z.string().trim().max(300).optional(),
});

const rmaInspectSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        condition: z.string().trim().max(300).optional(),
        disposition: z.enum(RMA_ITEM_DISPOSITIONS).optional(),
      }),
    )
    .max(100)
    .optional(),
  inspectionNotes: z.string().trim().max(2000).optional(),
});

/**
 * Resolution. The amount is only read for a refund, and it routes through
 * `storeCreditService` — this schema never carries a balance, only an intent.
 */
const rmaResolveSchema = z
  .object({
    resolution: z.enum(['refund', 'replace', 'reject']),
    amountDollars: z.coerce.number().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine(
    (value) => value.resolution !== 'refund' || (value.amountDollars ?? 0) > 0,
    { message: 'Enter an amount to refund.', path: ['amountDollars'] },
  );

// ---- repair tickets ---------------------------------------------------------

/**
 * The status vocabulary, duplicated from `models/Ticket.js` for the same reason
 * the permission areas below are: `shared/` is the boundary both halves read,
 * and importing from `server/` would drag mongoose into the browser bundle.
 */
const TICKET_STATUSES = [
  'diagnosis',
  'accepted',
  'waiting_for_parts',
  'ready_to_repair',
  'processing',
  'retention_policy',
  'ready_to_pickup',
  'completed',
  'cancelled',
];

const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TICKET_SOURCES = ['counter', 'kiosk', 'web', 'phone'];

/** Human labels, so the pills and the selects cannot drift apart. */
const TICKET_STATUS_LABELS = {
  diagnosis: 'Diagnosis',
  accepted: 'Accepted',
  waiting_for_parts: 'Waiting for Parts',
  ready_to_repair: 'Ready to Repair',
  processing: 'Processing',
  retention_policy: 'Retention Policy',
  ready_to_pickup: 'Ready to Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Opening a ticket.
 *
 * The customer is a name and a phone, not an account id — a repair is a
 * walk-in, and requiring an approved business first would make the counter
 * unusable. The phone is required because it is how the shop calls someone to
 * say their device is ready; without it the ticket cannot be closed out.
 */
const ticketSchema = z.object({
  customerName: z.string().trim().min(2, 'Enter the customer name.').max(120),
  customerPhone: z.string().trim().min(7, 'Enter a contact number.').max(40),
  customerEmail: z.string().trim().email('Enter a valid email.').or(z.literal('')).optional(),

  deviceBrand: z.string().trim().max(60).optional(),
  deviceModel: z.string().trim().max(120).optional(),
  deviceSerial: z.string().trim().max(80).optional(),
  issue: z.string().trim().min(3, 'Describe the fault.').max(500),

  status: z.enum(TICKET_STATUSES).default('diagnosis'),
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
  source: z.enum(TICKET_SOURCES).default('counter'),

  // Empty string means "unassigned" — a select cannot emit `undefined`.
  technician: z.string().trim().or(z.literal('')).optional(),

  estimateDollars: z.coerce.number().min(0).max(1_000_000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** Everything on the create form is editable afterwards except the status. */
const ticketUpdateSchema = ticketSchema
  .omit({ status: true })
  .partial()
  .extend({ finalDollars: z.coerce.number().min(0).max(1_000_000).optional() });

/**
 * Moving a ticket.
 *
 * Any status to any status: a repair genuinely goes backwards when the wrong
 * part arrives, so the ladder is not enforced. The move is recorded on the
 * ticket timeline instead — the audit trail is the control here.
 */
const ticketStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  note: z.string().trim().max(300).optional(),
});

// ---- phase 8: outlets, roles and staff --------------------------------------

/**
 * Access areas and levels (§7.6). Duplicated from `models/Role.js` rather than
 * imported: `shared/` is the boundary both halves read, and a schema that
 * imports from `server/` would drag mongoose into the browser bundle.
 */
const PERMISSION_AREAS = [
  'clients',
  'sales',
  'purchase',
  'reports',
  'marketing',
  'outlet',
  'settings',
];

const PERMISSION_LEVELS = ['none', 'view', 'full'];

/** Human labels for the Roles & Access selects. */
const PERMISSION_LEVEL_LABELS = {
  none: 'No access',
  view: 'Read only',
  full: 'Full',
};

const OUTLET_STATUSES = ['active', 'inactive', 'maintenance'];
const OUTLET_COLOR_TOKENS = ['brand', 'info', 'success', 'warn', 'danger', 'ink'];

const POSTAL_CA = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const outletHoursSchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  open: z.string().trim().max(5).optional(),
  close: z.string().trim().max(5).optional(),
  closed: z.boolean().default(false),
});

/**
 * `code` is absent on purpose — it is assigned server-side (§6.14). A code the
 * form proposes is a code two operators can pick in the same moment.
 */
const outletSchema = z.object({
  name: z.string().trim().min(1, 'Enter an outlet name.').max(120),
  status: z.enum(OUTLET_STATUSES).default('active'),
  colorToken: z.enum(OUTLET_COLOR_TOKENS).default('brand'),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      line2: z.string().trim().max(200).optional(),
      city: z.string().trim().max(120).optional(),
      region: z.string().trim().max(60).optional(),
      // Canadian conventions throughout. Empty is allowed — an outlet can be
      // filed before its lease is signed — but a value that is present must be
      // a real postal code.
      postal: z
        .string()
        .trim()
        .regex(POSTAL_CA, 'Enter a valid postal code (A1A 1A1).')
        .optional()
        .or(z.literal('')),
      country: z.string().trim().max(60).default('Canada'),
    })
    .default({}),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  manager: z.string().trim().max(120).optional(),
  hours: z.array(outletHoursSchema).max(7).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const areasSchema = z.object(
  PERMISSION_AREAS.reduce(
    (out, area) => ({ ...out, [area]: z.enum(PERMISSION_LEVELS).default('none') }),
    {},
  ),
);

const roleSchema = z.object({
  name: z.string().trim().min(1, 'Enter a role name.').max(60),
  areas: areasSchema.default({}),
});

/**
 * Creating a Cellvix person. `accountType` is the account kind; `staffRole` is
 * the permission set, and is required for staff — enforced here and again in
 * the service, because access granted by an omitted field is access nobody
 * chose to grant.
 */
const staffUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name.').max(120),
    email: z.string().trim().email('Enter a valid email.'),
    password: z.string().min(8, 'Use at least 8 characters.').max(200),
    phone: z.string().trim().max(40).optional(),
    accountType: z.enum(['staff', 'admin']).default('staff'),
    staffRole: z.string().trim().optional(),
    outlet: z.string().trim().optional(),
  })
  .refine((value) => value.accountType !== 'staff' || Boolean(value.staffRole), {
    message: 'Choose a role for this staff member.',
    path: ['staffRole'],
  });

/** The edit form. No password — changing one has its own route and its own rules. */
const staffUserUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  accountType: z.enum(['staff', 'admin']).optional(),
  staffRole: z.string().trim().nullable().optional(),
  outlet: z.string().trim().nullable().optional(),
  locked: z.boolean().optional(),
});

// ---- phase 9: marketing -----------------------------------------------------

/**
 * Duplicated from `models/MessageLog.js` and `models/Campaign.js` for the same
 * reason the permission areas are: `shared/` is the boundary both halves read,
 * and importing from `server/` would drag mongoose into the browser bundle.
 */
const MESSAGE_CHANNELS = ['call', 'sms', 'whatsapp', 'email'];
const TEMPLATE_DOCUMENTS = ['none', 'order', 'invoice', 'quote', 'rma'];
const CAMPAIGN_AUDIENCES = ['approved', 'pending', 'all_customers', 'with_orders'];

const CAMPAIGN_AUDIENCE_LABELS = {
  approved: 'Approved accounts',
  pending: 'Pending accounts',
  all_customers: 'All customer accounts',
  with_orders: 'Accounts that have ordered',
};

/**
 * Composing on a channel.
 *
 * There is no `status` field, and that is the point: whether a message was sent
 * is decided by the server from the provider's real state (§6b rule 4). A
 * client that could name its own status could report a send that never
 * happened.
 */
const messageSchema = z
  .object({
    userId: z.string().trim().min(1, 'Choose an account.'),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().max(5000).optional(),
    // Calls are the only inbound-capable channel today — somebody rang us.
    direction: z.enum(['inbound', 'outbound']).default('outbound'),
    recordingUrl: z.string().trim().url('Enter a valid URL.').optional().or(z.literal('')),
    templateId: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.body?.trim()) || Boolean(value.templateId), {
    message: 'Write a message or pick a template.',
    path: ['body'],
  });

/** Logging a call. Notes stand in for the body, and there is nothing to send. */
const callLogSchema = z.object({
  userId: z.string().trim().min(1, 'Choose an account.'),
  direction: z.enum(['inbound', 'outbound']).default('outbound'),
  body: z.string().trim().min(1, 'Write what the call was about.').max(5000),
  recordingUrl: z.string().trim().url('Enter a valid URL.').optional().or(z.literal('')),
});

const messageTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name this template.').max(120),
  channel: z.enum(MESSAGE_CHANNELS),
  document: z.enum(TEMPLATE_DOCUMENTS).default('none'),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, 'Write the message.').max(5000),
  isActive: z.boolean().default(true),
});

/**
 * A campaign. `audience` names a filter, never a list of recipients — consent
 * is resolved at send time, so a list captured here would be both stale and
 * unlawful to rely on (§6.13).
 */
const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Name this campaign.').max(120),
  subject: z.string().trim().min(1, 'Write a subject line.').max(200),
  body: z.string().trim().min(1, 'Write the email.').max(20000),
  audience: z
    .object({ filter: z.enum(CAMPAIGN_AUDIENCES).default('approved') })
    .default({ filter: 'approved' }),
});

/**
 * The public unsubscribe payload — the account id and the HMAC from the link.
 * Deliberately unauthenticated: CASL requires the mechanism to work without a
 * sign-in, and the token is what stands in for one.
 */
const unsubscribeSchema = z.object({
  u: z.string().trim().min(1),
  t: z.string().trim().min(1),
});

// ---- phase 10: referral commission ------------------------------------------

/**
 * The commission rate, as a percentage — 5 means 5%.
 *
 * This is the only writable field in the whole referral feature. Accruals are
 * produced by payments and reversed by refunds; nothing may write one by hand,
 * and `referredBy` is set once at registration and never edited (§6.13).
 */
const referralRateSchema = z.object({
  percent: z.coerce
    .number()
    .min(0, 'A rate cannot be negative.')
    .max(100, 'A rate above 100% would pay out more than was collected.'),
});

// ---- phase 11a: settings ----------------------------------------------------

/**
 * Business Info (§6.15, category 1).
 *
 * Feeds invoices, transactional email and the storefront footer. Only the name
 * is required — a business that has not yet been given a website should be able
 * to save the fields it does have rather than being blocked on the ones it
 * does not.
 */
const businessInfoSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name.').max(120),
  tagline: z.string().trim().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email address.').optional().or(z.literal('')),
  website: z.string().trim().url('Enter a valid URL.').optional().or(z.literal('')),
  taxNumber: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.object({
    line1: z.string().trim().max(160).optional().or(z.literal('')),
    line2: z.string().trim().max(160).optional().or(z.literal('')),
    city: z.string().trim().max(80).optional().or(z.literal('')),
    region: z.string().trim().max(2).optional().or(z.literal('')),
    postal: z
      .string()
      .trim()
      .regex(POSTAL_CA, 'Enter a valid postal code (A1A 1A1).')
      .optional()
      .or(z.literal('')),
    country: z.string().trim().max(2).default('CA'),
  }),
});

/**
 * One province's tax rate.
 *
 * **A fraction, not a percentage** — `0.13`, never `13`. The model stores it
 * this way and `Settings.rateFor` reads it this way, so the conversion happens
 * once, in the screen, rather than being a thing every reader has to remember.
 * The 0.35 ceiling is a sanity bound: no Canadian combined rate is close to it,
 * and a value above it is far more likely to be a percentage typed into a
 * fraction field than a real rate.
 */
const taxRateRowSchema = z.object({
  province: z.string().trim().length(2),
  rate: z.coerce
    .number()
    .min(0, 'A tax rate cannot be negative.')
    .max(0.35, 'That looks like a percentage. Enter a fraction — 13% is 0.13.'),
  kind: z.enum(['GST', 'HST', 'GST+PST', 'GST+QST']),
});

/**
 * Sale Settings (§6.15, category 2).
 *
 * `warrantyByGrade` is keyed on **product grade**, not membership tier —
 * wholesale warranties on what the part is, not on who bought it (§6.15).
 */
const saleSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(64),
  defaultDueDays: z.coerce
    .number()
    .int()
    .min(0, 'Due days cannot be negative.')
    .max(365, 'Use 365 days or fewer.'),
  taxRatesByProvince: z.array(taxRateRowSchema).min(1, 'Keep at least one province.'),
  warrantyByGrade: z.record(
    z.string(),
    z.coerce.number().int().min(0, 'A warranty cannot be negative.').max(3650),
  ),
  // Extra days a tier adds on top of the grade. Non-negative by construction:
  // a tier improves cover or leaves it alone, and a negative "bonus" that
  // shortened a warranty would be a penalty wearing the wrong name.
  warrantyBonusByTier: z
    .record(
      z.string(),
      z.coerce.number().int().min(0, 'A tier bonus cannot be negative.').max(3650),
    )
    .optional(),
  rmaSlaDays: z.coerce.number().int().min(1, 'Enter at least one day.').max(365),
});

/**
 * Shipping Rates (§6.15).
 *
 * `code` is present but never written — the service matches on it and refuses
 * anything it does not already have, because checkout validates
 * `deliveryMethod` against a fixed enum and a band invented here would be
 * unselectable.
 *
 * `freeOver` is nullable on purpose: empty means "never ships free", which is
 * a different statement from `0`.
 */
const shippingSettingsSchema = z.object({
  methods: z
    .array(
      z.object({
        code: z.string().trim().min(1),
        label: z.string().trim().min(1, 'Name this method.').max(60),
        detail: z.string().trim().max(120).optional().or(z.literal('')),
        cost: cents,
        etaDays: z.coerce.number().int().min(0).max(60),
        freeOver: cents.nullable().optional(),
      }),
    )
    .min(1),
});

/**
 * Payment Methods (§6.15) — the list staff pick from when recording money
 * moving. **Not** the buyer's saved cards, which are `User.paymentMethods`.
 *
 * `code` is the stable key that expenses and payments store, so it is set once
 * from the label and then frozen.
 */
const paymentMethodsSettingsSchema = z.object({
  methods: z
    .array(
      z.object({
        code: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9-]+$/, 'A code is lowercase letters, numbers and dashes.'),
        label: z.string().trim().min(1, 'Name this method.').max(60),
      }),
    )
    .min(1, 'Keep at least one payment method.'),
});

/**
 * Inventory Settings (§6.15).
 *
 * Pre-fills the New Product form; a per-product value always wins, and nothing
 * here reprices anything already in the catalogue.
 *
 * Margin stops below 100 because `markup = margin ÷ (100 − margin) × 100`
 * divides by zero at 100 — a 100% margin means selling at infinite markup on a
 * zero cost, which is not a number a form should accept.
 */
const inventorySettingsSchema = z.object({
  defaultMarkupPercent: z.coerce
    .number()
    .min(0, 'A markup cannot be negative.')
    .max(1000, 'Use 1000% or less.'),
  defaultMarginPercent: z.coerce
    .number()
    .min(0, 'A margin cannot be negative.')
    .max(99.9, 'A margin of 100% or more has no finite markup.'),
});

// ---- phase 11c: provider credentials ----------------------------------------

/**
 * Writing one provider's credentials (§6.15, category 7).
 *
 * Deliberately a loose record rather than a per-provider shape: the field names
 * are validated server-side against `PROVIDER_FIELDS`, which is the list the
 * screen renders from, and duplicating that list here would give it two places
 * to drift.
 *
 * **An empty string is meaningful.** It clears the field — that is how a key is
 * removed — and it has to stay distinguishable from an absent key, which means
 * "leave this one alone". So empty is allowed and `.strict()` is not used.
 *
 * There is no schema for *reading* a credential, because there is no route that
 * returns one.
 */
const providerCredentialSchema = z.record(
  z.string(),
  z.string().trim().max(500, 'That is longer than any provider key.'),
);

// ---- phase 11d: taxonomy & invoice status rules -----------------------------

/**
 * Editing a taxonomy node (§6.15 — *Device & Models*).
 *
 * **Only the safe fields.** `kind`, `slug` and `parent` are absent on purpose:
 * every product carries a denormalised `path` written against that structure,
 * so changing one here would detach products from a tree that still looks
 * correct on screen. Restructuring is a re-seed, not a form.
 */
const taxonomyNodeSchema = z.object({
  name: z.string().trim().min(1, 'Give this a name.').max(120),
  // Accepts an array or a comma-separated string; the service normalises both
  // to lowercase, deduplicated entries.
  aliases: z
    .union([z.array(z.string().trim().max(60)), z.string().trim().max(600)])
    .optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
});

/**
 * One time-lapse invoice message (§6.15).
 *
 * `delayDays` is **signed**: negative means before the trigger, which is how
 * "remind them three days before it is due" is expressed without a second
 * direction field that could contradict it.
 */
const invoiceStatusRuleSchema = z.object({
  label: z.string().trim().min(1, 'Name this message.').max(80),
  trigger: z.enum(['invoice_created', 'invoice_due', 'invoice_overdue', 'invoice_paid']),
  delayDays: z.coerce
    .number()
    .int()
    .min(-365, 'That is more than a year before.')
    .max(365, 'That is more than a year after.')
    .default(0),
  channel: z.enum(MESSAGE_CHANNELS).default('email'),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, 'Write the message.').max(5000),
  isActive: z.boolean().default(false),
});

// ---- phase 11e: email settings ----------------------------------------------

/**
 * Automatic email and the reminder schedule (§6.15, category 5).
 *
 * Every toggle defaults **off** in the model, and this schema does not
 * re-default them: the form always posts the full set, so an absent key here
 * would mean "switch it off" rather than "leave it alone" — which is the wrong
 * reading for a payload that is meant to be complete.
 */
const communicationsSettingsSchema = z.object({
  invoiceOnOrder: z.boolean(),
  quoteOnCreate: z.boolean(),
  paymentConfirmation: z.boolean(),
  paymentStatusUpdates: z.boolean(),
  accountApproved: z.boolean(),
  accountRejected: z.boolean(),
  invoiceReminders: z.boolean(),
  lowStockAlerts: z.boolean(),

  reminderDaysBefore: z.coerce.number().int().min(0, 'Use 0 or more days.').max(90),
  followUpDaysAfter: z.coerce.number().int().min(0, 'Use 0 or more days.').max(90),
  adminEmail: z.string().trim().email('Enter a valid email address.').optional().or(z.literal('')),
  // Cents. 0 means "never notify on size" — distinct from an empty field.
  notifyAboveAmount: cents.default(0),
  lowStockEmail: z.string().trim().email('Enter a valid email address.').optional().or(z.literal('')),
});

// --- CommonJS exports -------------------------------------------------
exports.approveUserSchema = approveUserSchema;
exports.rejectUserSchema = rejectUserSchema;
exports.creditSchema = creditSchema;
exports.clientSchema = clientSchema;
exports.clientUpdateSchema = clientUpdateSchema;
exports.CONSENT_CHANNELS = CONSENT_CHANNELS;
exports.contactConsentSchema = contactConsentSchema;
exports.MEMBERSHIP_TIERS = MEMBERSHIP_TIERS;
exports.tierSchema = tierSchema;
exports.internalNoteSchema = internalNoteSchema;
exports.storeCreditSchema = storeCreditSchema;
exports.refundSchema = refundSchema;
exports.userStatusSchema = userStatusSchema;
exports.productSchema = productSchema;
exports.ORDER_STATUS_FLOW = ORDER_STATUS_FLOW;
exports.orderStatusSchema = orderStatusSchema;
exports.CARRIERS = CARRIERS;
exports.ADMIN_NAV = ADMIN_NAV;
exports.ADMIN_LEGACY_REDIRECTS = ADMIN_LEGACY_REDIRECTS;
exports.invoicePaymentSchema = invoicePaymentSchema;
exports.invoiceVoidSchema = invoiceVoidSchema;
exports.bulkOrderStatusSchema = bulkOrderStatusSchema;
exports.supplierSchema = supplierSchema;
exports.purchaseOrderSchema = purchaseOrderSchema;
exports.purchaseOrderStatusSchema = purchaseOrderStatusSchema;
exports.purchaseReceiveSchema = purchaseReceiveSchema;
exports.purchasePaymentSchema = purchasePaymentSchema;
exports.expenseSchema = expenseSchema;
exports.expenseCategorySchema = expenseCategorySchema;
exports.stockAdjustSchema = stockAdjustSchema;
exports.productOpsSchema = productOpsSchema;
exports.quoteSchema = quoteSchema;
exports.quoteStatusSchema = quoteStatusSchema;
exports.quoteConvertSchema = quoteConvertSchema;
exports.adminOrderSchema = adminOrderSchema;
exports.adminInvoiceSchema = adminInvoiceSchema;
exports.RMA_ITEM_DISPOSITIONS = RMA_ITEM_DISPOSITIONS;
exports.rmaSchema = rmaSchema;
exports.TICKET_STATUSES = TICKET_STATUSES;
exports.TICKET_PRIORITIES = TICKET_PRIORITIES;
exports.TICKET_SOURCES = TICKET_SOURCES;
exports.TICKET_STATUS_LABELS = TICKET_STATUS_LABELS;
exports.ticketSchema = ticketSchema;
exports.ticketUpdateSchema = ticketUpdateSchema;
exports.ticketStatusSchema = ticketStatusSchema;
exports.rmaStatusSchema = rmaStatusSchema;
exports.rmaInspectSchema = rmaInspectSchema;
exports.rmaResolveSchema = rmaResolveSchema;
exports.PERMISSION_AREAS = PERMISSION_AREAS;
exports.PERMISSION_LEVELS = PERMISSION_LEVELS;
exports.PERMISSION_LEVEL_LABELS = PERMISSION_LEVEL_LABELS;
exports.OUTLET_STATUSES = OUTLET_STATUSES;
exports.OUTLET_COLOR_TOKENS = OUTLET_COLOR_TOKENS;
exports.outletSchema = outletSchema;
exports.roleSchema = roleSchema;
exports.staffUserSchema = staffUserSchema;
exports.staffUserUpdateSchema = staffUserUpdateSchema;
exports.MESSAGE_CHANNELS = MESSAGE_CHANNELS;
exports.TEMPLATE_DOCUMENTS = TEMPLATE_DOCUMENTS;
exports.CAMPAIGN_AUDIENCES = CAMPAIGN_AUDIENCES;
exports.CAMPAIGN_AUDIENCE_LABELS = CAMPAIGN_AUDIENCE_LABELS;
exports.messageSchema = messageSchema;
exports.callLogSchema = callLogSchema;
exports.messageTemplateSchema = messageTemplateSchema;
exports.campaignSchema = campaignSchema;
exports.unsubscribeSchema = unsubscribeSchema;
exports.referralRateSchema = referralRateSchema;
exports.businessInfoSchema = businessInfoSchema;
exports.saleSettingsSchema = saleSettingsSchema;
exports.shippingSettingsSchema = shippingSettingsSchema;
exports.paymentMethodsSettingsSchema = paymentMethodsSettingsSchema;
exports.inventorySettingsSchema = inventorySettingsSchema;
exports.providerCredentialSchema = providerCredentialSchema;
exports.taxonomyNodeSchema = taxonomyNodeSchema;
exports.invoiceStatusRuleSchema = invoiceStatusRuleSchema;
exports.communicationsSettingsSchema = communicationsSettingsSchema;

/**
 * Returns to a supplier (Purchase § RMA / Returns).
 *
 * `purchaseOrder` is optional on purpose: a fault can surface long after the
 * paperwork, and refusing to record the return because nobody can find the PO
 * helps nobody. Costs are never sent — the server snapshots them from the
 * purchase order, or the product, so the expected credit cannot be typed.
 */
const SUPPLIER_RETURN_REASON_VALUES = [
  'faulty',
  'wrong_item',
  'over_shipped',
  'damaged_in_transit',
  'not_as_described',
  'other',
];

const supplierReturnSchema = z.object({
  supplier: z.string().trim().min(1, 'Choose a supplier.'),
  purchaseOrder: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        product: z.string().trim().min(1, 'Choose a product.'),
        qty: z.coerce.number().int().min(1, 'Return at least one.').max(100_000),
        reason: z.enum(SUPPLIER_RETURN_REASON_VALUES).default('faulty'),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .min(1, 'Add at least one line.'),
  reason: z.string().trim().max(500).optional(),
  supplierRmaNumber: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const supplierReturnStatusSchema = z.object({
  status: z.enum(['requested', 'authorised', 'shipped', 'credited', 'rejected']),
  note: z.string().trim().max(300).optional(),
  carrier: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
});

/** The credit a supplier actually gave — recorded, never projected. */
const supplierCreditSchema = z.object({
  amountDollars: z.coerce.number().min(0, 'A credit cannot be negative.').max(1_000_000),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
});

exports.SUPPLIER_RETURN_REASON_VALUES = SUPPLIER_RETURN_REASON_VALUES;
exports.supplierReturnSchema = supplierReturnSchema;
exports.supplierReturnStatusSchema = supplierReturnStatusSchema;
exports.supplierCreditSchema = supplierCreditSchema;

/**
 * Bought-in services and supplier subscriptions (Purchase § Service Products,
 * § Subscription Plans).
 *
 * One schema for both: they differ only in `billing`, and a `one_off` charge is
 * a service while anything that repeats is a subscription. `category` is
 * required for the same reason an expense requires one — a cost the reports
 * cannot group becomes an "uncategorised" line that grows until it is the
 * largest on the page.
 */
const SUPPLIER_BILLING_CYCLES = [
  { value: 'one_off', label: 'One-off' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const supplierServiceSchema = z.object({
  name: z.string().trim().min(2, 'Name it.').max(160),
  code: z.string().trim().max(40).optional(),
  description: z.string().trim().max(2000).optional(),
  supplier: z.string().trim().min(1, 'Choose a supplier.'),
  amount: cents.refine((value) => value > 0, 'Enter an amount.'),
  billing: z.enum(['one_off', 'monthly', 'quarterly', 'yearly']).default('one_off'),
  category: z.string().trim().min(1, 'Pick an expense category.'),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  nextRenewalAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const supplierServiceUpdateSchema = supplierServiceSchema.partial();

/**
 * Recording a charge. Every field is optional because the plan already knows
 * what it costs — an operator confirming a renewal at the agreed price should
 * not have to retype it, and an amount sent here overrides it for that charge
 * only.
 */
const supplierChargeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  description: z.string().trim().max(240).optional(),
  amount: cents.optional(),
  tax: cents.default(0),
  taxIncluded: z.boolean().default(true),
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(80).optional(),
});

exports.SUPPLIER_BILLING_CYCLES = SUPPLIER_BILLING_CYCLES;
exports.supplierServiceSchema = supplierServiceSchema;
exports.supplierServiceUpdateSchema = supplierServiceUpdateSchema;
exports.supplierChargeSchema = supplierChargeSchema;
