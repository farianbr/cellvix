import mongoose from 'mongoose';

/**
 * A return authorisation (ERP rework §6.3).
 *
 * The status ladder is a real workflow, not a label: a part is requested,
 * approved, shipped back, received, inspected, and only then resolved. Skipping
 * a rung would mean an operator resolving something that has not physically
 * arrived, so `rmaService` enforces the order the same way order fulfilment
 * refuses to ship before it processes.
 *
 * **A refund resolution moves money through `storeCreditService` and nowhere
 * else** (invariant 5). An RMA is not an exception to that rule; it is the case
 * the rule was written for. Restocking an accepted return writes a
 * `StockMovement` of type `return` through `purchaseService.applyStockMovement`,
 * for the same reason — one ledger, one writer.
 */
const RMA_STATUSES = [
  'requested',
  'approved',
  'in_transit',
  'received',
  'inspecting',
  'resolved',
  'rejected',
];

/** Everything before `resolved`/`rejected` is open, and ages against the SLA. */
const RMA_OPEN_STATUSES = RMA_STATUSES.filter(
  (status) => !['resolved', 'rejected'].includes(status),
);

const RMA_RESOLUTIONS = ['pending', 'refund', 'replace', 'reject'];

/**
 * What happens to each returned part once it has been looked at.
 *
 * `restock` is the only disposition that puts stock back on the shelf, and it
 * is deliberately separate from the RMA's overall resolution: a customer can be
 * refunded for an item that is scrapped rather than resold. Conflating the two
 * is how a warehouse ends up with phantom inventory.
 */
const ITEM_DISPOSITIONS = ['pending', 'restock', 'scrap', 'return_to_supplier', 'reject'];

const rmaItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    sku: String,
    name: String,

    qty: { type: Number, required: true, min: 1 },

    // What the customer said, and what inspection found. Kept apart on purpose:
    // the difference between the two is the entire value of an inspection step.
    reason: { type: String, trim: true, maxlength: 300 },
    condition: { type: String, trim: true, maxlength: 300 },

    disposition: { type: String, enum: ITEM_DISPOSITIONS, default: 'pending' },

    // What this line was sold for, snapshotted from the order so a refund can
    // be proposed without re-reading a catalogue that has since moved.
    unitPrice: Number,

    // Set once this line has actually been put back into stock, so a second
    // save cannot restock it twice.
    restockedAt: Date,
  },
  { _id: false },
);

const rmaSchema = new mongoose.Schema(
  {
    rmaNumber: { type: String, required: true, unique: true, index: true }, // RMA-2026-00001
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: String,

    status: { type: String, enum: RMA_STATUSES, default: 'requested', index: true },

    items: [rmaItemSchema],

    reason: { type: String, trim: true, maxlength: 500 },

    resolution: { type: String, enum: RMA_RESOLUTIONS, default: 'pending' },

    // Integer cents. Written only by the refund path, which routes through
    // `storeCreditService` — this field is a record of what happened, never the
    // instruction that made it happen.
    refundAmount: { type: Number, default: 0 },
    creditTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditTransaction' },

    inspectionNotes: { type: String, trim: true, maxlength: 2000 },
    attachments: [String],

    timeline: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
        _id: false,
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

rmaSchema.index({ user: 1, createdAt: -1 });
rmaSchema.index({ status: 1, createdAt: -1 });

const Rma = mongoose.model('Rma', rmaSchema);

export { RMA_STATUSES, RMA_OPEN_STATUSES, RMA_RESOLUTIONS, ITEM_DISPOSITIONS, Rma };
export default Rma;
