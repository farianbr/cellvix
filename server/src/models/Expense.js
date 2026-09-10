import mongoose from 'mongoose';

/**
 * Money out. Feeds the P&L and the expense report (ERP rework §6.9).
 *
 * A row created by recording a purchase-order payment carries `purchaseOrder`
 * and is labelled as such in the list, so the operator can see which expenses
 * they entered and which the system entered for them. Those rows are not
 * editable from the expense screen — the purchase order owns them.
 *
 * `taxIncluded` decides how `tax` reads: when true the amount already contains
 * the tax, when false the tax sits on top. Storing the flag rather than
 * normalising on the way in keeps the number the operator typed on the receipt
 * the same number in the database.
 */
const expenseSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true }, // EXP-2026-00001

    date: { type: Date, required: true, default: Date.now, index: true },
    description: { type: String, required: true, trim: true, maxlength: 240 },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
      index: true,
    },

    payee: { type: String, trim: true, maxlength: 120 },
    method: { type: String, trim: true, maxlength: 40 },

    status: { type: String, enum: ['pending', 'paid'], default: 'paid', index: true },

    // Integer cents, both.
    amount: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    taxIncluded: { type: Boolean, default: true },

    reference: { type: String, trim: true, maxlength: 80 },

    // Set on rows the purchase-order payment step created. See the note above.
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },

    attachment: String,
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

expenseSchema.index({ date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);

export { Expense };
export default Expense;
