import { z } from 'zod';
// The one password rule, shared rather than restated: an account an admin opens
// must not be allowed a weaker password than one a business opens for itself.
import { passwordSchema } from './auth.js';
import { DEFAULT_COUNTRY } from '../countries.js';
import { PROVINCES } from './checkout.js';
import { isValidPostal, postalExampleFor } from '../regions.js';

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
  // Optional: an account is identified by the person (§0). A private customer
  // or a sole trader may have no registered company name, and the endpoint has
  // to accept the account the form can now open.
  businessName: z.string().trim().max(160).optional(),
  contactName: z.string().trim().min(2, 'Enter a contact name.').max(80),
  // A real address, not the empty-string-tolerant idiom `supplierSchema` uses:
  // this one is the account's sign-in identity, so it cannot be blank.
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a phone number.').max(40),
  /**
   * No `password` field: an admin-opened account gets a generated one and the
   * credentials are emailed to the customer. An admin typing a password meant
   * they then had to pass it on out of band, which in practice was a phone
   * call or a second email nobody could audit.
   */
  businessType: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(40).optional(),
  address: z
    .object({
      line1: z.string().trim().min(2, 'Enter a street address.').max(120),
      line2: z.string().trim().max(120).optional(),
      city: z.string().trim().min(2, 'Enter a city.').max(80),
      // `max(2)` was a Canadian assumption: `NSW` and `QLD` are three letters,
      // and a free-text region can be a word. The country decides what is valid.
      region: z.string().trim().min(2, 'Select a region.').max(60),
      postal: z.string().trim().min(1, 'Enter a postal code.').max(20),
      country: z.string().trim().max(60).default('Canada'),
    })
    .optional()
    .refine((address) => !address?.postal || isValidPostal(address.postal, address.country), {
      message: 'Enter a valid postal code.',
      path: ['postal'],
    }),
  status: z.enum(['pending', 'approved']).default('approved'),
  creditLimit: cents.default(0),
  terms: z.enum(['prepaid', 'net15', 'net30', 'net60']).default('prepaid'),
  /**
   * What the customer has told the admin they agree to be contacted on (CASL).
   *
   * Absent is not the same as all-false. An admin who ticked nothing has
   * recorded no answer, so `createUser` writes no consent record at all rather
   * than stamping four declines the customer never gave.
   */
  contactConsent: z
    .object({
      sms: z.boolean().default(false),
      whatsapp: z.boolean().default(false),
      email: z.boolean().default(false),
      call: z.boolean().default(false),
    })
    .optional(),
});

/**
 * What the admin's new-customer FORM validates, as opposed to what the endpoint
 * accepts.
 *
 * The difference is the address. On the wire an address is either absent or
 * complete, which is the right rule for stored data. In a form it is a set of
 * inputs that all start empty and get filled in some order, so validating them
 * as a required group would mark a blank optional section invalid the moment
 * anything else failed. Here the address block is checked only once somebody
 * has started it, and `ClientForm` drops it entirely when the street is blank.
 *
 * The address fields are also flat-optional rather than a nested `.optional()`
 * object, because React Hook Form always sends the sub-object — with empty
 * strings in it — and an `.optional()` wrapper never sees `undefined`.
 */
/**
 * The object half of `clientFormSchema`, exported so a form can reshape it.
 *
 * `clientFormSchema` itself is a `ZodEffects` once `.superRefine` is attached,
 * and a `ZodEffects` has no `.omit()` / `.extend()`. The new-customer form asks
 * for the contact's name as two fields and composes one `contactName` on
 * submit — the same trick the storefront sign-up plays — so it needs the plain
 * object to build from. Derived, never restated: a field added below is
 * validated on both forms.
 */
const clientFormBase = z
  .object({
    // Optional, and no longer the first thing asked for. An account is
    // identified by the person (§0): a sole trader or a walk-in customer may
    // have no registered company name at all, and requiring one turned an
    // optional detail into a barrier on the one form an admin fills in while
    // somebody is on the phone.
    businessName: z.string().trim().max(160).optional(),
    contactName: z.string().trim().min(2, 'Enter a contact name.').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    phone: z.string().trim().min(7, 'Enter a phone number.').max(40),
    businessType: z.string().trim().max(80).optional(),
    taxId: z.string().trim().max(40).optional(),
    status: z.enum(['pending', 'approved']),
    terms: z.enum(['prepaid', 'net15', 'net30', 'net60']),
    creditLimitDollars: z.string(),
    address: z.object({
      line1: z.string().trim().max(120),
      line2: z.string().trim().max(120),
      city: z.string().trim().max(80),
      region: z.string().trim().max(2),
      postal: z.string().trim(),
      // Defaulted rather than required: almost every account is Canadian, and
      // the field exists so the handful that are not can say so.
      country: z.string().trim().max(60).default('Canada'),
    }),
    contactConsent: z.object({
      sms: z.boolean(),
      whatsapp: z.boolean(),
      email: z.boolean(),
      call: z.boolean(),
    }),
  });

