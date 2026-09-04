import mongoose from 'mongoose';

/**
 * How money out is grouped in the P&L and the expense report (ERP rework §6.9).
 *
 * Admin-managed rather than an enum: the starter set is Canadian and sensible,
 * but the operator adds their own without a deploy. A category that is in use
 * cannot be hard-deleted — only deactivated — because deleting one would
 * silently re-bucket every historical expense that pointed at it.
 */
const expenseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },

    // A design token name, not a hex value — the palette lives in CSS and an
    // arbitrary colour from a form is how a page ends up off-brand (§2b).
    colorToken: { type: String, default: 'ink' },

    // Whether GST/HST is normally claimable on this category. Drives the tax
    // report's input-credit column; the per-expense flag still wins.
    gstApplicable: { type: Boolean, default: true },

    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

expenseCategorySchema.index({ order: 1, name: 1 });

const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);

export { ExpenseCategory };
export default ExpenseCategory;
