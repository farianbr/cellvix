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
      // A country name ('Canada'), as `User.address` and `Outlet.address` hold
      // it. This was the 2-letter code until 2026-09-05; the five rows that
      // predated the change were backfilled.
      country: { type: String, default: 'Canada' },
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

    /**
     * What this supplier agreed to be contacted on — the same four channels,
     * and the same shape, as `User.contactConsent` (CASL, §6.13).
     *
     * A supplier is a business contact, not a customer, and CASL's implied
     * consent for an existing business relationship covers most of what a
     * buyer sends them. It is recorded anyway, for the reason the customer-side
     * comment gives: an implied basis nobody wrote down is one nobody can
     * defend. It also stops a purchasing clerk WhatsApping a supplier who
     * asked to be emailed only.
     *
     * `undefined` is not `false`. A supplier row that predates this field has
     * never been asked, which is a different fact from having declined, so
     * `at`/`source` being unset is what marks "not recorded".
     */
    contactConsent: {
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      call: { type: Boolean, default: false },
      at: Date,
      source: String, // 'admin' | 'application' | 'import'
    },

    /**
     * A supplier who applied through the storefront rather than being entered
     * by a buyer (§ sign-up, account type "Supplying Cellvix").
     *
     * An application is a real Supplier document from the moment it arrives, so
     * the purchasing team reviews it on the screen they already use rather than
     * in a second inbox. What keeps it out of the working set is `isActive:
     * false` on create — nothing can raise a purchase order against it, and it
     * does not appear in the supplier picker, until somebody activates it.
     *
     * `appliedAt` is what separates "applied and not yet reviewed" from "a
     * supplier we deactivated", which are opposite facts that would otherwise
     * both read as inactive.
     */
    appliedAt: { type: Date, index: true },
    /** What they say they supply. Free text: this is their pitch, not a taxonomy. */
    supplies: { type: String, trim: true, maxlength: 600 },

    // Caches. See the note above.
    ordersCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 }, // integer cents
  },
  { timestamps: true },
);

supplierSchema.index({ name: 'text', code: 'text', contactName: 'text' });

const Supplier = mongoose.model('Supplier', supplierSchema);

export { Supplier };
export default Supplier;
