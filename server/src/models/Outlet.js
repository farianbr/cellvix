import mongoose from 'mongoose';

/**
 * A physical store (ERP rework §6.14, §0.5).
 *
 * Cellvix runs **one location today** (§0.9). The model and the switcher ship
 * now; per-outlet stock does not. `StockMovement` already carries an `outlet`
 * field, so splitting stock per location later is a backfill rather than a
 * migration — which is the whole reason this exists ahead of the need.
 */

/**
 * Colour identity comes from a fixed token-derived palette, never arbitrary
 * hex: a colour typed into a form is how a page ends up off-brand (§2b). The
 * list is deliberately short — these read as distinct at the size a card
 * border actually renders.
 */
const OUTLET_COLOR_TOKENS = ['brand', 'info', 'success', 'warn', 'danger', 'ink'];

const OUTLET_STATUSES = ['active', 'inactive', 'maintenance'];

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

const outletSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // The zero-padded `#000001` form CellShoppe uses. Assigned server-side by
    // `nextOutletCode` — a code the client proposes is a code two operators
    // can pick at the same moment.
    code: { type: String, required: true, unique: true, index: true },

    status: { type: String, enum: OUTLET_STATUSES, default: 'active', index: true },
    colorToken: { type: String, enum: OUTLET_COLOR_TOKENS, default: 'brand' },

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
    // login, and blocking outlet creation on user creation is backwards.
    manager: String,

    // Staff assigned here. The authoritative link is `User.outlet` — this is
    // the reverse index, kept for the card's roster and repaired by
    // `outletService` whenever a user's assignment moves.
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    hours: [hoursSchema],

    // Exactly one outlet is the default, enforced in `outletService`. It is
    // where a movement lands when nothing names an outlet, so the field cannot
    // be allowed to go empty.
    isDefault: { type: Boolean, default: false },

    notes: String,
  },
  { timestamps: true },
);

outletSchema.index({ status: 1, name: 1 });

outletSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    code: this.code,
    status: this.status,
    colorToken: this.colorToken,
    address: this.address,
    phone: this.phone,
    email: this.email,
    manager: this.manager,
    staff: this.staff,
    hours: this.hours,
    isDefault: this.isDefault,
    notes: this.notes,
    createdAt: this.createdAt,
  };
};

const Outlet = mongoose.model('Outlet', outletSchema);

export { OUTLET_COLOR_TOKENS, OUTLET_STATUSES, Outlet };
export default Outlet;
