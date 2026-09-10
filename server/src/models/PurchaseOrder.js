import mongoose from 'mongoose';

/**
 * Stock on order from a supplier (ERP rework §6.8).
 *
 * The mirror image of `Order`: same integer cents, same recompute-server-side
 * rule, same denormalised line snapshots so a PO stays readable after the
 * catalogue moves on. The differences are that the money flows outward and
 * that receiving a line **increments** stock rather than decrementing it.
 *
 * **One PO is asked of several suppliers and confirmed to one** (re-ruled
 * 2026-09-11). This record used to name a single supplier and a price already
 * agreed, and a separate `Rfq` document did the asking. Two records described
 * one purchase, so the question "what did we pay and who did we ask" needed
 * both. The flow is now:
 *
 *   raise lines, invite suppliers   `createPurchaseOrder`  status `draft`
 *   send                            `sendPurchaseOrder`    status `sent`
 *   supplier prices it in the portal `submitBid`           a bid, + a proforma
 *   we push back                    `negotiate`            status `negotiating`
 *   pick one                        `confirmSupplier`      status `confirmed`
 *   pay, receive, restock           existing paths         `partial`/`received`
 *
 * `status` past `confirmed` is derived from receiving, not chosen: a PO is
 * `partial` while some lines are short and `received` when none are. Keeping
 * that in `purchaseService` rather than in a client means the header can never
 * claim a PO is complete while a line is still outstanding.
 */
const purchaseOrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // Snapshots, for the same reason `Order` keeps them.
    sku: String,
    name: String,

    qtyOrdered: { type: Number, required: true, min: 1 },
    qtyReceived: { type: Number, default: 0, min: 0 },

    /**
     * What Cellvix pays, integer cents. Distinct from `Product.price`, which is
     * what a client pays; the gap between them is the margin every report reads.
     *
     * **Zero until a supplier is confirmed.** A PO is now raised *to ask* what
     * a part costs, so at `draft` there is no agreed price to hold — it is
     * copied here from the winning bid by `confirmSupplier`. Required would
     * mean inventing a number nobody quoted just to save the document.
     */
    unitCost: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * One supplier's price for one requested line, keyed by SKU.
 *
 * **A quoted cost is the supplier's number, not ours.** Everywhere else in this
 * codebase a client-sent price is refused; here the whole point of the document
 * is to collect prices from outside, so a quoted `unitCost` IS the payload.
 * What is still never accepted is a *total*: every one is recomputed from these
 * lines against **our** `qtyOrdered`, never a quantity the supplier sent.
 */
const bidLineSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    // Integer cents. Zero is a legitimate answer for a sample or a freebie;
    // "cannot supply" is `available: false`, which is a different fact and must
    // not be encoded as a price of zero.
    unitCost: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

/**
 * One round of pushing back on a supplier's price.
 *
 * Append-only: a negotiation is a conversation, and overwriting the previous
 * ask would destroy the only record of what was agreed from what. The
 * supplier's answer lands as a fresh bid — `theirCounter` snapshots the total
 * they came back with so a round reads as a pair without re-deriving it.
 *
 * `channels` records where the ask actually went, not where we intended it to
 * go: email always, plus whatever the supplier has consented to. A round that
 * says it was WhatsApped when the provider was unconfigured is a lie an
 * operator would act on.
 */
const negotiationSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true, min: 1 },
    // What we asked for, integer cents. A target for the whole order; a
    // per-line ask is `askedLines`.
    askedTotal: { type: Number, min: 0 },
    askedLines: [{ sku: String, unitCost: Number, _id: false }],
    theirCounter: { type: Number, min: 0 },
    note: { type: String, trim: true, maxlength: 2000 },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    channels: { type: [String], default: [] }, // 'email' | 'sms' | 'whatsapp'
    respondedAt: Date,
  },
  { _id: true },
);

/**
 * A proforma invoice — the supplier's formal offer against this PO (§6.8b).
 *
 * Rendered by `proformaDocument.js` from these fields, never uploaded: a form
 * the server totals is a document whose arithmetic we can trust, and it needs
 * no file-storage path to exist.
 *
 * **Revisions supersede, they never overwrite.** A negotiation produces a
 * second PI, and the number that was negotiated away has to stay readable or
 * "what did they originally ask" becomes unanswerable. `revision` counts up
 * and `history` keeps the supplied ones.
 */
const proformaSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true }, // the supplier's own reference
    revision: { type: Number, default: 1, min: 1 },
    issuedAt: { type: Date, default: Date.now },
    validUntil: Date,

    // All integer cents, all recomputed server-side from the bid lines.
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // How they want paying. Free text by design — a supplier abroad banks in
    // ways a Canadian field set would refuse to hold.
    paymentTerms: { type: String, trim: true, maxlength: 300 },
    bankDetails: { type: String, trim: true, maxlength: 1000 },
    note: { type: String, trim: true, maxlength: 2000 },

    /** Superseded revisions, oldest first. */
    history: [
      {
        revision: Number,
        total: Number,
        issuedAt: Date,
        supersededAt: Date,
        _id: false,
      },
    ],

    /** Set when we accept this PI as the basis for confirming the supplier. */
    acceptedAt: Date,
  },
  { _id: false },
);

const BID_STATUSES = [
  'invited',
  'viewed',
  'quoted',
  'negotiating',
  'confirmed',
  'declined',
  'lost',
];

/** What a confirmed supplier reports about getting the goods to us. */
const DELIVERY_STATUSES = ['pending', 'preparing', 'dispatched', 'in_transit', 'delivered'];

/**
 * One supplier's side of this purchase order.
 *
 * `status` is mostly a fact about what the supplier did, not a stage we chose:
 * `viewed` when they open it, `quoted` when they price it, `declined` when they
 * say no. Only `confirmed` and `lost` come from our end, and both are written
 * by the same confirmation — so a PO can never have two confirmed suppliers or
 * a winner without losers.
 */
const purchaseOrderBidSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    // Snapshot, so a comparison table still names the supplier after a rename.
    supplierName: String,

    status: { type: String, enum: BID_STATUSES, default: 'invited' },

    sentAt: Date,
    viewedAt: Date,
    quotedAt: Date,

    lines: [bidLineSchema],

    // Integer cents, all recomputed server-side from `lines` on every submit.
    // `shipping` is the supplier's own number; quoting freight separately is
    // how a cheap unit price with expensive delivery stops looking like the
    // best offer.
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // What they promise, in days from quoting. Their commitment, not a date we
    // set — a lead time is half of what a purchasing decision weighs.
    leadTimeDays: { type: Number, min: 0 },
    validUntil: Date,

    proforma: proformaSchema,
    negotiations: [negotiationSchema],

    /** Only ever set on the confirmed bid. */
    delivery: {
      status: { type: String, enum: DELIVERY_STATUSES, default: 'pending' },
      carrier: { type: String, trim: true },
      trackingNumber: { type: String, trim: true },
      dispatchedAt: Date,
      expectedAt: Date,
      deliveredAt: Date,
      note: { type: String, trim: true, maxlength: 1000 },
    },

    note: { type: String, trim: true, maxlength: 2000 },
    declineReason: { type: String, trim: true, maxlength: 500 },
  },
  { _id: true },
);

const PO_STATUSES = [
  'draft',
  'sent',
  'negotiating',
  'confirmed',
  'partial',
  'received',
  'cancelled',
];

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, index: true }, // PO-2026-00001

    /**
     * **The confirmed supplier** — who this order was actually placed with.
     *
     * No longer required, and that is the whole shape of the change: a PO is
     * raised to ask several suppliers what they charge, so between `draft` and
     * `confirmed` there is genuinely nobody it is with yet. `confirmSupplier`
     * writes it.
     *
     * Kept as this field rather than a new `confirmedSupplier` because roughly
     * fifteen call sites already read it — `refreshSupplierTotals`, the expense
     * a payment writes, the spend-per-supplier aggregation, the inventory
     * price history, every populate. Narrowing its *meaning* costs nothing;
     * renaming it would have meant editing all of them to say the same thing.
     */
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      index: true,
    },

    /** Every supplier this order was put to, with their price. */
    bids: [purchaseOrderBidSchema],

    /** The confirmed bid's `_id`, so the winning row is found without a scan. */
    confirmedBid: { type: mongoose.Schema.Types.ObjectId, default: null },
    confirmedAt: Date,

    /**
     * Which component types this order was put out on — `Product.partType`
     * slugs, matched against `Supplier.componentTypes` to suggest who to ask.
     *
     * Stored rather than derived from the lines, because it is what the
     * suppliers were *chosen by*. A clerk who asks the battery suppliers and
     * then adds a screen line has still asked the battery suppliers, and a list
     * recomputed from the items would rewrite that history.
     */
    componentTypes: { type: [String], default: [], index: true },

    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },

    status: { type: String, enum: PO_STATUSES, default: 'draft', index: true },

    /** When answers are due. Honoured on read, never by a nightly job. */
    closesAt: Date,

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
// The supplier portal's dashboard: every order this supplier was asked to price.
purchaseOrderSchema.index({ 'bids.supplier': 1, createdAt: -1 });

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export {
  BID_STATUSES,
  DELIVERY_STATUSES,
  PO_STATUSES,
  PurchaseOrder,
};
export default PurchaseOrder;
