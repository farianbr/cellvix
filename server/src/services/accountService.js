const { default: Order } = require('../models/Order.js');
const { default: Invoice } = require('../models/Invoice.js');
const { default: Product } = require('../models/Product.js');
const { default: Cart } = require('../models/Cart.js');
const { default: User } = require('../models/User.js');
const { default: ApiError } = require('../utils/ApiError.js');
const storeCredit = require('./storeCreditService.js');
const payment = require('./payment.js');
const invoicePaymentService = require('./invoicePaymentService.js');
const { activityFeed } = require('./activityService.js');
const { serializeOrder } = require('./orderService.js');
const { serialize: serializeProduct } = require('./productService.js');
const { renderInvoiceHtml } = require('./invoiceDocument.js');

/**
 * The dashboard payload (brief §8.3).
 *
 * One request, because an ERP-style overview that fires six is a slow overview.
 */
async function summary(user) {
  const [recentOrders, invoices, reorderRows, savedCarts] = await Promise.all([
    Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).lean(),

    Invoice.find({ user: user._id }).sort({ issuedAt: -1 }).lean(),

    // Most-ordered SKUs across this account's history — the "quick reorder"
    // shortcut is only useful if it reflects what they actually buy.
    Order.aggregate([
      { $match: { user: user._id } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQty: { $sum: '$items.qty' },
          orders: { $sum: 1 },
          lastOrdered: { $max: '$createdAt' },
        },
      },
      { $sort: { orders: -1, totalQty: -1 } },
      { $limit: 6 },
    ]),

    Cart.find({ user: user._id, savedForLater: true }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const reorderProducts = await Product.find({
    _id: { $in: reorderRows.map((row) => row._id).filter(Boolean) },
    isActive: true,
  }).lean();
  const productById = new Map(reorderProducts.map((product) => [product._id.toString(), product]));

  const now = Date.now();
  const outstanding = invoices.filter((invoice) => invoice.status !== 'paid');
  const overdue = outstanding.filter(
    (invoice) => invoice.dueDate && new Date(invoice.dueDate).getTime() < now,
  );

  return {
    recentOrders: recentOrders.map(serializeOrder),

    // Money the business already holds with us. Separate from the line of
    // credit below on purpose — see models/CreditTransaction.js.
    storeCredit: user.storeCredit ?? 0,

    credit: {
      limit: user.creditLimit ?? 0,
      balance: user.balance ?? 0,
      available: Math.max(0, (user.creditLimit ?? 0) - (user.balance ?? 0)),
      terms: user.terms,
      // Percentage of the limit already drawn — drives the dashboard meter.
      utilisation:
        user.creditLimit > 0 ? Math.min(100, Math.round((user.balance / user.creditLimit) * 100)) : 0,
    },

    invoices: {
      outstandingCount: outstanding.length,
      outstandingAmount: outstanding.reduce(
        (sum, invoice) => sum + (invoice.amount - invoice.amountPaid),
        0,
      ),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, invoice) => sum + (invoice.amount - invoice.amountPaid), 0),
    },

    stats: {
      orderCount: await Order.countDocuments({ user: user._id }),
      lifetimeSpend: invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      openOrders: await Order.countDocuments({
        user: user._id,
        status: { $in: ['placed', 'processing', 'shipped', 'out_for_delivery'] },
      }),
    },

    quickReorder: reorderRows
      .map((row) => {
        const product = productById.get(row._id?.toString());
        if (!product) return null;
        return {
          ...serializeProduct(product, user),
          timesOrdered: row.orders,
          totalQty: row.totalQty,
          lastOrdered: row.lastOrdered,
        };
      })
      .filter(Boolean),

    savedCarts: savedCarts.map((cart) => ({
      id: cart._id.toString(),
      name: cart.name,
      itemCount: cart.items.reduce((sum, item) => sum + item.qty, 0),
      lineCount: cart.items.length,
      createdAt: cart.createdAt,
    })),

    rep: user.accountRep ?? null,
  };
}

async function updateProfile(user, data) {
  Object.assign(user, data);
  await user.save();
  return user;
}

// ---- addresses --------------------------------------------------------------

