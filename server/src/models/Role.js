import mongoose from 'mongoose';

/**
 * A named permission set (ERP rework §7.6).
 *
 * The first draft of the plan stored a permission map on each user. This is the
 * corrected model: the operator assigns a **job title**, and the title carries
 * the map. Editing one role updates everyone holding it, which is what an
 * operator expects when they change what "Warehouse" is allowed to do.
 *
 * Access is per **area** — the top-level nav groups — not per page. A per-page
 * matrix would be twenty rows nobody maintains correctly, and a permission
 * system nobody maintains is one that gets set to full access and forgotten.
 */

/** The areas a role can be granted. These are the sidebar's top-level groups. */
export const PERMISSION_AREAS = [
  'clients',
  'sales',
  'purchase',
  'reports',
  'marketing',
  'outlet',
  'settings',
];

/** Ordered weakest to strongest — `LEVELS.indexOf` is the comparison. */
export const PERMISSION_LEVELS = ['none', 'view', 'full'];

const areaField = {
  type: String,
  enum: PERMISSION_LEVELS,
  default: 'none',
};

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },

    // Seeded with the product rather than created by the operator. A built-in
    // may be edited (except the system one) but never deleted — deleting one
    // would orphan every staff member holding it.
    isBuiltIn: { type: Boolean, default: false },

    // The Admin role. Never editable, never deletable, and `admin` accounts
    // bypass the role system entirely regardless of what this row says — it
    // exists so the Roles & Access screen has something honest to render.
    isSystem: { type: Boolean, default: false },

    areas: {
      clients: areaField,
      sales: areaField,
      purchase: areaField,
      reports: areaField,
      marketing: areaField,
      outlet: areaField,
      settings: areaField,
    },
  },
  { timestamps: true },
);

roleSchema.index({ isBuiltIn: -1, name: 1 });

/**
 * Does this role clear `level` on `area`?
 *
 * An unknown area answers **no**. A new nav group that nobody has granted yet
 * should be closed until an admin opens it, not open because the map has no
 * opinion about it.
 */
roleSchema.methods.allows = function allows(area, level = 'view') {
  const held = this.areas?.[area] ?? 'none';
  return PERMISSION_LEVELS.indexOf(held) >= PERMISSION_LEVELS.indexOf(level);
};

roleSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    isBuiltIn: this.isBuiltIn,
    isSystem: this.isSystem,
    areas: PERMISSION_AREAS.reduce(
      (out, area) => ({ ...out, [area]: this.areas?.[area] ?? 'none' }),
      {},
    ),
  };
};

export const Role = mongoose.model('Role', roleSchema);
export default Role;
