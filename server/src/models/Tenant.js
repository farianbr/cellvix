import mongoose from 'mongoose';

/**
 * One subscribing account (SAAS_PLATFORM §1).
 *
 * **A tenant owns businesses; it holds no business records of its own.** The
 * subscription, the billing relationship and the slot count live here; every
 * customer, invoice and order lives on a `Business`. That separation is what
 * makes "how many businesses may this account create" a question with one
 * answer, and it is why a tenant document is small.
 *
 * **A tenant is never a `User`.** Tenant admins are `User` documents inside a
 * business; this is the account those businesses belong to, written and read
 * only from the super-admin console.
 */

const TENANT_STATUSES = ['active', 'suspended', 'cancelled'];

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },

    /** URL-safe handle. Becomes the subdomain when subdomain routing lands. */
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    status: { type: String, enum: TENANT_STATUSES, default: 'active', index: true },

    /** Who to contact about the account itself — billing, renewal, suspension. */
    contactName: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },

    /**
     * How many businesses this tenant may run (§1, §4.3.1).
     *
     * Counted, not derived. A tenant may create a business only while it holds
     * an unused slot, and a **deleted business keeps its slot consumed through
     * the retention window** — returning it immediately would let a tenant
     * delete-and-recreate its way to a free business, and would also mean a
     * restore could land with no slot to hold it.
     */
    slots: { type: Number, default: 1, min: 0 },

    /** The plan every business under this tenant inherits unless overridden. */
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },

    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

tenantSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    status: this.status,
    contactName: this.contactName ?? null,
    contactEmail: this.contactEmail ?? null,
    phone: this.phone ?? null,
    slots: this.slots,
    plan: this.plan?.toString() ?? null,
    notes: this.notes ?? null,
    createdAt: this.createdAt,
  };
};

const Tenant = mongoose.model('Tenant', tenantSchema);

export { TENANT_STATUSES, Tenant };
export default Tenant;