/**
 * The address block's "started it, so finish it" rule, as a function.
 *
 * Named rather than inline so `clientFormSchema` and the new-customer form's
 * reshaped variant apply the identical check — an inline copy in each is how
 * two forms end up disagreeing about what a valid address is.
 */
const refineClientAddress = (values, ctx) => {
  const { line1, city, postal } = values.address;
  // Untouched block: nothing to check, and the form will not send it.
  if (!line1 && !city && !postal) return;

  if (line1.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address', 'line1'],
      message: 'Enter a street address.',
    });
  }
  if (city.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address', 'city'],
      message: 'Enter a city.',
    });
  }
  // The rule is the country's, not Canada's. This used to check `A1A 1A1` for
  // Canada and merely "at least three characters" for everywhere else, which
  // accepted `abc` as a US ZIP. `regions.js` knows the real pattern for the
  // countries Cellvix trades with, and honestly accepts anything for the ones
  // where there is no fixed format.
  const country = values.address.country || 'Canada';
  if (!postal || postal.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address', 'postal'],
      message: 'Enter a postal or ZIP code.',
    });
  } else if (!isValidPostal(postal, country)) {
    const example = postalExampleFor(country);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address', 'postal'],
      message: example ? `Enter a valid postal code (${example}).` : 'Enter a valid postal code.',
    });
  }
};

const clientFormSchema = clientFormBase.superRefine(refineClientAddress);

/**
 * What the new-customer **form** holds, which is not quite what the API takes.
 *
 * The contact's name is asked as two fields and stored as one, exactly as the
 * storefront sign-up does it: `contactName` is what the model, the welcome mail
 * and every admin screen read, so the halves are composed on submit rather than
 * split in the model. The resolver runs over this shape; `onSubmit` builds the
 * payload `clientFormSchema` describes.
 */
const clientCreateFormSchema = clientFormBase
  .omit({ contactName: true })
  .extend({
    firstName: z.string().trim().min(1, 'Enter a first name.'),
    lastName: z.string().trim().min(1, 'Enter a last name.'),
  })
  .superRefine(refineClientAddress);

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
  // Accepts an empty string, like the other optional descriptors: an admin who
  // recorded a company name against what turned out to be a private customer
  // has to be able to clear it again.
  businessName: z.string().trim().max(160).optional(),
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
      postal: z.string().trim().min(3, 'Enter a postal or ZIP code.'),
      country: z.string().trim().max(60).default('Canada'),
    })
    // The Canadian pattern is checked only on a Canadian address — see the note
    // on `clientFormSchema`. A UK or US address is valid and has its own shape.
    .superRefine((address, ctx) => {
      if ((address.country || 'Canada') !== 'Canada') return;
      if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(address.postal)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['postal'],
          message: 'Enter a valid postal code.',
        });
      }
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

/**
 * An order still owing somebody work: placed, and not yet delivered or
 * cancelled.
 *
 * **This exists so a count and its own link cannot disagree.** The dashboard's
 * "Open orders" tile counted these four statuses and then linked to
 * `?status=placed`, so a tile reading 2 opened a list showing one row — or an
 * empty one, when both open orders happened to be `shipped`. The operator is
 * told a number and then shown something that contradicts it, which makes the
 * whole row untrustworthy.
 *
 * Exported as one list and read by both sides: the counter in
 * `adminService.stats`, the `?status=open` filter in `listOrders`, and the
 * pill on the orders screen.
 */
const ORDER_OPEN_STATUSES = ['placed', 'processing', 'shipped', 'out_for_delivery'];

/**
 * An order that has not gone out yet — the picking queue.
 *
 * Narrower than `ORDER_OPEN_STATUSES`: a shipped order is still open, but
 * nobody has to pack it. Same reason as above for existing as a shared list —
 * the "Fulfil orders" card counts these two and has to link to the same two.
 */
