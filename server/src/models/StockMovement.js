import mongoose from 'mongoose';

/**
 * Every change to `Product.stock`, with its reason.
 *
 * `Product.stock` is a running number and carries no history of its own, so a
 * quantity that looks wrong is otherwise unanswerable — this collection is the
 * answer. Each row stores the delta **and** the quantity it produced, so the
 * ledger can be reconciled against the product without re-summing from zero,
 * exactly as `CreditTransaction.balanceAfter` does for store credit.
 *
 * Written by `purchaseService` (receiving, adjustment) and by order fulfilment.
 * A client never adjusts stock directly.
 */
export const MOVEMENT_TYPES = ['purchase', 'sale', 'adjustment', 'return', 'damage', 'transfer'];

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // One location today, modelled so more can be added without a migration
    // (§0.9). Null means the default outlet until `Outlet` lands in phase 8.
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet' },

    type: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },

    // Signed. Positive is stock in, negative is stock out.
    qtyChange: { type: Number, required: true },
    qtyAfter: { type: Number, required: true },

    // Integer cents, on the movements that have a cost — a receipt does, a
    // damage write-off does at the cost it was carried at, a sale does not.
    unitCost: Number,

    // What caused it, in a form the UI can link back to without a lookup table.
    reference: {
      kind: { type: String, enum: ['purchase_order', 'order', 'rma', 'manual'] },
      id: mongoose.Schema.Types.ObjectId,
      label: String, // 'PO-2026-00001' — human-readable, denormalised
    },

    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

stockMovementSchema.index({ product: 1, createdAt: -1 });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export default StockMovement;
