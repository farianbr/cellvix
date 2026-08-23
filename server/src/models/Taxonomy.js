import mongoose from 'mongoose';

/**
 * The single category tree. One self-referencing collection feeds all three
 * filter systems — sidebar, mega menu and tab wizard — so they cannot drift.
 *
 *   deviceType (Phone) -> brand (Samsung) -> series (S-Series) -> model (S23 Ultra)
 */
const taxonomySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['deviceType', 'brand', 'series', 'model'],
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Taxonomy', default: null, index: true },

    // Denormalised ancestor slugs so a product query never needs a graph lookup.
    path: {
      deviceType: String,
      brand: String,
      series: String,
      model: String,
    },

    icon: String, // lucide icon name, used by the wizard's option cards
    image: String,
    order: { type: Number, default: 0 },
    productCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false }, // surfaces in the mega menu
  },
  { timestamps: true },
);

taxonomySchema.index({ kind: 1, parent: 1, order: 1 });

export const Taxonomy = mongoose.model('Taxonomy', taxonomySchema);
export default Taxonomy;
