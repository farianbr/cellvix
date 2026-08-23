import mongoose from 'mongoose';

/**
 * The store-credit ledger.
 *
 * Store credit and the line of credit are two different things and are kept
 * apart deliberately:
 *
 *   - the **line of credit** (`User.creditLimit` / `User.balance` / `terms`) is
 *     money Cellvix lends the business — a limit it draws against and pays back
 *     on invoice terms;
 *   - **store credit** (this ledger, mirrored on `User.storeCredit`) is money
 *     the business already holds with Cellvix — a refund, a prepaid top-up, or
 *     an allocation an admin made — which reduces what the next order costs.
 *
 * Every movement is a row here. `User.storeCredit` is a cache of the running
 * total so a balance read is one document rather than an aggregation, and every
 * row carries the `balanceAfter` it produced, so the two can be reconciled and a
 * statement can be printed without re-summing history.
 *
 * Nothing writes this collection directly — `services/storeCreditService.js`
 * owns it, the same way `pricingService` owns discounts.
 */

export const CREDIT_TYPES = ['refund', 'recharge', 'grant', 'adjustment', 'redemption'];

const creditTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Signed integer cents. Positive adds credit, negative spends it.
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    type: { type: String, enum: CREDIT_TYPES, required: true, index: true },

    // Free text shown to the buyer on their statement, so it is written for
    // them, not for us: "Refund for CVX-2026-10042", not "adj/ref/42".
    note: { type: String, trim: true, maxlength: 240 },

    // Set when the movement belongs to an order — a refund against it, or credit
    // spent on it.
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: String,

    // Who made it happen. Absent for buyer-initiated top-ups and redemptions.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Mock gateway reference for a top-up, so a recharge can be traced the same
    // way an order payment can.
    paymentRef: String,
  },
  { timestamps: true },
);

creditTransactionSchema.index({ user: 1, createdAt: -1 });

export const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);

export default CreditTransaction;
