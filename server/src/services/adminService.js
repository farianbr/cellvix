const { default: User } = require('../models/User.js');
const { default: Product } = require('../models/Product.js');
const { default: Order } = require('../models/Order.js');
const { default: Invoice } = require('../models/Invoice.js');
const { default: CreditTransaction } = require('../models/CreditTransaction.js');
const { default: Rma, RMA_OPEN_STATUSES } = require('../models/Rma.js');
const { default: Ticket, TICKET_OPEN_STATUSES } = require('../models/Ticket.js');
const { default: Taxonomy } = require('../models/Taxonomy.js');
const { default: ApiError } = require('../utils/ApiError.js');
const storeCredit = require('./storeCreditService.js');
const referralService = require('./referralService.js');
const { generatePassword, sendWelcomeEmail } = require('./welcomeMail.js');
const { likeRegex } = require('../utils/regex.js');
const { serializeOrder } = require('./orderService.js');
const orderBuilder = require('./orderBuilder.js');
const invoicePaymentService = require('./invoicePaymentService.js');
const { activityFeed } = require('./activityService.js');
const { displayNameOf } = require('../utils/displayName.js');
const { renderInvoiceHtml } = require('./invoiceDocument.js');
const { invalidateTree } = require('./taxonomyService.js');
const { ORDER_STATUS_FLOW } = require('../../../shared/schemas/admin.js');

const LOW_STOCK_THRESHOLD = 50;

/**
 * Resolve the dashboard's date range.
 *
 * `from` and `to` are inclusive whole days in `YYYY-MM-DD`. `to` is pushed to
 * the end of its day here, on the server, so a range of "today to today" is a
 * real twenty-four hours rather than an empty instant — the client sends dates,
 * not timestamps, and only one side should own that rule.
 *
 * Defaults to the last thirty days, which is what the endpoint returned before
 * it took a range at all.
 */
function resolveRange({ from, to } = {}) {
  const now = new Date();

  const end = to ? new Date(`${to}T00:00:00`) : now;
  if (to) end.setHours(23, 59, 59, 999);

  const start = from
    ? new Date(`${from}T00:00:00`)
    : new Date(now.getTime() - 30 * 86_400_000);

  // A backwards range is a typo, not an intent. Swap rather than return
  // nothing, because an empty dashboard reads as "no business" and is a lie.
  if (start > end) return { start: end, end: start };
  return { start, end };
}

/** Bucket size that keeps a trend readable: daily up to ~10 weeks, then weekly. */
function bucketFor(start, end) {
  const days = Math.max(1, Math.round((end - start) / 86_400_000));
  return days > 70 ? 'week' : 'day';
}

/**
 * Both units label by their first day: `Aug 27`. A week reads as its Monday.
 *
 * The year is appended only when the range spans more than one, because a
 * weekly walk snaps back to Monday and can start in the previous December —
 * `Dec 29 → Dec 28` for a calendar year is correct but reads as nonsense
 * without it.
 */
function bucketLabel(date, withYear) {
  return date.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/**
 * Fill every bucket in the range, including the empty ones.
 *
 * A trend drawn only from days that had orders compresses a quiet week into a
 * single point and makes the line lie about its own shape.
 */
function fillBuckets(rows, start, end, unit) {
  const byKey = new Map(rows.map((row) => [row._id, row]));
  const points = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  if (unit === 'week') {
    // Monday-first, matching DateRangeBar's presets on the client.
    const day = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - day);
  }

  // Snapping to Monday can pull the first bucket into the previous year, so the
  // check happens after the snap rather than on the requested range.
  const withYear = cursor.getFullYear() !== end.getFullYear();

  let guard = 0;
  while (cursor <= end && guard < 400) {
    guard += 1;
    const key =
      unit === 'week'
        ? `${cursor.getFullYear()}-W${String(isoWeek(cursor)).padStart(2, '0')}`
        : cursor.toISOString().slice(0, 10);

    points.push({
      label: bucketLabel(cursor, withYear),
      value: byKey.get(key)?.total ?? 0,
      count: byKey.get(key)?.count ?? 0,
    });

    cursor.setDate(cursor.getDate() + (unit === 'week' ? 7 : 1));
  }

  return points;
}

function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86_400_000 + 1) / 7);
}

/**
 * Admin home: what needs attention today, not vanity metrics.
 *
 * **Two named money metrics, never one word** (ERP rework §9.1). `invoiced` is
 * the value of invoices issued in the range, by invoice date; `collected` is
 * payments actually received in the range, by payment date. They are different
 * numbers and the UI says which is which.
 *
 * **Refunds are their own line** (§9.2) — never a negative pushed into a
 * revenue figure.
 *
 * Today's response shape is preserved as a subset, so every existing consumer
 * keeps working while the new dashboard reads the richer fields.
 */
