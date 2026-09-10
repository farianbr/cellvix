import mongoose from 'mongoose';

/**
 * A named subscription tier (SAAS_PLATFORM §1, §3.3).
 *
 * **Feature defaults, not enforcement.** A plan sits in the middle of the
 * resolution chain — business-type defaults, then plan defaults, then
 * per-business overrides — so it widens or narrows what a business starts with
 * and never decides what it may do at runtime. `requireFeature` is the only
 * thing that refuses a request, and it reads the resolved set.
 *
 * `featureDefaults` is sparse on purpose: a plan states only the keys it has an
 * opinion about, and everything absent falls through to the business type. That
 * means adding a feature key never requires rewriting every plan document.
 */

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: { type: String, trim: true, maxlength: 500 },

    /** Integer cents, per month. Zero is a real answer — an internal tier. */
    priceCents: { type: Number, default: 0, min: 0 },

    /** Businesses a tenant on this plan may run, unless a super admin grants more. */
    includedSlots: { type: Number, default: 1, min: 0 },

    /**
     * Feature keys this plan has an opinion about, as `{ 'sales.quotes': true }`.
     *
     * A `locked` key here is ignored — `resolveFeatures` forces those on
     * whatever any layer says (§3.2 rule 4), because a tenant that can switch
     * off its own audit trail is a tenant that cannot be audited.
     */
    // `Mixed`, not `Map` — feature keys are dot-namespaced and Mongoose maps
    // reject keys containing a dot. Same reasoning as `Business.featureOverrides`.
    featureDefaults: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    /** A retired plan keeps its subscribers and stops being offered. */
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

planSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    description: this.description ?? null,
    priceCents: this.priceCents,
    includedSlots: this.includedSlots,
    // A plain object: a Map does not survive `res.json` as one.
    featureDefaults: this.featureDefaults ?? {},
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

const Plan = mongoose.model('Plan', planSchema);

export { Plan };
export default Plan;
