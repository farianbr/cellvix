import mongoose from 'mongoose';

/**
 * A request for quote — one line list, sent to several suppliers at once
 * (supplier process flow, §6.8a).
 *
 * **This is the record that exists before a purchase order does.** A PO names
 * one supplier and a price already agreed; the question this answers is the one
 * asked before that — who will supply these parts, and for how much. Modelling
 * it as a PO with an empty supplier would break two rules `PurchaseOrder`
 * already holds (`supplier` is required, and edits stop at `draft`), so it is
 * its own document and a PO is what it *produces*.
 *
 * The flow, and what each step writes:
 *
 *   componentTypes -> invited suppliers   `createRfq`      status `draft`
 *   send                                  `sendRfq`        status `sent`, mail out
 *   supplier quotes from the portal       `submitQuote`    an invite's `quote`
 *   compare and award                     `awardRfq`       status `awarded`, PO raised
 *
 * **Costs on an invite are the supplier's number, not ours.** Everywhere else
 * in this codebase a client-sent price is refused; here the whole point of the
 * document is to collect prices from outside, so a quoted `unitCost` IS the
 * payload. What is still never accepted is a *total*: every one below is
 * recomputed from the lines, the same way `purchaseService` and `orderService`
 * recompute theirs (§8, invariant 8).
 */

/** A part being asked about. No price — that is what is being requested. */
const rfqItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshots, for the reason a PO line keeps them: the request stays
    // readable after the catalogue moves on.
    sku: String,
    name: String,
    partType: String,

    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

/** One supplier's price for one requested line, keyed by SKU. */
const quoteLineSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    // Integer cents, quoted by the supplier. Zero is a legitimate answer for a
    // sample or a freebie; "cannot supply" is `available: false`, which is a
    // different fact and must not be encoded as a price of zero.
    unitCost: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const INVITE_STATUSES = ['invited', 'viewed', 'quoted', 'declined', 'won', 'lost'];

/**
 * One supplier's side of the request.
 *
 * `status` is a fact about what the supplier did, not a stage we chose:
 * `viewed` is written when they open it, `quoted` when they price it,
 * `declined` when they say no. Only `won` and `lost` come from our end, and
 * both are written by the same award — so a request can never have two winners
 * or a winner without losers.
 */
const rfqInviteSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    // Snapshot, so a comparison table still names the supplier after a rename.
    supplierName: String,

    status: { type: String, enum: INVITE_STATUSES, default: 'invited' },

    sentAt: Date,
    viewedAt: Date,
    quotedAt: Date,

    lines: [quoteLineSchema],

    // Integer cents, all recomputed server-side from `lines` on every submit.
    // `shipping` is the supplier's own number; `total` is what the comparison
    // sorts on, and quoting freight separately is how a cheap unit price with
    // expensive delivery stops looking like the best offer.
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // What the supplier promises, in days from today. Their commitment, not a
    // date we set — a lead time is half of what a purchasing decision weighs.
    leadTimeDays: { type: Number, min: 0 },
    validUntil: Date,

    note: { type: String, trim: true, maxlength: 2000 },
    declineReason: { type: String, trim: true, maxlength: 500 },
  },
  { _id: true },
);

const RFQ_STATUSES = ['draft', 'sent', 'awarded', 'cancelled'];

const rfqSchema = new mongoose.Schema(
  {
    rfqNumber: { type: String, required: true, unique: true, index: true }, // RFQ-2026-00001
    title: { type: String, trim: true, maxlength: 200 },

    status: { type: String, enum: RFQ_STATUSES, default: 'draft', index: true },

    /**
     * The component types this request covers — `Product.partType` slugs.
     *
     * Stored rather than derived from the lines, because it is what the
     * suppliers were *chosen by*. A clerk who picks "battery" and then adds one
     * screen to the line list has still asked the battery suppliers, and a list
     * recomputed from the items would rewrite that history.
     */
    componentTypes: { type: [String], default: [], index: true },

    items: [rfqItemSchema],
    invites: [rfqInviteSchema],

    // When answers are due. Honoured on read the way `Quote.validUntil` is —
    // a closed request is one whose date has passed, not one a nightly job
    // relabelled.
    closesAt: Date,

    /** The winning invite's `_id`, and the PO it produced. */
    awardedInvite: { type: mongoose.Schema.Types.ObjectId, default: null },
    awardedSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    awardedAt: Date,

    notes: { type: String, trim: true, maxlength: 2000 },

    // Same shape as `Order.timeline` and `PurchaseOrder.timeline`, so all three
    // read as one kind of history rather than three dialects of one idea.
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

// The admin list: newest first, filtered by status.
rfqSchema.index({ status: 1, createdAt: -1 });
// The supplier portal's dashboard: every request this supplier was invited to.
rfqSchema.index({ 'invites.supplier': 1, createdAt: -1 });

const Rfq = mongoose.model('Rfq', rfqSchema);

export { INVITE_STATUSES, RFQ_STATUSES, Rfq };
export default Rfq;
