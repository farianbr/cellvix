import mongoose from 'mongoose';

/**
 * One priced line — a service performed or a part fitted.
 *
 * `priceCents` is the price AT THE TIME OF INVOICING, copied rather than
 * looked up: a catalogue price that moves next month must not silently rewrite
 * an invoice that has already been sent. `product` stays as the link back to
 * the row it came from, which is what lets stock move and what a reorder reads.
 */
const invoiceLineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    priceCents: { type: Number, default: 0 },
    qty: { type: Number, default: 1 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true }, // INV-2026-00042

    /**
     * What kind of document this row is.
     *
     * A tax invoice is issued only when the money is actually in — before that
     * the record is an **amount due**, which is payable and ages towards its due
     * date but is not yet an invoice anybody can file. That is why `due` exists
     * rather than an `unpaid` invoice: an invoice that might still be voided,
     * disputed or never paid is not a document to hand an accountant.
     *
     *   due      CVX-…  an order placed on terms, or a standalone charge. Payable.
     *   invoice  INV-…  settled in full. Its `status` is always `paid`.
     *   receipt  RCT-…  a store-credit movement — a top-up, a grant, a refund,
     *                   referral commission. No line items, no tax.
     *
     * A `due` record is **renumbered** into the `INV-` series the moment it
     * settles (`services/invoicePaymentService.js`), so invoice numbers stay a
     * gapless sequence of real invoices rather than a sequence with holes where
     * unpaid rows used to sit.
     */
    kind: {
      type: String,
      enum: ['due', 'invoice', 'receipt'],
      default: 'invoice',
      index: true,
    },

    /**
     * Optional, and the only reason it is: an invoice raised by hand (§7.2) has
     * no order behind it — a restocking fee, a repair, an agreed adjustment.
     * Every invoice an order raises still sets it.
     */
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /**
     * The ledger row a receipt documents. Set on `kind: 'receipt'` only, and it
     * is what makes a receipt traceable back to the money that moved — and what
     * stops a replayed movement raising a second receipt for the same cents.
     */
    creditTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditTransaction' },

    /**
     * What a standalone invoice is *for*. An invoice with an order behind it
     * needs neither — the order says what was bought — but one raised by hand
     * that says only "$240" is a document nobody can reconcile six weeks later.
     */
    reference: String,
    notes: String,

    /**
     * The work this invoice bills for, when it bills for work.
     *
     * Empty on every invoice an order raises and on a flat standalone charge —
     * those are a single figure by design, and the model comment above is still
     * true of them. A repair invoice fills it, and its `amount` is then
     * DERIVED from these lines by `invoiceTotals()` rather than typed.
     *
     * The shape mirrors `Ticket.devices` so a ticket can become an invoice
     * without translating between two ideas of the same object.
     */
    devices: [
      {
        category: String,
        brand: String,
        series: String,
        model: String,
        serial: String,
        problem: String,
        solution: String,
        notes: String,
        services: [invoiceLineSchema],
        parts: [invoiceLineSchema],
        _id: false,
      },
    ],

    /**
     * The tax actually applied, stored as the rate AND the cents.
     *
     * Both, because a rate alone cannot reproduce an old invoice after the
     * province's rate changes, and cents alone cannot explain themselves. A
     * document has to still be readable in five years.
     */
    province: String,
    taxPercent: { type: Number, default: 0 },
    taxCents: { type: Number, default: 0 },
    subtotalCents: { type: Number, default: 0 },
    discountCents: { type: Number, default: 0 },
    discountCode: String,

    /**
     * Kilometres driven, and whether the out-of-area fee was charged.
     *
     * `travelKm` is internal mileage — recorded for the business, never added
     * to what the customer owes. The extended service fee is the opposite: a
     * real charge, so it lands in the subtotal like any other line.
     */
    travelKm: { type: Number, default: 0 },
    extendedServiceFee: { type: Boolean, default: false },

    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    serviceType: {
      type: String,
      enum: ['walk_in', 'pickup', 'onsite', 'mail_in'],
      default: 'walk_in',
    },

    /** `internalNotes` is the only one that never reaches the document. */
    customerNotes: String,
    technicianNotes: String,
    internalNotes: String,

    amount: { type: Number, required: true }, // cents
    amountPaid: { type: Number, default: 0 },

    issuedAt: { type: Date, default: Date.now },
    dueDate: Date,
    /** When the balance reached zero, and the `due` record became an invoice. */
    settledAt: Date,
    terms: { type: String, enum: ['prepaid', 'net15', 'net30', 'net60'], default: 'prepaid' },

    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overdue'],
      default: 'unpaid',
      index: true,
    },

    payments: [
      {
        amount: Number,
        at: { type: Date, default: Date.now },
        method: String,
        reference: String,
        // Set on the ORIGINAL row when it is reversed, so the UI can strike it
        // through without pairing rows up by amount and guessing which
        // reversal belongs to which payment. The reversal itself is a separate
        // row carrying the negative amount.
        reversedAt: Date,
        _id: false,
      },
    ],
  },
  { timestamps: true },
);

invoiceSchema.index({ user: 1, issuedAt: -1 });
// The customer invoice screen reads these two lists separately — what is still
// payable, and what has been invoiced — so the split is indexed rather than
// filtered in memory.
invoiceSchema.index({ user: 1, kind: 1, issuedAt: -1 });
// A receipt is raised at most once per ledger row. Sparse because only receipts
// carry the field at all.
invoiceSchema.index({ creditTransaction: 1 }, { sparse: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

export { Invoice };
export default Invoice;
