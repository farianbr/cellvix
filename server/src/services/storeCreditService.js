import CreditTransaction from '../models/CreditTransaction.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import * as payment from './payment.js';

/**
 * Store credit — the only place a store-credit balance moves.
 *
 * The rule this file exists to enforce: a balance is never written by hand.
 * Every change is `post()`, which increments the cached balance on the user and
 * writes the ledger row that explains it, in that order, so a row can never
 * exist without the money having moved and the balance can always be re-derived
 * from the rows.
 *
 * See `models/CreditTransaction.js` for why this is separate from the line of
 * credit.
 */

/**
 * Applies a signed movement.
 *
 * The `$inc` is conditional for spends: the filter carries `storeCredit >= |amount|`,
 * so two concurrent redemptions cannot both pass a read-then-write check and
 * overdraw the balance. A failed match means someone else got there first.
 */
async function post({
  userId,
  amount,
  type,
  note,
  order,
  orderNumber,
  createdBy,
  paymentRef,
  referral,
}) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw ApiError.badRequest('A credit movement must be a non-zero whole number of cents.');
  }

  const filter = { _id: userId };
  if (amount < 0) filter.storeCredit = { $gte: -amount };

  const updated = await User.findOneAndUpdate(
    filter,
    { $inc: { storeCredit: amount } },
    { new: true },
  );

  if (!updated) {
    // Either the account is gone or the spend would overdraw it.
    const exists = await User.exists({ _id: userId });
    if (!exists) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');
    throw ApiError.badRequest(
      'That is more store credit than this account holds.',
      'INSUFFICIENT_STORE_CREDIT',
    );
  }

  const entry = await CreditTransaction.create({
    user: userId,
    amount,
    balanceAfter: updated.storeCredit,
    type,
    note,
    order,
    orderNumber,
    createdBy,
    paymentRef,
    referral,
  });

  return { balance: updated.storeCredit, entry: serialize(entry) };
}

export function serialize(entry) {
  const doc = entry.toObject ? entry.toObject() : entry;
  return {
    id: doc._id.toString(),
    amount: doc.amount,
    balanceAfter: doc.balanceAfter,
    type: doc.type,
    note: doc.note ?? '',
    orderNumber: doc.orderNumber ?? null,
    createdAt: doc.createdAt,
  };
}

export async function balanceOf(userId) {
  const user = await User.findById(userId).select('storeCredit').lean();
  if (!user) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');
  return user.storeCredit ?? 0;
}