async function stats({ from, to } = {}) {
  const now = new Date();
  const { start, end } = resolveRange({ from, to });
  const unit = bucketFor(start, end);

  // The immediately preceding window of the same length, for the delta.
  const span = end - start;
  const priorStart = new Date(start.getTime() - span);

  const inRange = { $gte: start, $lte: end };

  const [
    pendingUsers,
    approvedUsers,
    totalClients,
    openOrders,
    awaitingFulfilment,
    revenueRows,
    invoicedRows,
    collectedRows,
    priorCollectedRows,
    refundRows,
    outstandingRows,
    overdueCount,
    lowStock,
    outOfStock,
    productCount,
    inventoryValueRows,
    trendRows,
    topClientRows,
    recentOrders,
    pendingQueue,
    lowStockItems,
    openRmas,
    openTickets,
  ] = await Promise.all([
    User.countDocuments({ status: 'pending' }),
    User.countDocuments({ status: 'approved', role: 'buyer' }),
    User.countDocuments({ role: 'buyer' }),

    Order.countDocuments({
      status: { $in: ['placed', 'processing', 'shipped', 'out_for_delivery'] },
    }),
    Order.countDocuments({ status: { $in: ['placed', 'processing'] } }),

    // Order value in range. Kept for `revenue.last30Days`, which the old shape
    // promised and other screens may still read.
    Order.aggregate([
      { $match: { createdAt: inRange, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),

    // Invoiced: by invoice date.
    Invoice.aggregate([
      { $match: { issuedAt: inRange } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Collected: by payment date, which is a different question and usually a
    // different number.
    Invoice.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.at': inRange } },
      { $group: { _id: null, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
    ]),

    Invoice.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.at': { $gte: priorStart, $lt: start } } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } },
    ]),

    // Refunds get their own tile and never push revenue negative (§9.2).
    //
    // Sourced from the credit ledger, not from `Order.refundedTotal`: an order
    // carries a running total with no date of its own, so dating it by
    // `updatedAt` would move a June refund into August the moment somebody
    // edited that order's status. Every refund posts a ledger row with its own
    // timestamp, and that is the honest date.
    CreditTransaction.aggregate([
      { $match: { type: 'refund', createdAt: inRange } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Receivables are a position, not a flow — always "as of now", never
    // filtered by the range, or the number stops meaning what it says.
    Invoice.aggregate([
      { $match: { status: { $ne: 'paid' } } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: { $subtract: ['$amount', '$amountPaid'] } },
          overdue: {
            $sum: {
              $cond: [{ $lt: ['$dueDate', now] }, { $subtract: ['$amount', '$amountPaid'] }, 0],
            },
          },
        },
      },
    ]),
    Invoice.countDocuments({ status: { $ne: 'paid' }, dueDate: { $lt: now } }),

    Product.countDocuments({ isActive: true, stock: { $gt: 0, $lt: LOW_STOCK_THRESHOLD } }),
    Product.countDocuments({ isActive: true, stock: 0 }),
    Product.countDocuments({ isActive: true }),

    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, value: { $sum: { $multiply: ['$stock', '$price'] } } } },
    ]),

    Order.aggregate([
      { $match: { createdAt: inRange, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id:
            unit === 'week'
              ? {
                  $concat: [
                    { $toString: { $isoWeekYear: '$createdAt' } },
                    '-W',
                    {
                      $cond: [
                        { $lt: [{ $isoWeek: '$createdAt' }, 10] },
                        { $concat: ['0', { $toString: { $isoWeek: '$createdAt' } }] },
                        { $toString: { $isoWeek: '$createdAt' } },
                      ],
                    },
                  ],
                }
              : { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
    ]),

    // Top clients by invoiced value in range.
    Invoice.aggregate([
      { $match: { issuedAt: inRange } },
      { $group: { _id: '$user', total: { $sum: '$amount' }, invoices: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'client' },
      },
      { $unwind: '$client' },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          businessName: '$client.businessName',
          total: 1,
          invoices: 1,
        },
      },
    ]),

    Order.find({}).sort({ createdAt: -1 }).limit(6).populate('user', 'businessName').lean(),
    User.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(5).lean(),

    Product.find({ isActive: true, stock: { $lt: LOW_STOCK_THRESHOLD } })
      .sort({ stock: 1 })
      .limit(6)
      .select('name sku stock price')
      .lean(),

    // Returns still needing attention. Deliberately unranged like the other
    // badge counters — a badge that moved when you changed the dashboard's
    // dates would be nonsense.
    Rma.countDocuments({ status: { $in: RMA_OPEN_STATUSES } }),
    Ticket.countDocuments({ status: { $in: TICKET_OPEN_STATUSES } }),
  ]);

  const collected = collectedRows[0]?.total ?? 0;
  const priorCollected = priorCollectedRows[0]?.total ?? 0;

  return {
    // The range the server actually used, echoed back so the UI can label the
    // period without re-deriving it and disagreeing.
    range: { from: start.toISOString(), to: end.toISOString(), bucket: unit },

    users: { pending: pendingUsers, approved: approvedUsers, total: totalClients },
    orders: {
      open: openOrders,
      awaitingFulfilment,
      last30Days: revenueRows[0]?.count ?? 0,
      inRange: revenueRows[0]?.count ?? 0,
    },

    revenue: {
      // Order value in range. `last30Days` is the old key and only means "last
      // thirty days" when no range was asked for; the new screens read
      // `orderValue`.
      last30Days: revenueRows[0]?.total ?? 0,
      orderValue: revenueRows[0]?.total ?? 0,
    },

    invoiced: { total: invoicedRows[0]?.total ?? 0, count: invoicedRows[0]?.count ?? 0 },
    collected: {
      total: collected,
      count: collectedRows[0]?.count ?? 0,
      // Percentage change against the preceding window of the same length.
      // Null rather than 0 when there is nothing to compare to — "no change"
      // and "no prior data" are different claims.
      deltaPercent: priorCollected > 0 ? ((collected - priorCollected) / priorCollected) * 100 : null,
    },
    refunds: { total: refundRows[0]?.total ?? 0, count: refundRows[0]?.count ?? 0 },

    receivables: {
      outstanding: outstandingRows[0]?.outstanding ?? 0,
      overdue: outstandingRows[0]?.overdue ?? 0,
      overdueCount,
    },

    inventory: {
      total: productCount,
      lowStock,
      outOfStock,
      value: inventoryValueRows[0]?.value ?? 0,
    },

    // The sidebar badge reads this by name. Open means every rung before
    // resolved or rejected — a return still needing somebody's attention.
    rma: { open: openRmas },

    // Open here excludes `ready_to_pickup`: the repair is done and the badge
    // should stop nagging, even though the device is still on the shelf.
    tickets: { open: openTickets },

    trend: fillBuckets(trendRows, start, end, unit),
    topClients: topClientRows,

    recentOrders: recentOrders.map((order) => ({
      ...serializeOrder(order),
      businessName: order.user?.businessName ?? null,
      displayName: displayNameOf(order.user),
    })),
    pendingQueue: pendingQueue.map(shapeUser),
    lowStockItems: lowStockItems.map((product) => ({
      id: product._id.toString(),
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      price: product.price,
    })),
  };
}

// ---- customers --------------------------------------------------------------

function shapeUser(user) {
  return {
    id: user._id.toString(),
    businessName: user.businessName,
    contactName: user.contactName,
    displayName: displayNameOf(user),
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: user.role,
    businessType: user.businessType,
    website: user.website,
    taxId: user.taxId,
    creditLimit: user.creditLimit ?? 0,
    balance: user.balance ?? 0,
    storeCredit: user.storeCredit ?? 0,
    terms: user.terms,
    addresses: user.addresses ?? [],
    accountRep: user.accountRep ?? null,
    rejectionReason: user.rejectionReason,
    approvedAt: user.approvedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    // Referral (§6.13). The code is what an operator reads out to a customer
    // who asks how to refer somebody; `referredBy` is read-only everywhere,
    // because attribution is set once at registration and never edited.
    referralCode: user.referralCode ?? null,
    referredBy: user.referredBy ? String(user.referredBy) : null,

    tier: user.tier ?? 'standard',

    /**
     * Consent, master flag and channels together.
     *
     * `recorded` says whether anybody has ever answered the channel question
     * for this account. An account that predates the field has not declined —
     * it has not been asked — and the UI has to be able to tell those apart,
     * because "no consent recorded" is a prompt to go and ask, while "declined"
     * is an answer to respect.
     */
    consent: {
      marketing: user.marketingConsent?.granted === true,
      unsubscribedAt: user.unsubscribedAt ?? null,
      recorded: Boolean(user.contactConsent?.at),
      at: user.contactConsent?.at ?? null,
      source: user.contactConsent?.source ?? null,
      channels: {
        sms: user.contactConsent?.sms === true,
        whatsapp: user.contactConsent?.whatsapp === true,
        email: user.contactConsent?.email === true,
        call: user.contactConsent?.call === true,
      },
    },
  };
}

async function listUsers({ status, q } = {}) {
  const query = { role: 'buyer' };
  if (status && status !== 'all') query.status = String(status);

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ businessName: rx }, { contactName: rx }, { email: rx }];
  }

  // Pending first — the approvals queue is the point of this screen.
  const users = await User.find(query).sort({ status: 1, createdAt: -1 }).limit(200).lean();

  const ids = users.map((user) => user._id);

  /**
   * Per-account trading history, in two grouped queries rather than two per
   * row. The customers list shows lifetime value, invoice count and last order
   * date for every account on screen; fetched individually that is 200 round
   * trips for a 200-row page.
   *
   * **Lifetime value is what was invoiced, not what was ordered.** An order can
   * be cancelled, edited or never invoiced; the invoice is the document the
   * business is actually accountable for, and it is what the reports already
   * treat as the money figure (§9.1). Cancelled orders are excluded from the
   * order side for the same reason they are excluded from the trend.
   */
  const now = new Date();

  const [counts, invoiceRows, overdueRows, orderRows] = await Promise.all([
    User.aggregate([
      { $match: { role: 'buyer' } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    Invoice.aggregate([
      { $match: { user: { $in: ids } } },
      {
        $group: {
          _id: '$user',
          lifetimeValue: { $sum: '$amount' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]),

    /**
     * Genuinely **overdue** money, which is not the same as `User.balance`.
     *
     * `balance` is what the account currently owes on its line of credit —
     * an invoice raised yesterday on Net 30 is owed but perfectly in order.
     * Overdue is the unpaid remainder of invoices whose due date has passed,
     * which is the figure an operator chases, and it matches the definition
     * `listInvoices` already uses for its `overdue` filter.
     */
    Invoice.aggregate([
      { $match: { user: { $in: ids }, status: { $ne: 'paid' }, dueDate: { $lt: now } } },
      {
        $group: {
          _id: '$user',
          overdue: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } },
          overdueCount: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { user: { $in: ids }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$user',
          orderCount: { $sum: 1 },
          lastOrderedAt: { $max: '$createdAt' },
        },
      },
    ]),
  ]);

  const invoiceBy = new Map(invoiceRows.map((row) => [String(row._id), row]));
  const overdueBy = new Map(overdueRows.map((row) => [String(row._id), row]));
  const orderBy = new Map(orderRows.map((row) => [String(row._id), row]));

  return {
    users: users.map((user) => {
      const key = String(user._id);
      const invoiced = invoiceBy.get(key);
      const late = overdueBy.get(key);
      const ordered = orderBy.get(key);

      return {
        ...shapeUser(user),
        lifetimeValue: invoiced?.lifetimeValue ?? 0,
        invoiceCount: invoiced?.invoiceCount ?? 0,
        // Kept apart from `balance`, which shapeUser already returns: one is
        // owed, the other is late, and collapsing them would overstate arrears.
        overdue: late?.overdue ?? 0,
        overdueCount: late?.overdueCount ?? 0,
        orderCount: ordered?.orderCount ?? 0,
        lastOrderedAt: ordered?.lastOrderedAt ?? null,
      };
    }),
    counts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
  };
}

async function getUser(id) {
  const user = await User.findById(id).lean();
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  const [orders, invoices] = await Promise.all([
    Order.find({ user: id }).sort({ createdAt: -1 }).limit(10).lean(),
    Invoice.find({ user: id }).sort({ issuedAt: -1 }).limit(10).lean(),
  ]);

  return {
    user: shapeUser(user),
    // Staff notes ride with the profile: they are the thing somebody reads
    // before picking up the phone, so a second request for them would just be
    // a spinner in front of the reason they opened the screen.
    ...listInternalNotes(user),
    orders: orders.map(serializeOrder),
    invoices: invoices.map((invoice) => ({
      number: invoice.number,
      amount: invoice.amount,
      amountPaid: invoice.amountPaid,
      balance: invoice.amount - invoice.amountPaid,
      dueDate: invoice.dueDate,
      status:
        invoice.status !== 'paid' && invoice.dueDate < new Date() ? 'overdue' : invoice.status,
    })),
  };
}

/**
 * Opens a client account from the admin side (§7.2's `+ Create > Client`).
 *
 * The counterpart to `authService.register`, and it differs from it in three
 * places that all trace back to *who is in the room*:
 *
 * - **It defaults to approved.** The admin creating the account is the
 *   approval; making them create a pending one and then approve it a moment
 *   later is a step that decides nothing. `status: 'pending'` is still offered,
 *   for an account being entered ahead of the paperwork.
 * - **Marketing consent defaults to false.** A business opening its own account
 *   gives implied consent under CASL s.10(9) — it asked for the relationship.
 *   An admin typing that business in has not been asked anything by anybody, so
 *   there is no implied basis to record and pretending otherwise is the kind of
 *   thing that is indefensible later. The source is stamped `admin` so it is
 *   obvious where the record came from.
 * - **It sets credit terms immediately** when the account starts approved, the
 *   same pairing `approveUser` enforces.
 */
async function createUser(data, adminId) {
  const email = String(data.email).toLowerCase().trim();

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with that email already exists.', 'EMAIL_IN_USE');
  }

  const user = new User({
    businessName: data.businessName,
    contactName: data.contactName,
    email,
    phone: data.phone,
    role: 'buyer',
    status: data.status,
    businessType: data.businessType,
    website: data.website,
    taxId: data.taxId,
    creditLimit: data.creditLimit ?? 0,
    terms: data.terms ?? 'prepaid',
    addresses: data.address
      ? [{ ...data.address, country: 'Canada', isDefaultShipping: true, isDefaultBilling: true }]
      : [],
  });

  /**
   * Consent is recorded only when the admin actually ticked something.
   *
   * An absent `contactConsent` means nobody asked, which the profile screen
   * shows as "nothing recorded yet" — a prompt to go and ask. Writing four
   * falses instead would claim the customer was asked and declined on every
   * channel, which is a different fact and one they never gave.
   */
  const channels = data.contactConsent;
  const anyChannel = channels && Object.values(channels).some(Boolean);

  if (channels) {
    user.contactConsent = { ...channels, at: new Date(), source: 'admin', by: adminId };
  }

  // Same master-switch rule `setContactConsent` follows: any channel on turns
  // marketing consent on, and it stays off when nothing was granted.
  user.marketingConsent = { granted: Boolean(anyChannel), source: 'admin', at: new Date() };

  /**
   * The password is generated here rather than typed by the admin, and it is
   * never persisted in the clear — `setPassword` hashes it, and the plaintext
   * lives only long enough to be put in the welcome email below.
   */
  const password = generatePassword();
  await user.setPassword(password);

  if (user.status === 'approved') {
    user.approvedAt = new Date();
    user.approvedBy = adminId;
    // Minted on approval, never at creation, for the reason `approveUser`
    // gives: a code that can refer people before its account is trusted is a
    // code worth abusing.
    await referralService.ensureReferralCode(user);
  }

  await user.save();

  /**
   * Fire-and-forget, like the invoice email: the account exists and is already
   * saved, so a dead SMTP host has to end in a log line rather than turning a
   * created customer into an error the admin sees. `sendWelcomeEmail` never
   * throws, and without SMTP configured it writes to `server/.mail/`.
   *
   * `delivered` rides back on the response so the admin panel can say whether
   * the customer actually got their credentials, rather than implying it.
   */
  const mail = await sendWelcomeEmail({ user, password });

  return { ...shapeUser(user.toObject()), welcomeEmail: mail };
}

/**
 * Edits a customer's profile from the admin side.
 *
 * **What it deliberately does not touch.** Status, credit limit and terms are
 * not editable here even though they sit on the same document: each already has
 * its own endpoint that does more than write the field — `approveUser` stamps
 * who approved and mints a referral code, `rejectUser` requires a reason,
 * `setCredit` is the line of credit. An edit form that also wrote `status`
 * would be a second, quieter approval path with none of that, which is exactly
 * the split the shared `ApproveClientForm` exists to prevent. It never touches
 * `balance` or `storeCredit` either: those move through their services only.
 *
 * **Email is editable but re-checked**, because it is the sign-in identity —
 * changing it to one already in use would lock two accounts out of themselves.
 *
 * Fields absent from the payload are left alone; a field sent empty is cleared,
 * which is how an operator removes a tax ID they entered by mistake.
 */
async function updateUser(id, data) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');
  if (user.role === 'admin') {
    throw ApiError.badRequest('Admin accounts are not edited here.', 'NOT_A_CUSTOMER');
  }

  if (data.email) {
    const email = String(data.email).toLowerCase().trim();
    if (email !== user.email) {
      const clash = await User.findOne({ email, _id: { $ne: user._id } });
      if (clash) {
        throw ApiError.conflict('An account with that email already exists.', 'EMAIL_IN_USE');
      }
      user.email = email;
    }
  }

  for (const field of ['businessName', 'contactName', 'phone']) {
    if (data[field] != null) user[field] = data[field];
  }

  // Optional descriptors: an empty string is a deletion, not a value.
  for (const field of ['businessType', 'website', 'taxId']) {
    if (data[field] != null) user[field] = data[field] || undefined;
  }

  /**
   * The address list is not replaced wholesale. An account can carry several,
   * and the form edits the default shipping one — overwriting the array would
   * silently drop the others.
   */
  if (data.address) {
    const index = user.addresses.findIndex((address) => address.isDefaultShipping);
    const next = { ...data.address, country: 'Canada' };

    if (index >= 0) {
      Object.assign(user.addresses[index], next);
    } else {
      user.addresses.push({ ...next, isDefaultShipping: true, isDefaultBilling: true });
    }
  }

  await user.save();
  return shapeUser(user.toObject());
}

/**
 * Records what a customer agreed to be contacted on (§6.13, CASL).
 *
 * **The master flag follows the channels.** `marketingConsent.granted` is what
 * every campaign query already checks, so leaving it untouched while ticking
 * four channel boxes would produce an account that looks contactable on the
 * profile and is invisible to every campaign. Granting any channel grants the
 * master flag; clearing all four withdraws it, which is the only reading of
 * "they agreed to nothing" that is not a trap.
 *
 * **Withdrawing consent here does not clear `unsubscribedAt`,** and re-granting
 * it does not resurrect a suppressed account: an unsubscribe is the customer's
 * own act and is not undone by an admin ticking a box. That has to go through
 * the marketing screen's explicit re-subscribe, which records who did it.
 */
async function setContactConsent(id, { sms, whatsapp, email, call }, adminId) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  const channels = {
    sms: Boolean(sms),
    whatsapp: Boolean(whatsapp),
    email: Boolean(email),
    call: Boolean(call),
  };

  user.contactConsent = {
    ...channels,
    at: new Date(),
    source: 'admin',
    by: adminId,
  };

  const any = Object.values(channels).some(Boolean);

  // Only move the master flag when it actually changes, so an unrelated edit
  // does not restamp somebody's original consent date.
  if (any && user.marketingConsent?.granted !== true) {
    user.marketingConsent = { granted: true, source: 'admin', at: new Date() };
  } else if (!any && user.marketingConsent?.granted === true) {
    user.marketingConsent = { ...user.marketingConsent, granted: false };
  }

  await user.save();
  return shapeUser(user.toObject());
}

/**
 * Sets the membership tier.
 *
 * A label, checked against the enum and nothing else. It does not touch price:
 * `pricingService` is the only place a discount is decided, and a tier that
 * granted one here would be a second discount engine outside that rule.
 */
async function setTier(id, { tier }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  user.tier = tier;
  await user.save();
  return shapeUser(user.toObject());
}

/** Staff-only notes on an account. Append-only; see the model for why. */
async function addInternalNote(id, { body }, staff) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  user.internalNotes.push({
    body,
    staff: staff?._id,
    // Denormalised so a note still says who wrote it after that person leaves
    // and their account is deleted — the attribution is part of the record.
    staffName: staff?.contactName ?? staff?.email ?? 'Staff',
    createdAt: new Date(),
  });

  await user.save();
  return listInternalNotes(user);
}