/** Promotes one address to default, demoting the rest. Only for flags actually requested. */
function enforceSingleDefault(user, addressId, { shipping, billing }) {
  for (const address of user.addresses) {
    const isTarget = address._id.toString() === addressId.toString();
    if (shipping) address.isDefaultShipping = isTarget;
    if (billing) address.isDefaultBilling = isTarget;
  }
}

/**
 * Guarantees the account always has one default of each kind while it has any
 * addresses at all.
 *
 * Every path can break this — deleting the default, or simply un-ticking it on
 * the only address that had it — and checkout autofill silently degrades when it
 * does. So the invariant is restored after every mutation rather than patched
 * at each call site.
 */
function ensureDefaults(user) {
  if (user.addresses.length === 0) return;

  if (!user.addresses.some((address) => address.isDefaultShipping)) {
    user.addresses[0].isDefaultShipping = true;
  }
  if (!user.addresses.some((address) => address.isDefaultBilling)) {
    user.addresses[0].isDefaultBilling = true;
  }
}

async function addAddress(user, data) {
  // The first address a business saves is its default, whatever they ticked.
  const isFirst = user.addresses.length === 0;
  user.addresses.push({ ...data, country: data.country ?? 'Canada' });
  const added = user.addresses[user.addresses.length - 1];

  enforceSingleDefault(user, added._id, {
    shipping: isFirst || data.isDefaultShipping,
    billing: isFirst || data.isDefaultBilling,
  });

  ensureDefaults(user);
  await user.save();
  return user;
}

async function updateAddress(user, addressId, data) {
  const address = user.addresses.id(addressId);
  if (!address) throw ApiError.notFound('Address not found.', 'ADDRESS_NOT_FOUND');

  Object.assign(address, data);
  enforceSingleDefault(user, addressId, {
    shipping: data.isDefaultShipping,
    billing: data.isDefaultBilling,
  });

  ensureDefaults(user);
  await user.save();
  return user;
}

async function removeAddress(user, addressId) {
  const address = user.addresses.id(addressId);
  if (!address) throw ApiError.notFound('Address not found.', 'ADDRESS_NOT_FOUND');

  address.deleteOne();
  ensureDefaults(user);

  await user.save();
  return user;
}

// ---- payment methods --------------------------------------------------------

async function addPaymentMethod(user, data) {
  const isFirst = user.paymentMethods.length === 0;
  user.paymentMethods.push(data);
  const added = user.paymentMethods[user.paymentMethods.length - 1];

  if (isFirst || data.isDefault) {
    for (const method of user.paymentMethods) {
      method.isDefault = method._id.toString() === added._id.toString();
    }
  }

  await user.save();
  return user;
}

async function removePaymentMethod(user, methodId) {
  const method = user.paymentMethods.id(methodId);
  if (!method) throw ApiError.notFound('Payment method not found.', 'PAYMENT_METHOD_NOT_FOUND');

  const wasDefault = method.isDefault;
  method.deleteOne();
  if (wasDefault && user.paymentMethods.length > 0) user.paymentMethods[0].isDefault = true;

  await user.save();
  return user;
}

async function changePassword(user, { currentPassword, newPassword }) {
  const withHash = await User.findById(user._id).select('+passwordHash');
  const ok = await withHash.verifyPassword(currentPassword);
  if (!ok) {
    throw ApiError.badRequest('That is not your current password.', 'INVALID_PASSWORD', {
      currentPassword: 'Incorrect password.',
    });
  }

  await withHash.setPassword(newPassword);
  await withHash.save();
}

// ---- invoices ---------------------------------------------------------------

function serializeInvoice(invoice) {
  const overdue =
    invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return {
    id: invoice._id.toString(),
    number: invoice.number,
    // `due` (payable), `invoice` (settled, filed) or `receipt` (a store-credit
    // movement). The buyer's screen splits on this rather than on status: a
    // record is either something to pay or something that is done.
    kind: invoice.kind ?? 'invoice',
    orderNumber: invoice.order?.orderNumber ?? null,
    amount: invoice.amount,
    amountPaid: invoice.amountPaid,
    balance: invoice.amount - invoice.amountPaid,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    settledAt: invoice.settledAt ?? null,
    terms: invoice.terms,
    reference: invoice.reference ?? null,
    // Derived rather than stored: an unpaid invoice becomes overdue by the
    // passage of time, with nothing writing to the database.
    status: overdue ? 'overdue' : invoice.status,
    payments: invoice.payments ?? [],
  };
}