const ORDER_UNFULFILLED_STATUSES = ['placed', 'processing'];

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
 * `badgeLabel` is what that number COUNTS, as a noun the operator would say
 * out loud — "waiting for approval", "out of stock or running low". It is not
 * decoration: a bare number in a sidebar is unreadable twice over. A sighted
 * operator cannot tell whether "6" is unread, overdue or merely total, and a
 * screen reader announces "Tickets 6" with no clue what six means. The label
 * supplies the noun for both, as a `title`, an `aria-label` and a line in the
 * page header it lands on.
 *
 * `badgePhrase` is the same fact written as a standalone clause, for the
 * collapsed group's roll-up where several are joined with commas. Stitching
 * the label onto the row name produced "1 invoices overdue" and "4 rma /
 * returns still to resolve"; a written phrase costs one line each and reads
 * like English.
 *
 * It is written `[singular, plural]` because these counts pass through one
 * routinely — one overdue invoice is the good day, and "1 overdue invoices" in
 * the tooltip is exactly the kind of detail that makes an interface feel
 * unfinished.
 *
 * `badgeFilter` is the view that shows exactly the badged rows. The rule it
 * enforces: **a count must be reachable**. Inventory badged 189 and opened a
 * list of 420 with no 189 anywhere on it, which teaches an operator that the
 * numbers are decorative. The row still navigates to the unfiltered page —
 * that is what a nav row is for — and the page states the count and offers the
 * filter on arrival, so the number is explained where it is doubted rather
 * than only in a tooltip nobody hovers.
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
        badgeLabel: 'waiting for approval',
        badgePhrase: ['customer waiting for approval', 'customers waiting for approval'],
        badgeFilter: 'status=pending',
      },
      {
        key: 'tickets',
        label: 'Tickets',
        to: '/admin/tickets',
        icon: 'ClipboardList',
        badge: 'openTickets',
        badgeLabel: 'open',
        badgePhrase: ['open ticket', 'open tickets'],
        badgeFilter: 'status=open',
      },
      {
        key: 'rma',
        // "Returns", not "RMA / Returns": the operator says returns, and the
        // acronym was only ever there to disambiguate from the supplier-side
        // row, which is now switched off.
        label: 'Returns',
        to: '/admin/rma',
        icon: 'RotateCcw',
        badge: 'openRmas',
        badgeLabel: 'still to resolve',
        badgePhrase: ['return to resolve', 'returns to resolve'],
        badgeFilter: 'status=open',
      },
      { key: 'orders', label: 'Orders', to: '/admin/orders', icon: 'Package' },
      {
        key: 'invoices',
        label: 'Invoices',
        to: '/admin/invoices',
        icon: 'FileText',
        badge: 'overdueInvoices',
        badgeLabel: 'overdue',
        badgePhrase: ['overdue invoice', 'overdue invoices'],
        badgeFilter: 'status=overdue',
      },
      { key: 'quotes', label: 'Quotes', to: '/admin/quotes', icon: 'FileSignature' },
      // Enquiries from the storefront's contact form, before anybody has priced
      // them. Under Quotes because that is what they usually become.
      { key: 'web-quotes', label: 'Web Quote', to: '/admin/web-quotes', icon: 'Globe' },
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
        // Requests for Quote used to sit above this row. It is gone: a purchase
        // order now carries its own bidding, so asking several suppliers and
        // recording what was bought are one record and one screen rather than
        // two that had to be read together (re-ruled 2026-09-11).
        key: 'pos',
        label: 'Purchase Orders',
        to: '/admin/purchase-orders',
        icon: 'ClipboardList',
      },
      {
        // The purchase-side counterpart of Sales § RMA: stock going back OUT to
        // a supplier, and a credit claimed rather than given.
        //
        // **Switched off for Cellvix, not deleted** (SAAS_PLATFORM §5.5). The
        // business does not return stock to suppliers, and the row was also the
        // second "RMA / Returns" in the sidebar — the same words under Sales
        // and under Purchase meaning opposite directions of travel, which is a
        // question the nav should never have been asking.
        //
        // The screen, its routes, its model and its schema all stay. Removing
        // `hidden` is the whole of switching it back on.
        key: 'supplier-returns',
        label: 'RMA / Returns',
        to: '/admin/supplier-returns',
        icon: 'RotateCcw',
        hidden: true,
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
      {
        key: 'inventory',
        label: 'Inventory',
        to: '/admin/inventory',
        icon: 'Boxes',
        badge: 'lowStock',
        // Two conditions in one number, so the label says both rather than
        // leaving "189" to be read as one of them.
        badgeLabel: 'out of stock or running low',
        badgePhrase: [
          'product out of stock or running low',
          'products out of stock or running low',
        ],
        badgeFilter: 'stock=attention',
      },
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
    ],
  },
  {
    /**
     * Content published to the storefront for search engines and shoppers to
     * find, as opposed to Marketing, which is outbound: campaigns, calls and
     * offers pushed AT a known audience.
     *
     * Blog and FAQ were under Marketing because they are things you publish,
     * but publishing is where the similarity ends — nobody writes a help
     * article as part of a campaign, and an operator looking for one had to
     * think of it as marketing first. They keep their `/admin/marketing/*`
     * URLs: those are bookmarked and linked from the storefront, and moving a
     * row in the nav is not a reason to break a link.
     */
    key: 'seo',
    label: 'SEO',
    icon: 'Globe',
    // Under `marketing` rather than a new permission area: a role that can
    // publish a campaign can publish a help article, and a seventh area is a
    // column nobody maintains correctly in the roles matrix (§7.6).
    area: 'marketing',
    children: [
      { key: 'blog', label: 'Blog', to: '/admin/marketing/blog', icon: 'Newspaper' },
      { key: 'faq', label: 'FAQ', to: '/admin/marketing/faq', icon: 'HelpCircle' },
    ],
  },
  {
    key: 'business',
    label: 'Businesses',
    icon: 'Store',
    area: 'business',
    children: [
      { key: 'business-list', label: 'All Businesses', to: '/admin/businesses', icon: 'List' },
      { key: 'business-add', label: 'Add Business', to: '/admin/businesses/add', icon: 'PlusCircle' },
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
  // Requests for quote folded into the purchase order on 2026-09-11. A
  // bookmarked or emailed `/admin/rfqs` link lands on the screen that now does
  // that job rather than on a 404 that says only that something used to exist.
  '/admin/rfqs': '/admin/purchase-orders',
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
/**
 * Correcting an invoice. Clerical fields only.
 *
 * The amount is absent on purpose: it is derived from what was billed, and a
 * total somebody can retype is a total that agrees with nothing. Changing what
 * was billed is a void plus a new invoice, which leaves both in the record.
 */
const invoiceUpdateSchema = z.object({
  dueDate: z.string().trim().regex(/^d{4}-d{2}-d{2}$/, 'Pick a due date.').optional(),
  poNumber: z.string().trim().max(60).or(z.literal('')).optional(),
  note: z.string().trim().max(500).or(z.literal('')).optional(),
});

/** Cash paid against the line of credit. Spread across unpaid invoices server-side. */
const creditPaymentSchema = z.object({
  amountDollars: z.coerce.number().positive('Enter an amount to record.'),
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(80).optional(),
});

/** Moving a web enquiry through the queue. Three states, nothing else. */
const webQuoteStatusSchema = z.object({
  status: z.enum(['new', 'read', 'closed']),
});

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
      // A country **name**, matching customers and businesses — not the 2-letter
      // code this field briefly held. One convention across the app is what
      // lets `COUNTRY_OPTIONS` serve every address form (see shared/countries).
      country: z.string().trim().max(60).default(DEFAULT_COUNTRY),
    })
    .optional(),
  paymentTerms: z.enum(['prepaid', 'net15', 'net30', 'net60']).default('net30'),
  notes: z.string().trim().max(2000).optional(),
  isActive: z.boolean().default(true),
  /**
   * The component types this supplier is tagged with — `Product.partType`
   * slugs, which is what a request for quote picks suppliers by.
   *
   * Not an enum: the list of component types is derived from the catalogue
   * (`taxonomyService.getComponentTypes`), so hard-coding one here would be a
   * second source of truth that goes stale the first time a new part type is
   * stocked. The picker offers the live list; this just validates the shape.
   */
  componentTypes: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
  // Optional, unlike the customer-side `contactConsentSchema`, which is a
  // dedicated endpoint recording an answer. This rides along on a create or an
  // edit that may not have touched the ticks at all, and omitting it has to
  // mean "unchanged" rather than "all four declined".
  contactConsent: contactConsentSchema.optional(),
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
  // Optional since the bidding rework: a line is raised to ask what it costs,
  // and the price arrives from the confirmed supplier's bid. A cost typed at
  // this stage is a starting expectation, not the figure the order is placed at.
  unitCost: cents.default(0),
});