async function deleteInternalNote(id, noteId) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  const note = user.internalNotes.id(noteId);
  if (!note) throw ApiError.notFound('Note not found.', 'NOTE_NOT_FOUND');

  note.deleteOne();
  await user.save();
  return listInternalNotes(user);
}

/** Newest first — a note panel is read from the top. */
function listInternalNotes(user) {
  return {
    notes: [...(user.internalNotes ?? [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((note) => ({
        id: note._id.toString(),
        body: note.body,
        staffName: note.staffName ?? 'Staff',
        createdAt: note.createdAt,
      })),
  };
}

/**
 * Approves a business.
 *
 * This is the gate the whole B2B model hangs on: until it runs, the account can
 * browse but sees no prices and cannot order. Credit terms are set here because
 * approving and deciding terms are one decision, not two.
 */
async function approveUser(id, adminId, { creditLimit, terms, accountRep }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');
  if (user.role === 'admin') throw ApiError.badRequest('Admin accounts are not approved this way.');

  user.status = 'approved';
  user.approvedAt = new Date();
  user.approvedBy = adminId;
  user.rejectionReason = undefined;
  user.creditLimit = creditLimit;
  user.terms = terms;
  if (accountRep) user.accountRep = accountRep;

  // The referral code is minted here rather than at signup (§6.13): a pending
  // business might never be approved, and a code that can refer people before
  // its own account is trusted is a code worth abusing.
  await referralService.ensureReferralCode(user);

  await user.save();
  // TODO(email): notify the buyer once a mail provider is chosen (PROGRESS.md Q7).
  return shapeUser(user.toObject());
}

async function rejectUser(id, { reason }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  user.status = 'rejected';
  user.rejectionReason = reason;
  user.approvedAt = undefined;

  await user.save();
  return shapeUser(user.toObject());
}

async function setUserStatus(id, { status }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');
  if (user.role === 'admin') {
    throw ApiError.badRequest('You cannot change an admin account this way.', 'FORBIDDEN_TARGET');
  }

  user.status = status;
  if (status === 'approved' && !user.approvedAt) user.approvedAt = new Date();
  // Approving through the status route mints a code too, so an account's
  // referral ability does not depend on which screen approved it.
  if (status === 'approved') await referralService.ensureReferralCode(user);

  await user.save();
  return shapeUser(user.toObject());
}

/**
 * Allocates store credit to an account, or corrects it with a negative amount.
 *
 * Deliberately NOT part of `setCredit`: a credit limit is a lending decision
 * that gets edited, while an allocation is an event that gets recorded. One
 * overwrites, the other appends.
 */
async function allocateStoreCredit(id, { amountDollars, note }, adminId) {
  const amount = Math.round(Number(amountDollars) * 100);
  const posted = await storeCredit.allocate(id, { amount, note }, adminId);
  const user = await User.findById(id).lean();
  return { ...posted, user: shapeUser(user) };
}

async function storeCreditStatement(id) {
  return storeCredit.statement(id, { limit: 100 });
}

/** Refunds an order to the buyer's store credit. */
async function refundOrder(orderNumber, { amountDollars, note }, adminId) {
  const amount = Math.round(Number(amountDollars) * 100);
  return storeCredit.refundOrder(orderNumber, { amount, note }, adminId);
}

async function setCredit(id, { creditLimit, terms }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  user.creditLimit = creditLimit;
  user.terms = terms;

  await user.save();
  return shapeUser(user.toObject());
}

// ---- products ---------------------------------------------------------------

function shapeProduct(product) {
  return {
    id: product._id.toString(),
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    partType: product.partType,
    partTypeLabel: product.partTypeLabel,
    grade: product.grade,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    stock: product.stock,
    deviceTypeSlug: product.deviceTypeSlug,
    deviceTypeName: product.deviceTypeName,
    brandSlug: product.brandSlug,
    brandName: product.brandName,
    seriesSlug: product.seriesSlug,
    seriesName: product.seriesName,
    modelSlug: product.modelSlug,
    modelName: product.modelName,
    isActive: product.isActive,
    updatedAt: product.updatedAt,
  };
}

/**
 * `all: true` lifts the page cap — for the export, which must not silently
 * return the first hundred of four hundred products (§7.4). Deliberately a
 * separate flag rather than a bigger `limit` ceiling: the cap is there to stop
 * a screen asking for the whole catalogue by accident, and an export asking on
 * purpose should have to say so.
 */
async function listProducts({ q, stock, page = 1, limit = 40, all = false } = {}) {
  const query = {};

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { sku: rx }, { modelName: rx }];
  }

  if (stock === 'out') query.stock = 0;
  else if (stock === 'low') query.stock = { $gt: 0, $lt: LOW_STOCK_THRESHOLD };
  else if (stock === 'inactive') query.isActive = false;

  const pageNumber = all ? 1 : Math.max(1, Number(page) || 1);
  const pageSize = all ? 0 : Math.min(100, Number(limit) || 40);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ updatedAt: -1 })
      .skip(all ? 0 : (pageNumber - 1) * pageSize)
      // `.limit(0)` is Mongo's "no limit", which is what an export wants.
      .limit(pageSize)
      .lean(),
    Product.countDocuments(query),
  ]);

  return {
    products: products.map(shapeProduct),
    total,
    page: pageNumber,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Denormalised taxonomy names have to be looked up, not trusted from the client. */
async function resolveTaxonomyNames(data) {
  const slugs = [data.deviceTypeSlug, data.brandSlug, data.seriesSlug, data.modelSlug].filter(Boolean);
  const nodes = await Taxonomy.find({ slug: { $in: slugs } }).lean();
  const bySlug = new Map(nodes.map((node) => [node.slug, node]));

  return {
    deviceTypeName: bySlug.get(data.deviceTypeSlug)?.name,
    brandName: bySlug.get(data.brandSlug)?.name,
    seriesName: bySlug.get(data.seriesSlug)?.name,
    modelName: bySlug.get(data.modelSlug)?.name,
  };
}

async function createProduct(data) {
  const existing = await Product.findOne({ sku: data.sku.toUpperCase() });
  if (existing) throw ApiError.conflict('That SKU already exists.', 'DUPLICATE_SKU');

  const names = await resolveTaxonomyNames(data);
  const product = await Product.create({
    ...data,
    ...names,
    sku: data.sku.toUpperCase(),
    slug: slugify(`${data.modelSlug}-${data.partType}-${data.grade}-${Date.now().toString(36)}`),
    searchTerms: [data.name, names.modelName, names.brandName, data.partTypeLabel, data.grade].filter(
      Boolean,
    ),
  });

  invalidateTree();
  return shapeProduct(product.toObject());
}

async function updateProduct(id, data) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  const duplicate = await Product.findOne({ sku: data.sku.toUpperCase(), _id: { $ne: id } });
  if (duplicate) throw ApiError.conflict('That SKU already exists.', 'DUPLICATE_SKU');

  const names = await resolveTaxonomyNames(data);
  Object.assign(product, data, names, { sku: data.sku.toUpperCase() });

  await product.save();
  invalidateTree();
  return shapeProduct(product.toObject());
}