/** The statement: balance plus the movements that produced it, newest first. */
export async function statement(userId, { limit = 50 } = {}) {
  const [balance, entries] = await Promise.all([
    balanceOf(userId),
    CreditTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);

  const added = entries.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  const spent = entries.filter((row) => row.amount < 0).reduce((sum, row) => sum - row.amount, 0);

  return { balance, added, spent, transactions: entries.map(serialize) };
}

/**
 * Admin allocation. A negative amount is a correction, not a purchase — it is
 * the only way credit leaves an account without an order behind it, so it is
 * typed `adjustment` rather than `redemption` and reads that way on the
 * statement.
 */
export async function allocate(userId, { amount, note }, adminId) {
  return post({
    userId,
    amount,
    type: amount > 0 ? 'grant' : 'adjustment',
    note: note || (amount > 0 ? 'Credit added by Cellvix' : 'Adjustment by Cellvix'),
    createdBy: adminId,
  });
}

/**
 * Referral commission, in or out (ERP rework §6.13).
 *
 * This exists so referrals are **not an exception** to the rule this file
 * enforces: a balance is never written by hand, and every movement is a ledger
 * row that explains itself. `referralService` decides *whether* and *how much*;
 * this decides nothing and simply moves the money, the same as every other
 * function here.
 *
 * A negative `amount` is a reversal — the referred payment was refunded or its
 * invoice voided — and carries `referral.reverses` pointing at the accrual it
 * undoes.
 *
 * Note it deliberately does **not** guard the balance the way a spend does. A
 * reversal has to succeed even when the referrer has already spent the credit:
 * refusing it would leave commission standing on money that came back, which is
 * exactly the leak the reversal exists to close. The balance is allowed to go
 * to zero and the ledger stays truthful about why.
 */
export async function creditReferral({ referrerId, amount, note, referral }) {
  if (amount < 0) {
    // Spend-style guards would block a reversal against an already-spent
    // balance, so this goes through the ledger without the `$gte` filter that
    // `post` applies to negative amounts.
    const updated = await User.findOneAndUpdate(
      { _id: referrerId },
      { $inc: { storeCredit: amount } },
      { new: true },
    );
    if (!updated) throw ApiError.notFound('Account not found.', 'USER_NOT_FOUND');

    // `storeCredit` has `min: 0` on the schema, which findOneAndUpdate does not
    // enforce. Clamp explicitly so a reversal larger than the remaining balance
    // lands on zero rather than a negative number no screen is designed to show.
    if (updated.storeCredit < 0) {
      updated.storeCredit = 0;
      await updated.save();
    }

    const entry = await CreditTransaction.create({
      user: referrerId,
      amount,
      balanceAfter: updated.storeCredit,
      type: 'referral',
      note,
      referral,
    });

    return { balance: updated.storeCredit, entry: serialize(entry) };
  }

  return post({ userId: referrerId, amount, type: 'referral', note, referral });
}

/**
 * Advance recharge: the buyer prepays and holds the money as store credit.
 *
 * The charge goes through the same mock gateway an order does, so a declined
 * top-up behaves like a declined checkout and nothing is credited.
 */
export async function recharge(user, { amount, poNumber }) {
  const result = await payment.charge({
    amount,
    method: 'card',
    orderNumber: `TOPUP-${user._id.toString().slice(-6)}`,
    poNumber,
  });

  return post({
    userId: user._id,
    amount,
    type: 'recharge',
    note: 'Account top-up',
    paymentRef: result.reference,
  });
}

/**
 * Refunds an order to store credit.
 *
 * Refunding to the original payment method needs a real gateway; refunding to
 * store credit needs nothing but this ledger, keeps the money with Cellvix, and
 * is what a trade account wants anyway — the next order is usually days away.
 * Partial refunds are allowed up to what is left unrefunded on the order.
 */
export async function refundOrder(orderNumber, { amount, note }, adminId) {
  const order = await Order.findOne({ orderNumber });
  if (!order) throw ApiError.notFound('Order not found.', 'ORDER_NOT_FOUND');

  const alreadyRefunded = order.refundedTotal ?? 0;
  const refundable = order.total - alreadyRefunded;

  if (refundable <= 0) {
    throw ApiError.badRequest('This order has already been refunded in full.', 'ALREADY_REFUNDED');
  }
  if (amount > refundable) {
    throw ApiError.badRequest(
      'That is more than is left to refund on this order.',
      'REFUND_TOO_LARGE',
    );
  }

  const posted = await post({
    userId: order.user,
    amount,
    type: 'refund',
    note: note || `Refund for ${order.orderNumber}`,
    order: order._id,
    orderNumber: order.orderNumber,
    createdBy: adminId,
  });

  order.refundedTotal = alreadyRefunded + amount;
  order.timeline.push({
    status: order.status,
    at: new Date(),
    note: `Refunded to store credit${note ? ` — ${note}` : ''}.`,
  });
  await order.save();

  // Referral commission follows the money back (§6.13). Placed here rather than
  // in each caller because both the admin refund route and an RMA resolution
  // arrive through this function — a rule enforced at the choke point cannot be
  // forgotten by a third caller added later.
  //
  // Only a refund in FULL reverses the commission. A partial refund is left
  // alone deliberately: clawing back a fraction of a fraction produces rounding
  // that never quite nets to zero across several partials, and the referrer
  // ends up owing a cent nobody can explain. Full refund is the case that
  // matters, and it is exact.
  //
  // Imported lazily: `referralService` imports this module, and a static import
  // here would close the cycle.
  if (order.refundedTotal >= order.total) {
    const { reverseForOrder } = await import('./referralService.js');
    await reverseForOrder(order._id);
  }

  return { ...posted, refundedTotal: order.refundedTotal, orderTotal: order.total };
}

/**
 * Spends credit against an order being placed.
 *
 * The caller passes the order total; how much credit is applied is decided here
 * and never by the client (PROJECT_INSTRUCTIONS.md §5.3 — the client never sends
 * a price or a discount).
 */
export async function redeemForOrder({ userId, total, orderId, orderNumber }) {
  const balance = await balanceOf(userId);
  const applied = Math.min(balance, total);
  if (applied <= 0) return { applied: 0, balance };

  const { balance: after } = await post({
    userId,
    amount: -applied,
    type: 'redemption',
    note: `Applied to ${orderNumber}`,
    order: orderId,
    orderNumber,
  });

  return { applied, balance: after };
}

/** What an order could draw before it is placed — drives the checkout preview. */
export async function previewForTotal(userId, total) {
  const balance = await balanceOf(userId);
  return { balance, applicable: Math.max(0, Math.min(balance, total)) };
}

export default {
  allocate,
  balanceOf,
  creditReferral,
  previewForTotal,
  recharge,
  redeemForOrder,
  refundOrder,
  statement,
};
