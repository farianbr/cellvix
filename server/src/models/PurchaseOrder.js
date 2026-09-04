import mongoose from 'mongoose';

/**
 * Stock on order from a supplier (ERP rework §6.8).
 *
 * The mirror image of `Order`: same integer cents, same recompute-server-side
 * rule, same denormalised line snapshots so a PO stays readable after the
 * catalogue moves on. The differences are that the money flows outward and
 * that receiving a line **increments** stock rather than decrementing it.
 *
 * `status` is derived from receiving, not chosen: a PO is `partial` while some
 * lines are short and `received` when none are. Only `draft → sent` and
 * `cancelled` are operator decisions. Keeping that in `purchaseService` rather
 * than in a client means the header can never claim a PO is complete while a
 * line is still outstanding.
 */
const purchaseOrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // Snapshots, for the same reason `Order` keeps them.
    sku: String,
    name: String,

    qtyOrdered: { type: Number, required: true, min: 1 },
    qtyReceived: { type: Number, default: 0, min: 0 },

    // What Cellvix pays, integer cents. Distinct from `Product.price`, which is
    // what a client pays; the gap between them is the margin every report reads.
    unitCost: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const PO_STATUSES = ['draft', 'sent', 'partial', 'received', 'cancelled'];

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, index: true }, // PO-2026-00001
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet' },

    status: { type: String, enum: PO_STATUSES, default: 'draft', index: true },

    orderDate: { type: Date, default: Date.now, index: true },
    expectedDate: Date,
    receivedDate: Date,

    items: [purchaseOrderItemSchema],

    // All integer cents, all recomputed from the lines on every write.
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    payment: {
      status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
      method: String,
      reference: String,
      paidAt: Date,
      // The `Expense` row this payment generated, so the two never double-count
      // and the expense can be found from the PO without a scan.
      expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
    },

    attachments: [String],

    // Same shape as `Order.timeline`, so `ProcessStrip` and the order stepper
    // read the same kind of history rather than two dialects of one idea.
    timeline: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
        _id: false,
      },
    ],

    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ supplier: 1, orderDate: -1 });

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export { PO_STATUSES, PurchaseOrder };
export default PurchaseOrder;
