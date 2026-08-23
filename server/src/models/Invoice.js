import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true }, // INV-2026-00042
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

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

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
