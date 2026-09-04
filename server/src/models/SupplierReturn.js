import mongoose from 'mongoose';

/**
 * Stock going **back to a supplier** — the purchase-side counterpart of `Rma`.
 *
 * The two are deliberately separate collections rather than one `Return` with a
 * direction flag. They share a word and nothing else: a customer RMA refunds a
 * customer to store credit and puts stock *on* the shelf, while this one claims
 * money *from* a supplier and takes stock off it. Merging them would mean every
 * query, every status ladder and every money path carrying an `if` about which
 * direction it was — and `Rma.items.disposition` already names
 * `return_to_supplier` with nowhere to send it, which is the gap this fills.
 *
 * **Two invariants carry over unchanged:**
 *
 *   - Stock moves only through `purchaseService.applyStockMovement`. Shipping a
 *     return decrements the shelf, and that decrement has a `StockMovement`
 *     behind it like every other.
 *   - The credit a supplier gives back is recorded, never invented. `creditAmount`
 *     is what they actually agreed to, entered when they agree it — not a
 *     projection from the line values, which is what `expectedCredit` is for.
 */

const SUPPLIER_RETURN_STATUSES = [
  'draft', // being written up; nothing has moved
  'requested', // RMA number asked of the supplier
  'authorised', // supplier agreed to take it back
  'shipped', // parts have left — stock has moved
  'credited', // supplier issued the credit
  'rejected', // supplier refused the claim
];

/** Everything before a terminal rung is open, and ages against the SLA. */
const SUPPLIER_RETURN_OPEN_STATUSES = SUPPLIER_RETURN_STATUSES.filter(
  (status) => !['credited', 'rejected'].includes(status),
);

/** Why the stock is going back. Drives nothing but reporting — and that is enough. */
const SUPPLIER_RETURN_REASONS = [
  'faulty',
  'wrong_item',
  'over_shipped',
  'damaged_in_transit',
  'not_as_described',
  'other',
];

const supplierReturnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // Denormalised so the return stays readable if the catalogue changes later,
    // exactly as an order line is.
    sku: String,
    name: String,

    qty: { type: Number, required: true, min: 1 },

    /**
     * What Cellvix paid for this line, snapshotted from the purchase order.
     *
     * A supplier credits what was paid, not what the part is now worth or what
     * it would be sold for — reading a live cost here would quietly change the
     * expected credit every time a supplier moved their price.
     */
    unitCost: { type: Number, default: 0 },

    reason: { type: String, enum: SUPPLIER_RETURN_REASONS, default: 'faulty' },
    note: { type: String, trim: true, maxlength: 300 },

    // Set once this line's stock has actually left the shelf, so a second save
    // cannot decrement it twice.
    shippedAt: Date,
  },
  { _id: false },
);

const supplierReturnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true, index: true }, // SRT-2026-00001

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    supplierName: String,

    // The purchase order the stock arrived on, when it is known. Optional: a
    // fault can surface long after the paperwork, and refusing to record the
    // return because nobody can find the PO helps nobody.
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    purchaseOrderNumber: String,

    status: { type: String, enum: SUPPLIER_RETURN_STATUSES, default: 'draft', index: true },

    items: [supplierReturnItemSchema],

    reason: { type: String, trim: true, maxlength: 500 },

    // What the supplier calls this return on their side. Theirs, not ours —
    // it is the number to quote on the phone.
    supplierRmaNumber: { type: String, trim: true, maxlength: 60 },

    /**
     * Integer cents.
     *
     * `expectedCredit` is the sum of the lines, computed when the return is
     * written up. `creditAmount` is what the supplier actually gave, entered
     * when they give it. They are kept apart because the difference between
     * them is the whole point of chasing a claim — a supplier who credits
     * $400 against a $600 return is a fact somebody needs to see.
     */
    expectedCredit: { type: Number, default: 0 },
    creditAmount: { type: Number, default: 0 },

    // The credit note the supplier issued, so the claim can be reconciled
    // against their paperwork.
    creditReference: { type: String, trim: true, maxlength: 80 },
    creditedAt: Date,

    carrier: { type: String, trim: true, maxlength: 60 },
    trackingNumber: { type: String, trim: true, maxlength: 60 },

    notes: { type: String, trim: true, maxlength: 2000 },

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

supplierReturnSchema.index({ supplier: 1, createdAt: -1 });
supplierReturnSchema.index({ status: 1, createdAt: -1 });

const SupplierReturn = mongoose.model('SupplierReturn', supplierReturnSchema);

export { SUPPLIER_RETURN_STATUSES, SUPPLIER_RETURN_OPEN_STATUSES, SUPPLIER_RETURN_REASONS, SupplierReturn };
export default SupplierReturn;
