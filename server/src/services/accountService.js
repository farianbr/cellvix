const { default: Order } = require('../models/Order.js');
const { default: Invoice } = require('../models/Invoice.js');
const { default: Product } = require('../models/Product.js');
const { default: Cart } = require('../models/Cart.js');
const { default: User } = require('../models/User.js');
const { default: ApiError } = require('../utils/ApiError.js');
const storeCredit = require('./storeCreditService.js');
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
    orderNumber: invoice.order?.orderNumber ?? null,
    amount: invoice.amount,
    amountPaid: invoice.amountPaid,
    balance: invoice.amount - invoice.amountPaid,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    terms: invoice.terms,
    // Derived rather than stored: an unpaid invoice becomes overdue by the
    // passage of time, with nothing writing to the database.
    status: overdue ? 'overdue' : invoice.status,
    payments: invoice.payments ?? [],
  };
}

async function listInvoices(userId) {
  const invoices = await Invoice.find({ user: userId })
    .sort({ issuedAt: -1 })
    .populate('order', 'orderNumber')
    .lean();

  const shaped = invoices.map(serializeInvoice);

  return {
    invoices: shaped,
    totals: {
      count: shaped.length,
      billed: shaped.reduce((sum, invoice) => sum + invoice.amount, 0),
      paid: shaped.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstanding: shaped.reduce((sum, invoice) => sum + invoice.balance, 0),
      overdue: shaped
        .filter((invoice) => invoice.status === 'overdue')
        .reduce((sum, invoice) => sum + invoice.balance, 0),
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
async function invoiceDocument(user, number, { nonce } = {}) {
  const invoice = await Invoice.findOne({ number, user: user._id }).populate('order').lean();
  if (!invoice) throw ApiError.notFound('Invoice not found.', 'INVOICE_NOT_FOUND');

  return renderInvoiceHtml({ invoice, order: invoice.order, user, nonce });
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