/**
 * Raising a purchase order.
 *
 * **`supplier` is gone and `suppliers` replaces it** (re-ruled 2026-09-11). An
 * order is now put to several suppliers and confirmed to one, so at the moment
 * it is raised there is nobody it is with yet — naming a single required
 * supplier would mean picking the winner before anybody had quoted.
 *
 * `unitCost` is likewise no longer collected here: the whole point of sending
 * the order out is to find out what it costs. `confirmSupplier` copies the
 * winning bid's prices on to the lines.
 */
const purchaseOrderSchema = z.object({
  title: z.string().trim().max(200).optional(),
  componentTypes: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
  items: z.array(purchaseOrderItemSchema).min(1, 'Add at least one line.').max(200),
  suppliers: z.array(z.string().trim().min(1)).max(50).default([]),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional(),
  // A full timestamp, not a calendar day: "answers close Friday at 5" is a real
  // deadline, where a bare date leaves whether Friday itself counts unanswered.
  closesAt: z.string().trim().max(40).optional().or(z.literal('')),
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

// ---- requests for quote (supplier process flow, §6.8a) ----------------------

/**
 * A request for quote: one line list, several suppliers, no prices.
 *
 * `componentTypes` is what the suppliers were **chosen by**, and it is sent
 * alongside the lines rather than derived from them — a clerk who picks
 * "battery", invites the battery suppliers and then adds a screen to the list
 * has still asked the battery suppliers, and recomputing would rewrite that.
 */
/** Adding suppliers to an order that is already being priced. */
const purchaseInviteSchema = z.object({
  supplierIds: z.array(z.string().trim().min(1)).min(1, 'Pick a supplier.').max(50),
});

const purchaseSendSchema = z.object({
  note: z.string().trim().max(300).optional(),
});

/**
 * Pushing back on a supplier's price.
 *
 * Either a target for the whole order or a per-line ask — both are optional,
 * because "can you do better?" with a note and no number is a real opening
 * move. What is never accepted is a total: `askedTotal` is what we are *asking
 * for*, and the supplier's answer arrives as a fresh bid that is recomputed
 * from its own lines.
 */
const purchaseNegotiateSchema = z.object({
  askedTotal: cents.optional(),
  askedLines: z
    .array(z.object({ sku: z.string().trim().min(1), unitCost: cents.default(0) }))
    .max(200)
    .default([]),
  note: z.string().trim().max(2000).optional(),
});

/**
 * Confirming the supplier this order is placed with.
 *
 * The client names the **supplier**, never a price: the costs the order carries
 * are the ones that supplier already submitted, read from their stored bid. A
 * price in this payload would be a way to confirm one number and order at
 * another.
 */
const purchaseConfirmSchema = z.object({
  supplierId: z.string().trim().min(1, 'Pick the supplier to confirm.'),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional().or(z.literal('')),
  note: z.string().trim().max(300).optional(),
});

/**
 * A supplier's price, submitted from the portal.
 *
 * **The one payload in this app where a price is accepted and kept**, because
 * collecting prices from outside is the entire purpose of sending the order
 * out. Lines are matched against the order's own SKUs server-side, so a
 * supplier cannot add a line nobody asked for, and every total is still
 * recomputed against **our** quantities (§8).
 *
 * `available: false` is how a supplier says "not this one" — distinct from a
 * price of zero, which is a legitimate answer for a sample.
 */
const supplierQuoteSchema = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        unitCost: cents.default(0),
        available: z.boolean().default(true),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .min(1, 'Price at least one line.')
    .max(200),
  tax: cents.default(0),
  shipping: cents.default(0),
  leadTimeDays: z.coerce.number().int().min(0).max(365).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional().or(z.literal('')),
  note: z.string().trim().max(2000).optional(),
});

const supplierDeclineSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * A proforma invoice, raised by the supplier against an order they have priced.
 *
 * **No totals are accepted.** The supplier states their reference, their terms
 * and their bank details; every figure on the document is computed from the bid
 * lines already stored. A PI whose total disagreed with the prices it was
 * raised from would be a document nobody could reconcile.
 */
const supplierProformaSchema = z.object({
  number: z.string().trim().max(60).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional().or(z.literal('')),
  tax: cents.optional(),
  shipping: cents.optional(),
  paymentTerms: z.string().trim().max(300).optional(),
  bankDetails: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(2000).optional(),
});

/** What the confirmed supplier reports about getting the goods to us. */
const supplierDeliverySchema = z.object({
  status: z.enum(['pending', 'preparing', 'dispatched', 'in_transit', 'delivered']),
  carrier: z.string().trim().max(120).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  expectedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').optional().or(z.literal('')),
  note: z.string().trim().max(1000).optional(),
});

// ---- the supplier portal's own session --------------------------------------

const supplierLoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.'),
});

const supplierForgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
});

/** Mirrors the buyer-side password rule, so both sides hold one standard. */
const supplierPortalPassword = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128)
  .regex(/[A-Za-z]/, 'Include a letter.')
  .regex(/[0-9]/, 'Include a number.');

const supplierResetSchema = z.object({
  token: z.string().trim().min(10),
  password: supplierPortalPassword,
});

const supplierPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  password: supplierPortalPassword,
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
  user: z.string().trim().min(1, 'Pick a customer.'),
  items: z.array(quoteItemSchema).min(1, 'Add at least one line.').max(200),
  shipping: cents.default(0),
  deliveryCode: z.enum(['ground', 'express', 'pickup']).default('ground'),
  /**
   * Which shop fulfils this order.
   *
   * Optional, and the server falls back to the business the operator is working
   * in. It is asked explicitly because the answer is not always that one: a
   * customer collecting in person picks the shop nearest them, and a delivery
   * goes out from whichever shop holds the stock.
   */
  business: z.string().trim().length(24).optional().or(z.literal('')),
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
/**
 * Canadian sales tax, by province, as a single combined rate.
 *
 * One number per province rather than a GST/PST/HST breakdown: the invoice
 * shows one tax line, which is what an HST province genuinely has, and the
 * participating provinces are the ones where the distinction matters least. A
 * business that has to file GST and PST separately needs a bookkeeping package,
 * not a second row on this form.
 *
 * The rate is a DEFAULT. The form lets an operator override it, because zero is
 * a real answer — an exempt customer, an out-of-country sale — and a rate the
 * software insists on is a rate somebody works around by editing the total.
 */
/** The province codes, taken from the one list the checkout already uses. */
const PROVINCE_CODES = PROVINCES.map((province) => province.value);

const TAX_RATES = {
  AB: 5, BC: 12, MB: 12, NB: 15, NL: 15, NS: 14, NT: 5,
  NU: 5, ON: 13, PE: 15, QC: 14.975, SK: 11, YT: 5,
};

/**
 * One priced line — a service performed, or a part fitted.
 *
 * Services and parts are the same shape because they are the same thing on an
 * invoice: a description, a quantity and a price. `product` links a part back
 * to the catalogue row it came from, which is what lets stock move when the
 * invoice is raised; a service has no product and never will.
 */
/** How the job reached the bench. Mirrors the ticket's own sources. */
const INVOICE_SERVICE_TYPES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'onsite', label: 'On-site' },
  { value: 'mail_in', label: 'Mail-in' },
];

const invoiceLineSchema = z.object({
  name: z.string().trim().min(1, 'Name the line.').max(160),
  description: z.string().trim().max(300).or(z.literal('')).optional(),
  priceDollars: z.coerce.number().min(0).max(1_000_000).default(0),
  qty: z.coerce.number().int().min(1).max(999).default(1),
  /** The catalogue product, for a part. Absent on a service. */
  product: z.string().trim().length(24).optional(),
});

