const mongoose = require('mongoose');

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

// --- CommonJS exports -------------------------------------------------
exports.Invoice = Invoice;
exports.default = Invoice;