/**
 * Deactivates rather than deletes.
 *
 * Orders reference products by id, so a hard delete would leave historical
 * orders pointing at nothing. `isActive: false` hides it from the storefront
 * while keeping every past order readable.
 */
async function deactivateProduct(id) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');

  product.isActive = !product.isActive;
  await product.save();
  invalidateTree();
  return shapeProduct(product.toObject());
}

// ---- orders -----------------------------------------------------------------

/**
 * An admin raising an order directly (§7.2's `+ Create > Order`) — a phone
 * order, a walk-in, one that arrived by email.
 *
 * Almost nothing happens here. Prices are read from the catalogue by
 * `orderBuilder.buildOrderItems`, and everything after that — approval,
 * address, stock, totals, the order, the invoice, the bell — is
 * `orderBuilder.raiseOrder`, the same code a converted quote runs. That is the
 * point of the split: a second way to raise an order must not become a second
 * set of rules about when one may be raised.
 */
async function createOrder(body) {
  const user = await User.findById(body.user).lean();
  if (!user) throw ApiError.badRequest('Pick a client.', 'USER_NOT_FOUND');

  const items = await orderBuilder.buildOrderItems(body.items);

  const { order } = await orderBuilder.raiseOrder({
    user,
    items,
    shipping: body.shipping ?? 0,
    deliveryCode: body.deliveryCode,
    poNumber: body.poNumber,
    note: body.notes
      ? `Raised by an administrator. ${body.notes}`
      : 'Raised by an administrator.',
  });

  return serializeOrder(order);
}

