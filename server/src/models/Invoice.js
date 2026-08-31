const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true }, // INV-2026-00042
    /**
     * Optional, and the only reason it is: an invoice raised by hand (§7.2) has
     * no order behind it — a restocking fee, a repair, an agreed adjustment.
     * Every invoice an order raises still sets it.
     */
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

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

const Invoice = mongoose.model('Invoice', invoiceSchema);

// --- CommonJS exports -------------------------------------------------
exports.Invoice = Invoice;
exports.default = Invoice;
