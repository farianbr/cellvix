const { default: Order } = require('../models/Order.js');
const { default: Invoice } = require('../models/Invoice.js');
const { default: CreditTransaction } = require('../models/CreditTransaction.js');

/**
 * One account's history, newest first.
 *
 * Assembled from what already exists rather than from an audit log: `AuditLog`
 * covers staff actions, and orders, invoices, payments and credit movements are
 * the record of what happened to the account itself.
 *
 * It serves two screens — the Activity tab on the admin client profile and the
 * buyer's own overview — and it is one function rather than two so those two
 * cannot tell different stories about the same account. The only thing that
 * varies is the wording: an admin is reading about somebody else's account
 * ("Invoice INV-… issued"), a buyer about their own ("We issued invoice INV-…"
 * reads oddly, so the buyer's copy is written in the second person).
 */

const KIND_ORDER = 'order';

/** Prose for a credit movement, per audience. */
function creditTitle(credit, forBuyer) {
  const added = credit.amount > 0;

  if (!forBuyer) {
    return `Store credit ${added ? 'added' : 'spent'} · ${credit.type}`;
  }

  switch (credit.type) {
    case 'refund':
      return added ? 'Refund added to your store credit' : 'Refund reversed';
    case 'recharge':
      return 'Store credit topped up';
    case 'referral':
      return added ? 'Referral commission earned' : 'Referral commission reversed';
    case 'grant':
      return 'Store credit issued to you';
    case 'redemption':
      return 'Store credit used';
    default:
      return added ? 'Store credit added' : 'Store credit adjusted';
  }
}

/**
 * @param {string|object} userId
 * @param {object}  [options]
 * @param {number}  [options.limit]     events returned after merging
 * @param {number}  [options.perSource] rows read from each collection
 * @param {boolean} [options.forBuyer]  buyer-facing wording
 */
async function activityFeed(userId, { limit = 80, perSource = 40, forBuyer = false } = {}) {
  const [orders, invoices, credits] = await Promise.all([
    Order.find({ user: userId }).sort({ createdAt: -1 }).limit(perSource).lean(),
    Invoice.find({ user: userId }).sort({ issuedAt: -1 }).limit(perSource).lean(),
    CreditTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(perSource).lean(),
  ]);

  const events = [];

  for (const order of orders) {
    events.push({
      kind: KIND_ORDER,
      at: order.createdAt,
      title: `Order ${order.orderNumber} placed`,
      detail: `${order.items.length} ${order.items.length === 1 ? 'line' : 'lines'}`,
      amount: order.total,
      reference: order.orderNumber,
      href: `/account/orders/${order.orderNumber}`,
    });

    // The timeline is where status history already lives, so it does not need
    // a second store to be reportable.
    for (const step of order.timeline ?? []) {
      if (step.status === 'placed') continue;
      events.push({
        kind: 'order-status',
        at: step.at,
        title: `Order ${order.orderNumber} · ${step.status.replace(/_/g, ' ')}`,
        detail: step.note ?? null,
        reference: order.orderNumber,
        href: `/account/orders/${order.orderNumber}`,
      });
    }
  }

  for (const invoice of invoices) {
    const kind = invoice.kind ?? 'invoice';

    // A `due` record is not an invoice and must not be announced as one — that
    // is the whole distinction the `kind` field exists to draw.
    const issuedTitle =
      kind === 'receipt'
        ? `Receipt ${invoice.number}`
        : kind === 'due'
          ? `Amount due ${invoice.number} raised`
          : `Invoice ${invoice.number} issued`;

    events.push({
      kind: kind === 'receipt' ? 'receipt' : 'invoice',
      at: invoice.issuedAt,
      title: issuedTitle,
      detail: invoice.reference ?? invoice.terms ?? null,
      amount: invoice.amount,
      reference: invoice.number,
      href: '/account/invoices',
    });

    for (const payment of invoice.payments ?? []) {
      // A receipt's own payment row is the movement it already documents;
      // listing both puts the same money on the feed twice.
      if (kind === 'receipt') continue;

      events.push({
        kind: payment.method === 'void' ? 'void' : 'payment',
        at: payment.at,
        title:
          payment.method === 'void'
            ? `${invoice.number} voided`
            : `Payment received on ${invoice.number}`,
        detail: payment.reference ?? payment.method ?? null,
        amount: payment.amount,
        reference: invoice.number,
        href: '/account/invoices',
      });
    }
  }

  for (const credit of credits) {
    events.push({
      kind: 'credit',
      at: credit.createdAt,
      title: creditTitle(credit, forBuyer),
      detail: credit.note ?? null,
      amount: credit.amount,
      reference: credit.orderNumber ?? null,
      href: '/account/credit',
    });
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  return { activity: events.slice(0, limit) };
}

exports.default = { activityFeed };

// --- CommonJS exports -------------------------------------------------
exports.activityFeed = activityFeed;