async function listOrders({ status, q } = {}) {
  const query = {};
  if (status && status !== 'all') query.status = String(status);

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ orderNumber: rx }, { poNumber: rx }, { 'items.sku': rx }];
  }

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('user', 'businessName email')
    .lean();

  const counts = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

  return {
    orders: orders.map((order) => ({
      ...serializeOrder(order),
      businessName: order.user?.businessName ?? '—',
      businessEmail: order.user?.email ?? null,
    })),
    counts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
  };
}

/**
 * One order, for the detail screen (§4b.6, phase 12).
 *
 * Looked up by `orderNumber` rather than id, because that is what a packing
 * slip, an invoice and a customer email all carry — an operator reading a
 * number off paper should be able to type it into the URL.
 *
 * The linked invoice rides along so the screen can cross-link the two without a
 * second request; the buyer is populated for the same reason.
 */
async function getOrder(orderNumber) {
  const order = await Order.findOne({ orderNumber })
    .populate('user', 'businessName contactName email phone')
    .lean();
  if (!order) throw ApiError.notFound('Order not found.', 'ORDER_NOT_FOUND');

  const invoice = await Invoice.findOne({ order: order._id }).select('number status').lean();

  return {
    order: {
      ...serializeOrder(order),
      businessName: order.user?.businessName ?? '—',
      contactName: order.user?.contactName ?? null,
      businessEmail: order.user?.email ?? null,
      userId: order.user?._id?.toString() ?? null,
      invoiceNumber: invoice?.number ?? null,
      invoiceStatus: invoice?.status ?? null,
    },
  };
}

