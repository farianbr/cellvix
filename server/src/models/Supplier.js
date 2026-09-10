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
      // A country name ('Canada'), as `User.address` and `Business.address` hold
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
     * Which channel this supplier actually wants to be reached on.
     *
     * **Consent and preference are different facts.** `contactConsent` says what
     * we are *allowed* to use; this says which of those they would rather we
     * did. A supplier who consents to all four and prefers WhatsApp gets one
     * message on WhatsApp, not four messages everywhere — and one who prefers a
     * channel they have not consented to is a contradiction the send path
     * resolves in consent's favour, because permission outranks preference.
     *
     * Email is never in this list: it always sends regardless, because it is
     * the record a dispute reads back.
     */
    preferredChannel: {
      type: String,
      enum: ['sms', 'whatsapp', 'call'],
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

    /**
     * Which component types this supplier is tagged with — `Product.partType`
     * slugs, the same vocabulary the storefront's step 1 offers.
     *
     * **The tag is what makes supplier bidding possible.** A purchasing clerk
     * raising a purchase order picks component types, not suppliers: "who sells
     * batteries" is the question they actually have, and asking them to
     * remember which of forty suppliers those are is how a supplier who could
     * have quoted never gets asked. It is also a column on the Suppliers table
     * and a filter above it, because a tag nobody can see is a tag nobody
     * maintains.
     *
     * Deliberately NOT a taxonomy reference. A component type cuts across the
     * device tree and has no node of its own (see `taxonomyService`), so this
     * stores the slug and `taxonomyService.getComponentTypes()` stays the one
     * place that list is derived — from the catalogue, so a tag can never name
     * a component nothing is sold under.
     */
    componentTypes: { type: [String], default: [], index: true },

    /**
     * Portal credentials (supplier process flow, §6.8a).
     *
     * A supplier signs in at `/supplier` to answer a request for quote, and
     * that login lives HERE rather than in `User`. The separation is the point:
     * `User.role` gates the buyer storefront and the admin panel, and a
     * supplier belongs to neither. A fourth role would mean every `requireAuth`
     * route in the app silently gained a population that has no cart, no
     * orders, no invoices and no credit — a supplier session must not reach
     * those routes at all, and the way to guarantee that rather than remember
     * it is for the session to carry a different cookie, which `authenticate`
     * does not read.
     *
     * `select: false` on the hash for the reason `User.passwordHash` has it: a
     * serializer that forgets to strip a field it never loaded cannot leak it.
     *
     * `portalInviteAt` is when credentials were last sent — what the admin's
     * **Resend portal link** button reports.
     */
    passwordHash: { type: String, select: false },
    portalInviteAt: Date,
    portalLastLoginAt: Date,

    /**
     * The invite / reset token, hashed. Same shape and same reasoning as
     * `User.resetTokenHash`: the mail carries the only copy of the plaintext,
     * so a stolen database cannot be used to set a supplier's password.
     *
     * `portalTokenAt` is the EXPIRY, not the issue time — checked on use, the
     * way the buyer-side reset token is.
     */
    portalTokenHash: { type: String, select: false },
    portalTokenAt: { type: Date, select: false },

    // Caches. See the note above.
    ordersCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 }, // integer cents
  },
  { timestamps: true },
);

supplierSchema.index({ name: 'text', code: 'text', contactName: 'text' });

// The supplier picker on a request for quote: active suppliers carrying one of
// the chosen component types, in name order.
supplierSchema.index({ componentTypes: 1, isActive: 1, name: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);

export { Supplier };
export default Supplier;