/**
 * A device on an invoice, with the work done to it.
 *
 * Deliberately the same shape as `ticketDeviceSchema` minus the intake-only
 * fields (condition grid, passcode): a repair invoice describes the same object
 * a ticket does, and two different shapes for one thing is how a ticket stops
 * being convertible into an invoice.
 */
const invoiceDeviceSchema = z.object({
  category: z.string().trim().max(60).or(z.literal('')).optional(),
  brand: z.string().trim().max(60).or(z.literal('')).optional(),
  series: z.string().trim().max(120).or(z.literal('')).optional(),
  model: z.string().trim().max(120).or(z.literal('')).optional(),
  serial: z.string().trim().max(80).or(z.literal('')).optional(),

  problem: z.string().trim().max(500).or(z.literal('')).optional(),
  solution: z.string().trim().max(500).or(z.literal('')).optional(),
  notes: z.string().trim().max(500).or(z.literal('')).optional(),

  services: z.array(invoiceLineSchema).max(40).default([]),
  parts: z.array(invoiceLineSchema).max(40).default([]),
});

/**
 * Raising an invoice by hand (§7.2).
 *
 * Two shapes, one schema. A **flat charge** sends `amount` and nothing else —
 * a restocking fee, an agreed adjustment, the case this form was built for. An
 * **itemised invoice** sends `devices`, and the server computes the amount
 * from the lines; whatever `amount` the client sent is ignored, because a
 * total the browser calculated is a total the browser can be wrong about.
 *
 * The flat path stays because most standalone invoices are one number and
 * making an operator open a device panel to type it would be a worse form.
 */
