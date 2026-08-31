const mongoose = require('mongoose');

/**
 * Things Cellvix **buys** that are not stock (Purchase § Service Products) and
 * the recurring agreements it buys them under (Purchase § Subscription Plans).
 *
 * One collection, two kinds, and the distinction is `billing` rather than two
 * models: a courier account and a software subscription differ only in whether
 * a charge repeats. Splitting them would mean two screens, two services and two
 * ways to answer "what do we pay this supplier", which is the question both
 * exist to answer.
 *
 * **This is not the customer catalogue.** `Product` is what Cellvix sells — a
 * part, with stock, a grade and a shelf. Nothing here has stock, appears in the
 * storefront, or can be added to a cart; these are costs, and they land in the
 * P&L through `Expense` like every other cost. Keeping them out of `Product`
 * is what stops a freight contract turning up in a customer's search results.
 */

/**
 * `one_off` is billed when it is used — a repair sent out, a one-time setup fee.
 * The others repeat on a cycle and drive the renewal date.
 */
const BILLING_CYCLES = ['one_off', 'monthly', 'quarterly', 'yearly'];

/** How many days a cycle advances. `one_off` never renews, so it has no entry. */
const CYCLE_DAYS = { monthly: 30, quarterly: 91, yearly: 365 };

const supplierServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    code: { type: String, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 2000 },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    supplierName: String,

    /**
     * What it costs, in integer cents, like every other amount in this system.
     *
     * For a recurring plan this is the charge **per cycle**, not an annualised
     * figure: an operator reading a monthly plan wants the number on the
     * invoice they are about to receive, and normalising it here would make
     * every screen divide it back out again.
     */
    amount: { type: Number, required: true, default: 0 },

    billing: { type: String, enum: BILLING_CYCLES, default: 'one_off', index: true },

    /**
     * Where the cost lands in the P&L. Required for the same reason an expense
     * requires one: a cost with no category is a cost the reports cannot group,
     * and "uncategorised" grows until it is the largest line on the page.
     */
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
      index: true,
    },

    // Recurring plans only. `nextRenewalAt` is what the renewals board reads;
    // it advances by one cycle each time a charge is recorded.
    startedAt: Date,
    nextRenewalAt: { type: Date, index: true },

    // Set when a plan is cancelled. A date rather than a boolean, because "when
    // did we stop paying for this" is the question somebody asks later.
    cancelledAt: Date,

    reference: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 2000 },

    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

supplierServiceSchema.index({ supplier: 1, name: 1 });
supplierServiceSchema.index({ billing: 1, nextRenewalAt: 1 });

const SupplierService = mongoose.model('SupplierService', supplierServiceSchema);

// --- CommonJS exports -------------------------------------------------
exports.BILLING_CYCLES = BILLING_CYCLES;
exports.CYCLE_DAYS = CYCLE_DAYS;
exports.SupplierService = SupplierService;
exports.default = SupplierService;
