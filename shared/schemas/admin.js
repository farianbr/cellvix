import { z } from 'zod';

const cents = z.coerce.number().int().min(0).max(100_000_000);

/**
 * Approving a business is where credit terms get set — it is one decision, not
 * two, so the approval payload carries them.
 */
export const approveUserSchema = z.object({
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

export const rejectUserSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason — it goes in the notification email.').max(400),
});

export const creditSchema = z.object({
  creditLimit: cents,
  terms: z.enum(['prepaid', 'net15', 'net30', 'net60']),
});

/**
 * Admin store-credit allocation. Signed: a negative amount is a correction, and
 * the reason is required for one because "where did $200 go" is a question
 * somebody will ask later.
 */
export const storeCreditSchema = z.object({
  amountDollars: z.coerce
    .number()
    .refine((value) => value !== 0, 'Enter an amount.')
    .refine((value) => Math.abs(value) <= 1_000_000, 'That is more than this form will take.'),
  note: z.string().trim().max(240).optional(),
});

/** Refunds go to store credit — see storeCreditService.refundOrder. */
export const refundSchema = z.object({
  amountDollars: z.coerce.number().positive('Enter an amount to refund.'),
  note: z.string().trim().max(240).optional(),
});

export const userStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
});

export const productSchema = z.object({
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

export const ORDER_STATUS_FLOW = [
  'placed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

export const orderStatusSchema = z.object({
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

export const CARRIERS = [
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
export const ADMIN_NAV = [
  { key: 'home', label: 'Home', to: '/admin', icon: 'Home', area: 'home' },
  {
    key: 'sales',
    label: 'Sales',
    icon: 'ShoppingBag',
    area: 'sales',
    children: [
      {
        key: 'clients',
        label: 'Clients',
        to: '/admin/clients',
        icon: 'Users',
        badge: 'pendingUsers',
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
      { key: 'summary', label: 'Summary', to: '/admin/reports?tab=summary', icon: 'PieChart' },
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
export const ADMIN_LEGACY_REDIRECTS = {
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
export const invoicePaymentSchema = z.object({
  amountDollars: z.coerce.number().positive('Enter an amount to record.'),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.')
    .optional(),
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(80).optional(),
});

/** Voiding forgives the balance and keeps the row, so the reason is required. */
export const invoiceVoidSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason — it stays on the invoice.').max(240),
});

/**
 * Bulk order status advancement.
 *
 * Same rule as the single-order route: only forward transitions, and the server
 * decides which of the selected orders can actually make the move rather than
 * trusting the client's selection.
 */
export const bulkOrderStatusSchema = z.object({
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
export const supplierSchema = z.object({
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

export const purchaseOrderSchema = z.object({
  supplier: z.string().trim().min(1, 'Pick a supplier.'),
  items: z.array(purchaseOrderItemSchema).min(1, 'Add at least one line.').max(200),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  tax: cents.default(0),
  shipping: cents.default(0),
  notes: z.string().trim().max(2000).optional(),
});

/** `draft → sent` and `cancelled` are the only operator-chosen transitions. */
export const purchaseOrderStatusSchema = z.object({
  status: z.enum(['sent', 'cancelled']),
  note: z.string().trim().max(300).optional(),
});

/**
 * Receiving. The client sends quantities received **in this delivery**, never a
 * running total and never a status: the status is derived from whether any line
 * is still short, and stock is incremented server-side with a `StockMovement`
 * written for each line (§6.8, automation contract).
 */
export const purchaseReceiveSchema = z.object({
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
export const purchasePaymentSchema = z.object({
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(80).optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  category: z.string().trim().optional(),
});

export const expenseSchema = z.object({
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

export const expenseCategorySchema = z.object({
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
export const stockAdjustSchema = z.object({
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
export const productOpsSchema = z.object({
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

export const quoteSchema = z.object({
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
export const quoteStatusSchema = z.object({
  status: z.enum(['sent', 'accepted', 'rejected']),
  note: z.string().trim().max(300).optional(),
});

/**
 * Conversion. `acknowledgeDrift` is the admin confirming they have seen the
 * catalogue prices that moved since the quote was issued — without it the
 * server refuses and returns the comparison instead.
 */
export const quoteConvertSchema = z.object({
  acknowledgeDrift: z.boolean().default(false),
  deliveryCode: z.enum(['ground', 'express', 'pickup']).default('ground'),
});

export const RMA_ITEM_DISPOSITIONS = ['pending', 'restock', 'scrap', 'return_to_supplier', 'reject'];

export const rmaSchema = z.object({
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
export const rmaStatusSchema = z.object({
  status: z.enum(['approved', 'in_transit', 'received', 'inspecting', 'rejected']),
  note: z.string().trim().max(300).optional(),
});

export const rmaInspectSchema = z.object({
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
export const rmaResolveSchema = z
  .object({
    resolution: z.enum(['refund', 'replace', 'reject']),
    amountDollars: z.coerce.number().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine(
    (value) => value.resolution !== 'refund' || (value.amountDollars ?? 0) > 0,
    { message: 'Enter an amount to refund.', path: ['amountDollars'] },
  );
