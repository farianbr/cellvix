import mongoose from 'mongoose';

/**
 * A business Cellvix buys stock from.
 *
 * `ordersCount` and `totalSpent` are denormalised caches for the card grid —
 * fifteen supplier cards would otherwise mean fifteen aggregations on every
 * paint. They are recomputed by `purchaseService` whenever a purchase order
 * moves money, never written by a client, and the purchase-order collection
 * remains the truth if the two ever disagree.
 */
const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, trim: true, uppercase: true, index: true },

    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    contactName: { type: String, trim: true },
    website: { type: String, trim: true },

    address: {
      line1: String,
      line2: String,
      city: String,
      region: String, // Canadian province code
      postal: String,
      country: { type: String, default: 'CA' },
    },

    // Same vocabulary as the buyer-side line of credit, read the other way
    // round: what Cellvix owes this supplier, not what a client owes Cellvix.
    paymentTerms: {
      type: String,
      enum: ['prepaid', 'net15', 'net30', 'net60'],
      default: 'net30',
    },

    notes: { type: String, trim: true, maxlength: 2000 },
    isActive: { type: Boolean, default: true, index: true },

    // Caches. See the note above.
    ordersCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 }, // integer cents
  },
  { timestamps: true },
);

supplierSchema.index({ name: 'text', code: 'text', contactName: 'text' });

export const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;