/**
 * Everything billed to this account, split by what it is.
 *
 * `due` and the rest are returned as two lists rather than one filtered on the
 * client, because they answer different questions and the screen shows them as
 * two panels: what do I owe, and what have I been invoiced. The totals follow
 * the same split.
 */
async function listInvoices(userId) {
  const invoices = await Invoice.find({ user: userId })
    .sort({ issuedAt: -1 })
    .populate('order', 'orderNumber')
    .lean();

  const shaped = invoices.map(serializeInvoice);
  const due = shaped.filter((invoice) => invoice.kind === 'due');
  const settled = shaped.filter((invoice) => invoice.kind !== 'due');

  return {
    // Kept whole for anything still reading the flat list.
    invoices: shaped,
    due,
    settled,
    totals: {
      count: shaped.length,
      // Only real invoices and receipts count as billed. A `due` record is not
      // yet an invoice, and counting it here would double the figure the moment
      // it settled and became one.
      billed: settled.reduce((sum, invoice) => sum + invoice.amount, 0),
      paid: shaped.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstanding: due.reduce((sum, invoice) => sum + invoice.balance, 0),
      overdue: due
        .filter((invoice) => invoice.status === 'overdue')
        .reduce((sum, invoice) => sum + invoice.balance, 0),
      dueCount: due.length,
    },
  };
}

async function getInvoice(userId, number) {
  const invoice = await Invoice.findOne({ number, user: userId })
    .populate('order')
    .lean();
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');

  return {
    ...serializeInvoice(invoice),
    order: invoice.order ? serializeOrder(invoice.order) : null,
  };
}

/**
 * The printable invoice — the same document the buyer was emailed when the
 * order was placed, rendered fresh so a later payment shows on it.
 */
async function invoiceDocument(user, number, { nonce, origin } = {}) {
  const invoice = await Invoice.findOne({ number, user: user._id }).populate('order').lean();
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');

  return renderInvoiceHtml({ invoice, order: invoice.order, user, nonce, origin });
}

/**
 * Line-of-credit activity.
 *
 * There is no ledger behind this the way there is for store credit, and there
 * deliberately is not one: the line of credit is a single balance on the user
 * document that orders draw against and payments retire. What a buyer wants to
 * see is how it got where it is, so this reconstructs the movements from the
 * invoices that caused them — draws from terms invoices, repayments from the
 * payments recorded against them.
 *
 * Store credit that settled part of a terms order is NOT a draw: that money
 * never came off the limit. It is subtracted here for the same reason the
 * invoice shows it as a payment.
 */
async function lineOfCreditActivity(user) {
  const invoices = await Invoice.find({ user: user._id, terms: { $ne: 'prepaid' } })
    .sort({ issuedAt: -1 })
    .populate('order', 'orderNumber')
    .lean();

  const entries = [];

  for (const invoice of invoices) {
    const payments = invoice.payments ?? [];
    const fromStoreCredit = payments
      .filter((payment) => payment.method === 'store-credit')
      .reduce((sum, payment) => sum + (payment.amount ?? 0), 0);

    const drawn = invoice.amount - fromStoreCredit;
    if (drawn > 0) {
      entries.push({
        id: `${invoice._id}-draw`,
        type: 'draw',
        amount: drawn,
        at: invoice.issuedAt,
        invoiceNumber: invoice.number,
        orderNumber: invoice.order?.orderNumber ?? null,
        note: invoice.order?.orderNumber
          ? `Order ${invoice.order.orderNumber} placed on ${(invoice.terms ?? '').replace('net', 'Net ')}`
          : 'Charged to the account',
      });
    }

    for (const [index, payment] of payments.entries()) {
      // The store-credit line is already accounted for above.
      if (payment.method === 'store-credit') continue;
      entries.push({
        id: `${invoice._id}-payment-${index}`,
        type: 'payment',
        amount: payment.amount ?? 0,
        at: payment.at ?? invoice.issuedAt,
        invoiceNumber: invoice.number,
        orderNumber: invoice.order?.orderNumber ?? null,
        note: `Payment against ${invoice.number}`,
      });
    }

    // Settlement recorded as a figure rather than as a payment row — seeded
    // history, and anything an admin marks paid without itemising it. Dated to
    // the last write on the invoice, which is when the settlement happened.
    const itemised = payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
    const unitemised = (invoice.amountPaid ?? 0) - itemised;
    if (unitemised > 0) {
      entries.push({
        id: `${invoice._id}-settled`,
        type: 'payment',
        amount: unitemised,
        at: invoice.updatedAt ?? invoice.issuedAt,
        invoiceNumber: invoice.number,
        orderNumber: invoice.order?.orderNumber ?? null,
        note: `${invoice.number} settled`,
      });
    }
  }

  entries.sort((a, b) => new Date(b.at) - new Date(a.at));

  const limit = user.creditLimit ?? 0;
  const balance = user.balance ?? 0;

  return {
    limit,
    balance,
    available: Math.max(0, limit - balance),
    utilisation: limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0,
    terms: user.terms,
    drawn: entries.filter((entry) => entry.type === 'draw').reduce((sum, e) => sum + e.amount, 0),
    repaid: entries.filter((entry) => entry.type === 'payment').reduce((sum, e) => sum + e.amount, 0),
    entries,
  };
}

