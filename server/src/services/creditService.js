import Invoice from '../models/Invoice.js';
import User from '../models/User.js';

/**
 * The line of credit, derived from the invoices behind it.
 *
 * ## Why this exists
 *
 * `User.balance` was a stored counter incremented when an order drew on credit
 * and decremented when a payment arrived — six separate `$inc` sites across
 * three services. Every one of them had to fire exactly once, in the right
 * direction, for the number to stay true. In practice it drifted: an account
 * whose invoices owed **$2.26** was carrying a stored balance of **$2,950.96**,
 * which is a customer told they have no credit left when in fact they have
 * almost all of it.
 *
 * A counter that can only be right if nothing is ever missed is a counter that
 * will be wrong. So the balance is now **derived**: it is the sum still owed on
 * this account's credit-terms invoices, and there is nothing to keep in step.
 * Paying an invoice restores the headroom because the invoice is the thing that
 * was measured in the first place — which is exactly how a credit card behaves,
 * and what an operator expects.
 *
 * ## What counts as drawn
 *
 * Only invoices on **credit terms**. A prepaid invoice was settled at checkout
 * and never lent anything; counting it would charge the customer's limit for
 * money that never left Cellvix's hands. Voided invoices net to zero on their
 * own — a void writes a payment row for the outstanding amount — so they need
 * no special case here.
 */

/** The one query that defines "drawn on the line of credit". */
function drawnMatch(userId) {
  return { user: userId, terms: { $ne: 'prepaid' } };
}

/**
 * What one account currently owes on its line of credit, in integer cents.
 *
 * Clamped at zero: an over-applied payment or a hand-corrected invoice can put
 * the sum below it, and negative available credit is not a state any screen
 * has a design for.
 */
async function balanceOf(userId) {
  const [row] = await Invoice.aggregate([
    { $match: drawnMatch(userId) },
    {
      $group: {
        _id: null,
        owed: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } },
      },
    },
  ]);

  return Math.max(0, row?.owed ?? 0);
}

/**
 * The same figure for many accounts at once, as a `Map` of id → cents.
 *
 * The customers list shows this for every row; asking per account would be one
 * aggregate per row, which is the shape that made the old stored counter look
 * attractive in the first place.
 */
async function balancesFor(userIds = []) {
  if (!userIds.length) return new Map();

  const rows = await Invoice.aggregate([
    { $match: { user: { $in: userIds }, terms: { $ne: 'prepaid' } } },
    {
      $group: {
        _id: '$user',
        owed: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), Math.max(0, row.owed)]));
}

/**
 * Available headroom: the limit less what is drawn, never below zero.
 *
 * A limit that was lowered after money was drawn can legitimately leave an
 * account over its limit — that is a real state, and the answer to "how much
 * more may they spend" is still nothing rather than a negative.
 */
function availableOf(user, balance) {
  return Math.max(0, (user?.creditLimit ?? 0) - balance);
}

/**
 * Writes the derived figure back onto `User.balance`.
 *
 * The column is kept **as a cache, never as the truth** — reports, exports and
 * the seed still read it, and rewriting all of those at once is a bigger change
 * than this bug warrants. Every path that moves money calls this afterwards, so
 * the cache is re-derived rather than nudged, and a missed call now costs a
 * stale row that the next payment corrects instead of permanent drift.
 */
async function syncBalance(userId) {
  const balance = await balanceOf(userId);
  await User.updateOne({ _id: userId }, { $set: { balance } });
  return balance;
}

export { balanceOf, balancesFor, availableOf, syncBalance };
export default { balanceOf, balancesFor, availableOf, syncBalance };