/**
 * Advances an order and appends to its timeline.
 *
 * The timeline is append-only: it is what the buyer's tracking page renders, so
 * rewriting history there would mean rewriting what the customer was told.
 * Moving to `shipped` without a tracking number is refused — that transition is
 * exactly when the buyer expects one to appear.
 */
async function updateOrderStatus(orderNumber, { status, note, tracking }) {
  const order = await Order.findOne({ orderNumber });
  if (!order) throw ApiError.notFound('Order not found.', 'ORDER_NOT_FOUND');

  if (order.status === 'delivered' && status !== 'delivered') {
    throw ApiError.badRequest('A delivered order cannot be moved back.', 'ORDER_FINALISED');
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextIndex = ORDER_STATUS_FLOW.indexOf(status);
  if (nextIndex !== -1 && currentIndex !== -1 && nextIndex < currentIndex) {
    throw ApiError.badRequest(
      'Order status only moves forward. Cancel the order instead.',
      'ORDER_BACKWARDS',
    );
  }

  if (tracking?.carrier || tracking?.number) {
    order.tracking = { ...order.tracking?.toObject?.(), ...tracking };
  }

  if (status === 'shipped' && !order.tracking?.number) {
    throw ApiError.badRequest(
      'Add a carrier and tracking number before marking an order shipped.',
      'TRACKING_REQUIRED',
    );
  }

  if (status !== order.status) {
    order.status = status;
    order.timeline.push({ status, at: new Date(), note: note || defaultNote(status) });
  } else if (note) {
    order.timeline.push({ status, at: new Date(), note });
  }

  await order.save();
  return serializeOrder(order.toObject());
}

function defaultNote(status) {
  return {
    placed: 'Order received and confirmed.',
    processing: 'Picking and quality-checking parts at the Toronto warehouse.',
    shipped: 'Handed to the carrier.',
    out_for_delivery: 'On the delivery vehicle.',
    delivered: 'Signed for at the delivery address.',
    cancelled: 'Order cancelled.',
  }[status];
}

// ---- invoices ---------------------------------------------------------------

/**
 * Overdue is **derived, never stored** — an unpaid invoice becomes overdue by
 * the passage of time, and writing that to the database would mean a nightly
 * job whose only job is to keep a column honest. The account side already reads
 * it this way; this matches it exactly so the two never disagree.
 */
function shapeAdminInvoice(invoice) {
  const balance = invoice.amount - invoice.amountPaid;
  const overdue =
    invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return {
    id: invoice._id.toString(),
    number: invoice.number,
    orderNumber: invoice.order?.orderNumber ?? null,
    businessName: invoice.user?.businessName ?? '—',
    contactName: invoice.user?.contactName ?? null,
    userId: invoice.user?._id?.toString() ?? null,
    amount: invoice.amount,
    amountPaid: invoice.amountPaid,
    balance,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    terms: invoice.terms,
    // Only a hand-raised invoice carries these; one behind an order says what
    // it is for by pointing at the order.
    reference: invoice.reference ?? null,
    notes: invoice.notes ?? null,
    status: overdue ? 'overdue' : invoice.status,
    payments: (invoice.payments ?? []).map((payment) => ({
      amount: payment.amount,
      at: payment.at,
      method: payment.method ?? null,
      reference: payment.reference ?? null,
    })),
  };
}

/**
 * Recompute an invoice's paid total and status from its own payments.
 *
 * The arithmetic moved to `invoicePaymentService` when the customer payment
 * path arrived and needed exactly the same rule. Kept as a re-export rather
 * than a second copy: two answers to "what does paid mean" is how an invoice
 * ends up `partial` on one screen and `paid` on another.
 */
const recomputeInvoice = invoicePaymentService.recompute;

/**
 * A standalone invoice (§7.2's `+ Create > Invoice`) — one raised against an
 * account for something no order covers.
 *
 * Two things it does that are easy to leave out:
 *
 * - **A sent `dueDate` wins over the terms.** The terms table is a default, not
 *   a rule: an agreed date is a fact about the arrangement, and silently
 *   overwriting it with `issuedAt + 30` would be the system correcting a human
 *   who knew better.
 * - **It draws on the line of credit.** An unpaid invoice on terms is money the
 *   client owes, so `balance` moves exactly as it does when an order raises
 *   one. Skipping this would leave a client under their limit on paper while
 *   owing more than it.
 */
async function createInvoice(body) {
  const user = await User.findById(body.user).lean();
  if (!user) throw ApiError.badRequest('Pick a client.', 'USER_NOT_FOUND');

  const issuedAt = body.issuedAt ? new Date(`${body.issuedAt}T00:00:00`) : new Date();

  let dueDate = body.dueDate ? new Date(`${body.dueDate}T00:00:00`) : null;
  if (!dueDate) {
    dueDate = new Date(issuedAt);
    dueDate.setDate(dueDate.getDate() + (orderBuilder.TERMS_DAYS[body.terms] ?? 0));
  }

  const invoice = await Invoice.create({
    // A charge raised by hand is money owed, not money received, so it starts
    // life as a `due` record in the `CVX-` series and is renumbered into `INV-`
    // when it settles.
    number: await orderBuilder.nextInvoiceNumber('CVX'),
    kind: 'due',
    // No `order`: that is what makes this one standalone, and the field has
    // always been optional so nothing else has to change to allow it.
    user: user._id,
    amount: body.amount,
    amountPaid: 0,
    issuedAt,
    dueDate,
    terms: body.terms,
    status: 'unpaid',
    reference: body.reference,
    notes: body.notes,
  });

  if (body.terms !== 'prepaid') {
    await User.updateOne({ _id: user._id }, { $inc: { balance: body.amount } });
  }

  return shapeAdminInvoice({ ...invoice.toObject(), user, order: null });
}

/**
 * Admin invoice list.
 *
 * `status=overdue` is a filter over derived state rather than a stored value,
 * so it is applied in the query as "not paid, and past due" — the dashboard
 * links straight here with it.
 */
async function listInvoices({ status, q, from, to } = {}) {
  const now = new Date();
  const query = {};

  if (status === 'overdue') {
    query.status = { $ne: 'paid' };
    query.dueDate = { $lt: now };
  } else if (status && status !== 'all') {
    query.status = String(status);
  }

  if (from || to) {
    query.issuedAt = {};
    if (from) query.issuedAt.$gte = new Date(`${from}T00:00:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setHours(23, 59, 59, 999);
      query.issuedAt.$lte = end;
    }
  }

  if (q) {
    const rx = likeRegex(q);
    // An invoice number is the obvious search, but staff more often have the
    // business in front of them, so both resolve.
    const users = await User.find({ $or: [{ businessName: rx }, { email: rx }] })
      .select('_id')
      .lean();
    query.$or = [{ number: rx }, { user: { $in: users.map((user) => user._id) } }];
  }

  const invoices = await Invoice.find(query)
    .sort({ issuedAt: -1 })
    .limit(200)
    .populate('order', 'orderNumber')
    .populate('user', 'businessName contactName')
    .lean();

  // Counts come from the whole collection, not the filtered set — a pill that
  // showed "Overdue 0" because you are already filtered to Paid is useless.
  const [statusRows, overdueCount] = await Promise.all([
    Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Invoice.countDocuments({ status: { $ne: 'paid' }, dueDate: { $lt: now } }),
  ]);

  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  counts.overdue = overdueCount;
  counts.all = statusRows.reduce((sum, row) => sum + row.count, 0);

  const shaped = invoices.map(shapeAdminInvoice);

  return {
    invoices: shaped,
    counts,
    totals: {
      billed: shaped.reduce((sum, invoice) => sum + invoice.amount, 0),
      paid: shaped.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstanding: shaped.reduce((sum, invoice) => sum + invoice.balance, 0),
    },
  };
}

async function getInvoice(number) {
  const invoice = await Invoice.findOne({ number })
    .populate('order', 'orderNumber items total status')
    .populate('user', 'businessName contactName email phone')
    .lean();

  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');
  return { invoice: shapeAdminInvoice(invoice) };
}

/**
 * Record a payment against an invoice.
 *
 * The client sends an amount, a date, a method and a reference — never a status
 * and never a running total. `amountPaid` and `status` are both recomputed from
 * the payment rows, server-side, exactly as the Instructions require of every
 * money total.
 */
async function recordPayment(number, { amountDollars, at, method, reference }) {
  const invoice = await Invoice.findOne({ number });
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');

  const amount = Math.round(Number(amountDollars) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('Enter an amount to record.', 'INVALID_AMOUNT');
  }

  // The payment row, the repayment of the line of credit, the promotion of a
  // settled `due` record into an invoice and the referral accrual all happen in
  // `invoicePaymentService` — the one place any of that is allowed to happen,
  // so an admin-recorded payment and a buyer-made one cannot behave
  // differently.
  await invoicePaymentService.recordPayment(invoice, {
    amount,
    at: at ? new Date(`${at}T12:00:00`) : new Date(),
    method,
    reference,
  });

  // Read back by the invoice's *current* number: settling a `due` record
  // renumbers it out of the `CVX-` series into `INV-`, so `number` as it
  // arrived may no longer resolve.
  return getInvoice(invoice.number);
}

/**
 * Void an invoice.
 *
 * Voiding is modelled as full forgiveness rather than a delete: the row stays,
 * the balance goes to zero, and the reason is recorded as a payment of type
 * `void`. An invoice that vanishes takes its own audit trail with it.
 */
async function voidInvoice(number, { reason } = {}) {
  const invoice = await Invoice.findOne({ number });
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');
  if (invoice.status === 'paid' && invoice.amountPaid >= invoice.amount) {
    throw ApiError.badRequest('This invoice is already settled.', 'ALREADY_SETTLED');
  }

  const outstanding = invoice.amount - invoice.amountPaid;
  if (outstanding > 0) {
    // `settle: false` — a void is forgiveness, not money. It must not promote
    // the record to an invoice (nothing was invoiced) and must not earn
    // commission, which is why this does not go through `recordPayment`.
    await invoicePaymentService.applyPayment(invoice, {
      amount: outstanding,
      method: 'void',
      reference: reason || 'Voided by an administrator',
      settle: false,
    });

    // The debt is forgiven, so it stops counting against the line of credit —
    // the same release a payment produces, for the opposite reason. Without
    // this a voided invoice would hold the account at its limit for money
    // nobody will ever collect.
    if (invoice.terms && invoice.terms !== 'prepaid') {
      await User.updateOne(
        { _id: invoice.user, balance: { $gte: outstanding } },
        { $inc: { balance: -outstanding } },
      );
    }
  } else {
    recomputeInvoice(invoice);
    await invoice.save();
  }

  // Voiding forgives the balance, so any commission this invoice earned is
  // commission on money that never arrived. Every accrual against it is
  // reversed — commission on money that came back is money leaking out
  // (§6.13). Idempotent, so voiding twice does not claw back twice.
  await referralService.reverseForInvoice(invoice.number);

  return getInvoice(number);
}

/**
 * Every activity touching one account, newest first — the Activity tab on the
 * client profile.
 *
 * Assembled from what already exists rather than from an audit log: `AuditLog`
 * arrives in phase 11, and until it does, orders, invoices, payments and credit
 * movements are the record.
 */
async function userActivity(id) {
  const user = await User.findById(id).select('_id').lean();
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  // The feed itself lives in `activityService`, because the buyer's own
  // overview shows the same history and two assemblies of it would eventually
  // disagree about the same account.
  return activityFeed(id);
}

/**
 * Advance several orders at once.
 *
 * **Every rule the single-order route enforces still applies**, and it applies
 * here rather than being waved through because the request was plural: no
 * backwards moves, nothing out of a delivered order, and no marking an order
 * shipped without a tracking number.
 *
 * A batch is **partial by design**. One order that cannot make the move must
 * not fail the other forty, so each is attempted independently and the response
 * names what moved and what did not, with a reason per skip. The UI shows that
 * list — silently moving nineteen of twenty is how an operator comes to trust a
 * button that is lying to them.
 *
 * Bulk deliberately offers **no tracking field**: one tracking number across
 * many parcels is wrong, so bulk-to-shipped skips anything without one already
 * and says so.
 */
async function bulkUpdateOrderStatus({ orderNumbers, status, note }) {
  const orders = await Order.find({ orderNumber: { $in: orderNumbers } });
  const byNumber = new Map(orders.map((order) => [order.orderNumber, order]));

  const updated = [];
  const skipped = [];

  for (const orderNumber of orderNumbers) {
    const order = byNumber.get(orderNumber);

    if (!order) {
      skipped.push({ orderNumber, reason: 'Not found.' });
      continue;
    }
    if (order.status === status) {
      skipped.push({ orderNumber, reason: `Already ${status.replace(/_/g, ' ')}.` });
      continue;
    }
    if (order.status === 'delivered') {
      skipped.push({ orderNumber, reason: 'Delivered orders cannot be moved.' });
      continue;
    }
    if (order.status === 'cancelled') {
      skipped.push({ orderNumber, reason: 'Cancelled orders cannot be moved.' });
      continue;
    }

    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
    const nextIndex = ORDER_STATUS_FLOW.indexOf(status);
    if (nextIndex !== -1 && currentIndex !== -1 && nextIndex < currentIndex) {
      skipped.push({ orderNumber, reason: 'Status only moves forward.' });
      continue;
    }

    if (status === 'shipped' && !order.tracking?.number) {
      skipped.push({ orderNumber, reason: 'Needs a tracking number — ship it individually.' });
      continue;
    }

    order.status = status;
    order.timeline.push({ status, at: new Date(), note: note || defaultNote(status) });
    await order.save();
    updated.push(order.orderNumber);
  }

  return { updated, skipped };
}

/**
 * The invoice document, for an admin.
 *
 * The buyer-facing route scopes its lookup to `user: req.user._id`, which is
 * correct there and means an admin gets a 404 on somebody else's invoice. This
 * renders **the same artefact through the same renderer** — a second rendering
 * would be free to drift from what the customer actually received, and then the
 * two would disagree in front of a customer.
 */
async function invoiceDocument(number, { nonce } = {}) {
  const invoice = await Invoice.findOne({ number }).populate('order').lean();
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');

  const user = await User.findById(invoice.user).lean();
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

  return renderInvoiceHtml({ invoice, order: invoice.order, user, nonce });
}

// --- CommonJS exports -------------------------------------------------
exports.stats = stats;
exports.listUsers = listUsers;
exports.getUser = getUser;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.setContactConsent = setContactConsent;
exports.setTier = setTier;
exports.addInternalNote = addInternalNote;
exports.deleteInternalNote = deleteInternalNote;
exports.approveUser = approveUser;
exports.rejectUser = rejectUser;
exports.setUserStatus = setUserStatus;
exports.allocateStoreCredit = allocateStoreCredit;
exports.storeCreditStatement = storeCreditStatement;
exports.refundOrder = refundOrder;
exports.setCredit = setCredit;
exports.listProducts = listProducts;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deactivateProduct = deactivateProduct;
exports.createOrder = createOrder;
exports.listOrders = listOrders;
exports.getOrder = getOrder;
exports.updateOrderStatus = updateOrderStatus;
exports.createInvoice = createInvoice;
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.recordPayment = recordPayment;
exports.voidInvoice = voidInvoice;
exports.userActivity = userActivity;
exports.bulkUpdateOrderStatus = bulkUpdateOrderStatus;
exports.invoiceDocument = invoiceDocument;