/** The store-credit statement for the signed-in account. */
async function storeCreditStatement(userId) {
  return storeCredit.statement(userId);
}

/** Advance recharge — prepay and hold the money as store credit. */
async function rechargeStoreCredit(user, { amountDollars, poNumber }) {
  const amount = Math.round(Number(amountDollars) * 100);
  const posted = await storeCredit.recharge(user, { amount, poNumber });
  return { ...posted, message: 'Top-up added to your store credit.' };
}

// ---- paying -----------------------------------------------------------------

/**
 * Settles one amount, drawing store credit first if asked and charging the card
 * for whatever is left.
 *
 * Split out because paying a single invoice and paying the whole line of credit
 * differ only in what they are settling — the money side is identical, and two
 * copies of "credit first, then card" is two places for the split to be wrong.
 *
 * The order matters: **credit is spent before the card is charged**, but the
 * card is charged before either is recorded against an invoice. A declined card
 * must not leave credit spent, so the redemption is unwound if the charge
 * throws. The reverse order — charge first, then redeem — would leave a real
 * charge standing if the redemption failed, which is worse.
 *
 * Returns the payment rows to write, which the caller allocates.
 */
async function settleAmount(user, { total, useStoreCredit, poNumber, label }) {
  if (!Number.isInteger(total) || total <= 0) {
    throw ApiError.badRequest('There is nothing to pay.', 'NOTHING_DUE');
  }

  let creditApplied = 0;
  if (useStoreCredit) {
    const { applicable } = await storeCredit.previewForTotal(user._id, total);
    creditApplied = applicable;
  }

  const dueNow = total - creditApplied;
  const rows = [];
  const now = new Date();

  if (creditApplied > 0) {
    await storeCredit.redeemForOrder({
      userId: user._id,
      total: creditApplied,
      orderNumber: label,
    });
    rows.push({ amount: creditApplied, method: 'store-credit', reference: `credit_${label}`, at: now });
  }

  if (dueNow > 0) {
    let charged;
    try {
      charged = await payment.charge({
        amount: dueNow,
        method: 'card',
        orderNumber: label,
        poNumber,
      });
    } catch (error) {
      // Put the credit back. The buyer asked to pay and did not; leaving their
      // balance spent against nothing would be taking money for no invoice.
      if (creditApplied > 0) {
        await storeCredit.allocate(
          user._id,
          { amount: creditApplied, note: `Payment for ${label} was declined — credit returned` },
          null,
        );
      }
      throw error;
    }

    rows.push({
      amount: dueNow,
      method: 'card',
      reference: charged.reference,
      at: charged.processedAt,
    });
  }

  return { rows, creditApplied, charged: dueNow };
}

/**
 * Pays one invoice in full.
 *
 * The amount is the invoice's own balance and is never sent by the client
 * (§5.3). Partial payment is not offered: an invoice is issued when the money
 * is in, so a half-payment would leave a record that is neither an amount due
 * nor an invoice.
 */
