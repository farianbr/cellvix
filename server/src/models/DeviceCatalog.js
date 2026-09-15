import mongoose from 'mongoose';

/**
 * The devices a service business **takes in** (Sales § Ticket, § Quote).
 *
 * ## Why this is not `Taxonomy`
 *
 * They are the same shape and a different thing, and the shape is the trap.
 *
 * `Taxonomy` is the **catalogue's** tree. Every read of it counts products:
 * `taxonomyService.buildTree` aggregates `Product` to decide what is live and
 * **prunes any branch that counts zero**, which is correct for a storefront
 * filter - a filter that opens an empty grid is a dead end. A repair shop
 * stocks no parts for most of what comes through its door, so under that rule
 * its entire device list would prune itself away. Seeding `Taxonomy` with
 * repairable devices would not fix it: the nodes would exist and the tree would
 * still return nothing, because nothing is for sale under them.
 *
 * The coupling runs deeper than counts. `Taxonomy` carries `productCount`,
 * `isFeatured` (surfaces in the storefront mega menu) and is pruned to a
 * `partType` facet so the parts wizard cannot offer a combination returning no
 * SKUs. None of that means anything for a device somebody hands across a
 * counter.
 *
 * And the two lists genuinely differ. Cellvix's catalogue is smartphone-only,
 * because that is what it has photography for - a rule that exists to stop the
 * storefront drawing a blank card, and which has nothing to say about whether a
 * shop can fix a laptop. CellShoppe takes in laptops, tablets, consoles and
 * watches, most of which Cellvix will never list a part for.
 *
 * ## What is shared
 *
 * The **shape**, deliberately: `deviceType -> brand -> series -> model`, the
 * same four kinds, the same denormalised `path`, the same aliases. A technician
 * and a parts buyer describe a handset identically, and a business running as
 * `both` should not have to maintain two spellings of "iPhone 15 Pro Max".
 * Keeping the shapes identical is what makes a future merge a data migration
 * rather than a rewrite.
 *
 * ## What it is NOT
 *
 * Not a price list. `Service` is what the shop charges for; this is only what
 * the work is done *to*. A model here says nothing about what can be repaired
 * on it, which is why `Service.deviceTypes` is a hint and never a restriction.
 */

/** The same four levels the catalogue tree uses. */
const DEVICE_KINDS = ['deviceType', 'brand', 'series', 'model'];

const deviceCatalogSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: DEVICE_KINDS, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, index: true },

    /**
     * The shop this tree belongs to.
     *
     * Every business keeps its own list: a phone shop and a laptop specialist
     * take in different hardware, and a picker offering devices nobody here
     * repairs is a picker that slows the counter down.
     */
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null, index: true },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceCatalog',
      default: null,
      index: true,
    },

    // Denormalised ancestor slugs, so a ticket query never needs a graph lookup.
    // Same four keys `Taxonomy.path` uses.
    path: {
      deviceType: String,
      brand: String,
      series: String,
      model: String,
    },

    /** A lucide icon name, for the kiosk's option cards. */
    icon: String,
    order: { type: Number, default: 0 },

    /**
     * What else this device is called.
     *
     * Serves the counter rather than a search engine: somebody reads "SM-S911B"
     * off the back of a handset, or a customer says "the S23", and the picker
     * has to find the same node from either. Stored lowercase and trimmed.
     */
    aliases: { type: [String], default: [] },

    /**
     * Retired devices stop appearing in the pickers and stay on old tickets.
     *
     * A shop that stops taking in a fifteen-year-old model needs it gone from
     * the dropdown without erasing the twenty repairs it did on one.
     */
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

/**
 * Unique per business, not globally. Two shops both take in "iPhone 15", and
 * under database-per-business they are rows in different databases anyway - the
 * index makes the duplicate impossible within one shop, which is the case that
 * actually confuses a staff member.
 */
deviceCatalogSchema.index({ business: 1, slug: 1 }, { unique: true });
deviceCatalogSchema.index({ kind: 1, parent: 1, order: 1 });
deviceCatalogSchema.index({ aliases: 1 });

const DeviceCatalog = mongoose.model('DeviceCatalog', deviceCatalogSchema);

export { DEVICE_KINDS, DeviceCatalog };
export default DeviceCatalog;