const adminInvoiceSchema = z.object({
  user: z.string().trim().min(1, 'Pick a customer.'),
  // Required for a flat charge, ignored when `devices` carries lines — the
  // superRefine below enforces exactly that.
  amount: cents.optional(),

  devices: z.array(invoiceDeviceSchema).max(20).default([]),

  /** Province drives the default rate; the rate itself is what gets applied. */
  province: z.enum(PROVINCE_CODES).or(z.literal('')).optional(),
  taxPercent: z.coerce.number().min(0).max(100).default(0),

  discountDollars: z.coerce.number().min(0).max(1_000_000).default(0),
  discountCode: z.string().trim().max(40).or(z.literal('')).optional(),

  /** Internal only — recorded, never added to what the customer owes. */
  travelKm: z.coerce.number().min(0).max(100_000).default(0),
  /**
   * The one travel figure that IS charged, when the job is out of area.
   *
   * The amount travels with the flag rather than coming from a setting: there
   * is no service-area rate configured anywhere yet, and inventing a silent
   * default would put a number on a customer's invoice that nobody chose.
   */
  extendedServiceFee: z.boolean().default(false),
  extendedServiceFeeDollars: z.coerce.number().min(0).max(100_000).default(0),

  technician: z.string().trim().max(24).or(z.literal('')).optional(),
  serviceType: z.enum(['walk_in', 'pickup', 'onsite', 'mail_in']).default('walk_in'),

  /** Rendered on the document. `internalNotes` never is. */
  customerNotes: z.string().trim().max(2000).or(z.literal('')).optional(),
  technicianNotes: z.string().trim().max(2000).or(z.literal('')).optional(),
  internalNotes: z.string().trim().max(2000).or(z.literal('')).optional(),
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
})
  .superRefine((value, ctx) => {
    const hasLines = (value.devices ?? []).some(
      (device) => (device.services?.length ?? 0) + (device.parts?.length ?? 0) > 0,
    );

    // An itemised invoice computes its own total, so an amount is not asked
    // for. A flat one has nothing else to bill from, so it is required — and
    // an invoice for nothing is not a document.
    if (!hasLines && !(value.amount > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Enter an amount, or add a service or part.',
      });
    }
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

/** Money taken before the invoice exists. Dollars in; the server stores cents. */
const ticketDepositSchema = z.object({
  amountDollars: z.coerce.number().positive('Enter a deposit amount.').max(1_000_000),
  method: z.enum(['cash', 'card', 'debit', 'transfer', 'cheque', 'other']).default('cash'),
  note: z.string().trim().max(300).or(z.literal('')).optional(),
});

/**
 * Turning a finished repair into its invoice.
 *
 * Only the terms are asked: everything billed comes off the ticket, which is
 * where the job was priced. A form that let an operator restate the lines here
 * would be a second place for them to differ.
 */
const ticketConvertSchema = z.object({
  terms: z.enum(['prepaid', 'net15', 'net30', 'net60']).default('prepaid'),
});
const TICKET_SOURCES = ['counter', 'kiosk', 'web', 'phone'];

/**
 * Converting an estimate into the repair ticket that does the work.
 *
 * Only how the job arrived and how urgent it is: the lines come off the quote,
 * because that is what the customer agreed to. Declared here rather than beside
 * `quoteConvertSchema` because it reads the two ticket constants above it.
 */
const quoteToTicketSchema = z.object({
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
  source: z.enum(TICKET_SOURCES).default('counter'),
});

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
/** One priced line — a service performed or a part fitted. Same shape for both. */
const ticketLineSchema = z.object({
  name: z.string().trim().min(1, 'Name the line.').max(160),
  description: z.string().trim().max(300).or(z.literal('')).optional(),
  priceDollars: z.coerce.number().min(0).max(1_000_000).default(0),
  qty: z.coerce.number().int().min(1).max(999).default(1),
  product: z.string().trim().length(24).optional(),
});

/**
 * How a component tested at drop-off, and which components a counter checks.
 *
 * Declared here rather than only on the model so the intake form renders the
 * same grid the server will accept — a form offering a ninth component the
 * schema rejects is a form that fails on submit.
 */
const CONDITION_GRADES = [
  { value: 'working', label: 'Working' },
  { value: 'faulty', label: 'Faulty' },
  { value: 'not_present', label: 'Not present' },
  { value: 'untested', label: 'Untested' },
];

const CONDITION_PARTS = [
  { key: 'screen', label: 'Screen' },
  { key: 'battery', label: 'Battery' },
  { key: 'chargingPort', label: 'Charging Port' },
  { key: 'backGlass', label: 'BackGlass' },
  { key: 'frontCamera', label: 'Front Camera' },
  { key: 'backCamera', label: 'Back Camera' },
  { key: 'loudSpeaker', label: 'Loud Speaker' },
  { key: 'earSpeaker', label: 'Ear Speaker' },
];

const conditionGradeSchema = z.enum(CONDITION_GRADES.map((grade) => grade.value));

/**
 * One device on the intake form.
 *
 * Only the model is required. A counter taking in a cracked handset at speed
 * knows what it is; making them fill a serial and a condition grid before the
 * ticket can be saved is how intake stops being done at the counter at all.
 */
const ticketDeviceSchema = z.object({
  category: z.string().trim().max(60).or(z.literal('')).optional(),
  brand: z.string().trim().max(60).or(z.literal('')).optional(),
  series: z.string().trim().max(120).or(z.literal('')).optional(),
  model: z.string().trim().min(1, 'Pick a model.').max(120),
  serial: z.string().trim().max(80).or(z.literal('')).optional(),
  passcode: z.string().trim().max(60).or(z.literal('')).optional(),

  problem: z.string().trim().max(500).or(z.literal('')).optional(),
  solution: z.string().trim().max(500).or(z.literal('')).optional(),
  notes: z.string().trim().max(500).or(z.literal('')).optional(),

  condition: z.record(z.string(), conditionGradeSchema).optional(),

  services: z.array(ticketLineSchema).max(40).default([]),
  parts: z.array(ticketLineSchema).max(40).default([]),
});

const ticketSchema = z.object({
  customerName: z.string().trim().min(2, 'Enter the customer name.').max(120),
  customerPhone: z.string().trim().min(7, 'Enter a contact number.').max(40),
  customerEmail: z.string().trim().email('Enter a valid email.').or(z.literal('')).optional(),

  /**
   * The account this ticket belongs to, when it has one.
   *
   * Optional because the customer above is free text: a repair walks in off
   * the street and the counter must be able to open a ticket without creating
   * an account first. Set when the ticket is raised from a customer profile,
   * which is what lets that profile count its own open jobs.
   */
  user: z.string().trim().length(24).optional(),

  deviceBrand: z.string().trim().max(60).optional(),
  deviceModel: z.string().trim().max(120).optional(),
  deviceSerial: z.string().trim().max(80).optional(),
  /**
   * The reported fault, as one line for the list and the search index.
   *
   * Optional on the wire, because the intake form records the fault **per
   * device** now — a two-device ticket has two problems and no single sentence
   * that is honestly "the" issue. `createTicket` falls back to the first
   * device's `problem`, so the column is still filled; requiring it here would
   * reject the very form that supersedes it.
   */
  issue: z.string().trim().max(500).optional(),

  status: z.enum(TICKET_STATUSES).default('diagnosis'),
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
  source: z.enum(TICKET_SOURCES).default('counter'),

  // Empty string means "unassigned" — a select cannot emit `undefined`.
  technician: z.string().trim().or(z.literal('')).optional(),

  estimateDollars: z.coerce.number().min(0).max(1_000_000).optional(),
  notes: z.string().trim().max(2000).optional(),

  // The richer intake shape. All optional, so the short form that existed
  // before this — name, phone, one device, one estimate — still validates.
  devices: z.array(ticketDeviceSchema).max(10).optional(),
  clientNotes: z.string().trim().max(2000).or(z.literal('')).optional(),
  technicianNotes: z.string().trim().max(2000).or(z.literal('')).optional(),
  discountDollars: z.coerce.number().min(0).max(1_000_000).optional(),
  discountCode: z.string().trim().max(40).or(z.literal('')).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  province: z.string().trim().max(2).or(z.literal('')).optional(),
  dueDate: z.string().trim().regex(/^d{4}-d{2}-d{2}$/).or(z.literal('')).optional(),
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

// ---- phase 8: businesses, roles and staff --------------------------------------

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
  'business',
  'settings',
];

const PERMISSION_LEVELS = ['none', 'view', 'full'];

/** Human labels for the Roles & Access selects. */
const PERMISSION_LEVEL_LABELS = {
  none: 'No access',
  view: 'Read only',
  full: 'Full',
};

const BUSINESS_STATUSES = ['active', 'inactive', 'maintenance'];
const BUSINESS_COLOR_TOKENS = ['brand', 'info', 'success', 'warn', 'danger', 'ink'];

const POSTAL_CA = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const businessHoursSchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  open: z.string().trim().max(5).optional(),
  close: z.string().trim().max(5).optional(),
  closed: z.boolean().default(false),
});