async function payInvoice(user, number, { useStoreCredit, poNumber } = {}) {
  const invoice = await invoicePaymentService.payableFor(user._id, number);
  const total = invoicePaymentService.outstandingOf(invoice);

  const { rows, creditApplied, charged } = await settleAmount(user, {
    total,
    useStoreCredit,
    poNumber,
    label: invoice.number,
  });

  // One row at a time, through the one place a payment may be recorded — so
  // each earns referral commission on its own instalment and the line of
  // credit is repaid by the same amount that was collected.
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    await invoicePaymentService.recordPayment(invoice, row);
  }

  return {
    invoice: serializeInvoice(invoice.toObject()),
    creditApplied,
    charged,
    message: `${invoice.number} paid in full.`,
  };
}

/**
 * Pays the whole line of credit off in one action.
 *
 * `User.balance` is a single rolled-up number with nothing linking it to the
 * records that produced it, so "pay the balance" means settling the amounts
 * behind it: every `due` record on terms, **oldest first**, which is the order
 * a trade account expects and the order that clears the oldest ageing first.
 *
 * One charge covers the lot and is then allocated across the records, rather
 * than one charge per record — a buyer clicking `Pay all` expects one line on
 * their card statement, not seven.
 */
async function payOffCredit(user, { useStoreCredit, poNumber } = {}) {
  const invoices = await Invoice.find({
    user: user._id,
    kind: 'due',
    terms: { $ne: 'prepaid' },
  }).sort({ issuedAt: 1 });

  const payable = invoices.filter((invoice) => invoicePaymentService.outstandingOf(invoice) > 0);
  const total = payable.reduce(
    (sum, invoice) => sum + invoicePaymentService.outstandingOf(invoice),
    0,
  );

  if (total <= 0) {
    throw ApiError.badRequest('Your line of credit is already clear.', 'NOTHING_DUE');
  }

  const label = `PAYOFF-${user._id.toString().slice(-6)}`;
  const { rows, creditApplied, charged } = await settleAmount(user, {
    total,
    useStoreCredit,
    poNumber,
    label,
  });

  // Allocate oldest first. Each source of money (credit, then card) is drawn
  // down across the invoices in turn, so an invoice can legitimately carry two
  // payment rows — part credit, part card — and the sum still lands exactly on
  // its balance.
  const settled = [];
  const pool = rows.map((row) => ({ ...row, left: row.amount }));

  for (const invoice of payable) {
    let owing = invoicePaymentService.outstandingOf(invoice);

    for (const source of pool) {
      if (owing <= 0) break;
      if (source.left <= 0) continue;

      const slice = Math.min(source.left, owing);
      // eslint-disable-next-line no-await-in-loop
      await invoicePaymentService.recordPayment(invoice, {
        amount: slice,
        method: source.method,
        reference: source.reference,
        at: source.at,
      });

      source.left -= slice;
      owing -= slice;
    }

    settled.push(invoice.number);
  }

  return {
    settled,
    total,
    creditApplied,
    charged,
    message:
      settled.length === 1
        ? 'Your outstanding balance is paid.'
        : `${settled.length} outstanding amounts paid.`,
  };
}

/**
 * Everything that has happened on this account, newest first.
 *
 * Assembled by `activityFeed`, which the admin client profile already uses —
 * one feed, so a buyer and their account rep are looking at the same history
 * rather than two views that can disagree.
 */
async function activity(userId, { limit = 40 } = {}) {
  return activityFeed(userId, { limit, forBuyer: true });
}

/**
 * The buyer's own referral standing: their code, the rate, who they brought and
 * what that has earned them.
 *
 * Scoped to one referrer rather than reusing `referralService.listReferrals`,
 * which walks every referred account in the system for the admin screen.
 */
async function referrals(user) {
  const referralService = require('./referralService.js');
  return referralService.referralsFor(user);
}

// --- CommonJS exports -------------------------------------------------
exports.summary = summary;
exports.updateProfile = updateProfile;
exports.addAddress = addAddress;
exports.updateAddress = updateAddress;
exports.removeAddress = removeAddress;
exports.addPaymentMethod = addPaymentMethod;
exports.removePaymentMethod = removePaymentMethod;
exports.changePassword = changePassword;
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.invoiceDocument = invoiceDocument;
exports.lineOfCreditActivity = lineOfCreditActivity;
exports.storeCreditStatement = storeCreditStatement;
exports.rechargeStoreCredit = rechargeStoreCredit;
exports.payInvoice = payInvoice;
exports.payOffCredit = payOffCredit;
exports.activity = activity;
exports.referrals = referrals;
