import mongoose from 'mongoose';

/**
 * One operating business (SAAS_PLATFORM §1.1, re-ruled 2026-09-11).
 *
 * **This was `Outlet`.** An outlet was a physical shop inside one business; a
 * business is the thing that owns records and carries a type. The rename is the
 * whole of the change for existing data — every record that carried `outlet`
 * now carries `business`, and the scoping middleware that filtered by outlet
 * filters by business.
 *
 * ## The isolation this does NOT have, stated plainly
 *
 * §4.1 specifies **database-per-business** and rejects separating businesses by
 * a filter inside one database by name: a `Model.find({ status })` that forgets
 * its filter silently serves another business's customers, invoices and
 * margins. That ruling was reversed on 2026-09-11 in favour of shipping —
 * businesses are rows here and every scoped query carries a `business` filter.
 *
 * The consequence is real and belongs next to the model it applies to: **a
 * query that forgets `businessFilter(req)` is a cross-business leak, not a
 * cosmetic bug.** `middleware/businessScope.js` is the one place that decides
 * scope, and anything reading records for a screen must spread its filter.
 *
 * ## Type
 *
 * `businessType` decides which sections exist and what they are called (§1.1).
 * It sets **defaults, not walls** — a super admin may switch any individual
 * feature on afterwards through `featureOverrides`, and the enforcement path is
 * the same single `requireFeature` 404 either way. A product business that
 * starts doing repairs turns `sales.tickets` on; it is not migrated to a
 * different type.
 */

/**
 * Colour identity comes from a fixed token-derived palette, never arbitrary
 * hex: a colour typed into a form is how a page ends up off-brand (§2b). The
 * list is deliberately short — these read as distinct at the size a card
 * border actually renders.
 */
const BUSINESS_COLOR_TOKENS = ['brand', 'info', 'success', 'warn', 'danger', 'ink'];

const BUSINESS_STATUSES = ['active', 'inactive', 'maintenance'];

/** The three shapes the product optimises for (§1.1). */
const BUSINESS_TYPES = ['product', 'service', 'both'];

const hoursSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      required: true,
    },
    // Stored as "09:00" / "17:30", not Dates: these are wall-clock opening
    // hours, not instants, and a Date here would drag a timezone into a field
    // that has no business carrying one.
    open: String,
    close: String,
    closed: { type: Boolean, default: false },
  },
  { _id: false },
);

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // The zero-padded `#000001` form the switcher shows. Assigned server-side
    // by `nextBusinessCode` — a code the client proposes is a code two
    // operators can pick at the same moment.
    code: { type: String, required: true, unique: true, index: true },

    /**
     * What shape of business this is. Decides the feature defaults, and through
     * them which sections the panel renders (§1.1).
     *
     * Indexed because the feature resolver reads it on every request that
     * carries a business scope.
     */
    businessType: {
      type: String,
      enum: BUSINESS_TYPES,
      default: 'product',
      required: true,
      index: true,
    },

    status: { type: String, enum: BUSINESS_STATUSES, default: 'active', index: true },
    colorToken: { type: String, enum: BUSINESS_COLOR_TOKENS, default: 'brand' },

    address: {
      street: String,
      line2: String,
      city: String,
      // Canadian conventions throughout — the province list and the A1A 1A1
      // rule are validated by the shared schema, not re-stated here.
      region: String,
      postal: String,
      country: { type: String, default: 'Canada' },
    },

    phone: String,
    email: { type: String, lowercase: true, trim: true },

    // Free text, not a ref: the manager is often named before they have a
    // login, and blocking creation on user creation is backwards.
    manager: String,

    // Staff assigned here. The authoritative link is `User.business` — this is
    // the reverse index, kept for the card's roster and repaired by
    // `accessService` whenever a user's assignment moves.
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    hours: [hoursSchema],

    // Exactly one business is the default, enforced in `accessService`. It is
    // where a movement lands when nothing names one, so the field cannot be
    // allowed to go empty.
    isDefault: { type: Boolean, default: false },

    /**
     * Which tenant owns this business (§1). Optional until the control plane
     * exists — a business with no tenant is tenant #1's, which is every
     * business today.
     */
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

    /**
     * Per-business feature switches, written **only** by a super admin (§3.3).
     *
     * `{ 'sales.tickets': true }` — a sparse map of deliberate answers, not a
     * full set. Anything absent falls back to the business type's default, so
     * this document never has to be rewritten when a new feature key is added.
     *
     * A `locked` key here is ignored: `resolveFeatures` forces those on
     * whatever any layer says (§3.2 rule 4).
     */
    featureOverrides: {
      type: Map,
      of: Boolean,
      default: () => new Map(),
    },

    /** The plan this business is on. Sets feature defaults beneath overrides. */
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },

    /** When a slot was spent to create this. Null for businesses that predate slots. */
    slotGrantedAt: Date,

    notes: String,
  },
  { timestamps: true },
);

businessSchema.index({ status: 1, name: 1 });

businessSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    code: this.code,
    businessType: this.businessType,
    status: this.status,
    colorToken: this.colorToken,
    address: this.address,
    phone: this.phone,
    email: this.email,
    manager: this.manager,
    staff: this.staff,
    hours: this.hours,
    isDefault: this.isDefault,
    tenant: this.tenant?.toString() ?? null,
    // A plain object, because a Map does not survive `res.json` as one.
    featureOverrides: Object.fromEntries(this.featureOverrides ?? []),
    plan: this.plan?.toString() ?? null,
    notes: this.notes,
    createdAt: this.createdAt,
  };
};

const Business = mongoose.model('Business', businessSchema);

export { BUSINESS_COLOR_TOKENS, BUSINESS_STATUSES, BUSINESS_TYPES, Business };
export default Business;
