import { db } from '../db/models.js';
import '../models/Order.js';
import '../models/Invoice.js';
import '../models/CreditTransaction.js';

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
 * The kinds a row can carry, grouped the way a buyer thinks about them rather
 * than the way they are stored. `order` covers both placing an order and every
 * status step after it, because "show me my orders" means both — splitting them
 * into two filters would make a filter for "order" that hides half the orders.
 *
 * Exported so the client's filter menu and the server's validation are built
 * from one list and cannot drift into disagreeing about what is filterable.
 */
const ACTIVITY_GROUPS = {
  order: ['order', 'order-status'],
  invoice: ['invoice', 'receipt'],
  payment: ['payment', 'void'],
  credit: ['credit'],
};

/** Every group key, plus `all`. The filter menu's options. */
const ACTIVITY_FILTERS = ['all', ...Object.keys(ACTIVITY_GROUPS)];

/**
 * @param {string|object} userId
 * @param {object}  [options]
 * @param {number}  [options.limit]     events returned after merging
 * @param {number}  [options.perSource] rows read from each collection
 * @param {boolean} [options.forBuyer]  buyer-facing wording
 */
async function activityFeed(userId, { limit = 80, perSource = 40, forBuyer = false } = {}) {
  const [orders, invoices, credits] = await Promise.all([
    db().Order.find({ user: userId }).sort({ createdAt: -1 }).limit(perSource).lean(),
    db().Invoice.find({ user: userId }).sort({ issuedAt: -1 }).limit(perSource).lean(),
    db().CreditTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(perSource).lean(),
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

/**
 * The same feed, filtered and cut into pages.
 *
 * **Why the paging happens here and not in Mongo.** The feed is a merge of
 * three collections, and a single event can be a sub-document (an order's
 * timeline step, an invoice's payment row) rather than a document — so there is
 * no one collection to `.skip()` on and no way to ask the database for "page 3
 * of the merged list". The merge has to happen first, which means the whole
 * window is assembled and then sliced.
 *
 * That is only safe because the window is bounded: `perSource` is raised to
 * `WINDOW` here rather than left at the 40 the summary uses, so a filtered view
 * still has enough rows behind it to fill several pages, and `total` is the
 * count of what matched inside that window. This is an account's own history —
 * hundreds of rows at the top end, not millions. If an account ever outgrows
 * the window, the fix is a real `Activity` collection written at the point each
 * event happens, not a bigger number here.
 */
const WINDOW = 400;

async function pagedActivityFeed(
  userId,
  { kind = 'all', from = null, to = null, page = 1, limit = 20, forBuyer = false } = {},
) {
  const { activity } = await activityFeed(userId, {
    limit: WINDOW,
    perSource: WINDOW,
    forBuyer,
  });

  const kinds = ACTIVITY_GROUPS[kind] ?? null;

  // Dates arrive as `YYYY-MM-DD`. `from` is the start of that day and `to` the
  // end of it, so picking the same date for both returns that day rather than
  // an empty range.
  const fromTime = from ? new Date(`${from}T00:00:00.000Z`).getTime() : null;
  const toTime = to ? new Date(`${to}T23:59:59.999Z`).getTime() : null;

  const matched = activity.filter((event) => {
    if (kinds && !kinds.includes(event.kind)) return false;
    if (fromTime == null && toTime == null) return true;

    const at = new Date(event.at).getTime();
    if (Number.isNaN(at)) return false;
    if (fromTime != null && at < fromTime) return false;
    if (toTime != null && at > toTime) return false;
    return true;
  });

  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  // A filter that shrinks the list under the current page would otherwise leave
  // the buyer on an empty page 6 with no way back except paging down by hand.
  const pageNumber = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (pageNumber - 1) * pageSize;

  return {
    activity: matched.slice(start, start + pageSize),
    total: matched.length,
    page: pageNumber,
    pages,
    // What the window held before filtering — the count the "N of M" line reads
    // against, so a filtered view can say what it is filtering out of.
    unfiltered: activity.length,
  };
}

export default { activityFeed, pagedActivityFeed, ACTIVITY_FILTERS, ACTIVITY_GROUPS };

export { activityFeed, pagedActivityFeed, ACTIVITY_FILTERS, ACTIVITY_GROUPS };