/**
 * `code` is absent on purpose — it is assigned server-side (§6.14). A code the
 * form proposes is a code two operators can pick in the same moment.
 */
const businessSchema = z.object({
  name: z.string().trim().min(1, 'Enter an business name.').max(120),
  status: z.enum(BUSINESS_STATUSES).default('active'),
  colorToken: z.enum(BUSINESS_COLOR_TOKENS).default('brand'),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      line2: z.string().trim().max(200).optional(),
      city: z.string().trim().max(120).optional(),
      region: z.string().trim().max(60).optional(),
      // Empty is allowed — an business can be filed before its lease is signed —
      // but a value that is present must be a real postal code FOR ITS OWN
      // COUNTRY. Checked in the refinement below, because the rule cannot be
      // known until `country` has been read.
      postal: z.string().trim().max(20).optional().or(z.literal('')),
      country: z.string().trim().max(60).default('Canada'),
    })
    .default({}),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  manager: z.string().trim().max(120).optional(),
  hours: z.array(businessHoursSchema).max(7).optional(),
  notes: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  const postal = value.address?.postal;
  if (!postal || isValidPostal(postal, value.address?.country)) return;

  const example = postalExampleFor(value.address?.country);
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['address', 'postal'],
    message: example ? `Enter a valid postal code (${example}).` : 'Enter a valid postal code.',
  });
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
    business: z.string().trim().optional(),
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
  business: z.string().trim().nullable().optional(),
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

export { quoteToTicketSchema, ticketDepositSchema, ticketConvertSchema, TAX_RATES, INVOICE_SERVICE_TYPES, ORDER_OPEN_STATUSES, ORDER_UNFULFILLED_STATUSES, approveUserSchema, rejectUserSchema, creditSchema, clientSchema, clientFormSchema, clientCreateFormSchema, clientUpdateSchema, CONSENT_CHANNELS, contactConsentSchema, MEMBERSHIP_TIERS, tierSchema, internalNoteSchema, storeCreditSchema, refundSchema, userStatusSchema, productSchema, ORDER_STATUS_FLOW, orderStatusSchema, CARRIERS, ADMIN_NAV, ADMIN_LEGACY_REDIRECTS, invoicePaymentSchema, invoiceVoidSchema, webQuoteStatusSchema, creditPaymentSchema, invoiceUpdateSchema, bulkOrderStatusSchema, supplierSchema, purchaseOrderSchema, purchaseOrderStatusSchema, purchaseReceiveSchema, purchasePaymentSchema, purchaseInviteSchema, purchaseSendSchema, purchaseNegotiateSchema, purchaseConfirmSchema, supplierQuoteSchema, supplierDeclineSchema, supplierProformaSchema, supplierDeliverySchema, supplierLoginSchema, supplierForgotSchema, supplierResetSchema, supplierPasswordSchema, expenseSchema, expenseCategorySchema, stockAdjustSchema, productOpsSchema, quoteSchema, quoteStatusSchema, quoteConvertSchema, adminOrderSchema, adminInvoiceSchema, RMA_ITEM_DISPOSITIONS, rmaSchema, TICKET_STATUSES, TICKET_PRIORITIES, TICKET_SOURCES, TICKET_STATUS_LABELS, CONDITION_GRADES, CONDITION_PARTS, ticketSchema, ticketDeviceSchema, ticketLineSchema, ticketUpdateSchema, ticketStatusSchema, rmaStatusSchema, rmaInspectSchema, rmaResolveSchema, PERMISSION_AREAS, PERMISSION_LEVELS, PERMISSION_LEVEL_LABELS, BUSINESS_STATUSES, BUSINESS_COLOR_TOKENS, businessSchema, roleSchema, staffUserSchema, staffUserUpdateSchema, MESSAGE_CHANNELS, TEMPLATE_DOCUMENTS, CAMPAIGN_AUDIENCES, CAMPAIGN_AUDIENCE_LABELS, messageSchema, callLogSchema, messageTemplateSchema, campaignSchema, unsubscribeSchema, referralRateSchema, businessInfoSchema, saleSettingsSchema, shippingSettingsSchema, paymentMethodsSettingsSchema, inventorySettingsSchema, providerCredentialSchema, taxonomyNodeSchema, invoiceStatusRuleSchema, communicationsSettingsSchema, SUPPLIER_RETURN_REASON_VALUES, supplierReturnSchema, supplierReturnStatusSchema, supplierCreditSchema, SUPPLIER_BILLING_CYCLES, supplierServiceSchema, supplierServiceUpdateSchema, supplierChargeSchema };
