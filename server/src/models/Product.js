import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: String,

    image: String,
    images: [String],

    partType: { type: String, required: true, index: true }, // screen | battery | charging-port | ...
    partTypeLabel: String,
    grade: {
      type: String,
      enum: ['NEW', 'OEM', 'PULL-A', 'PULL-B', 'AFTERMARKET'],
      required: true,
      index: true,
    },

    // Integer cents. Never a float.
    price: { type: Number, required: true },
    compareAtPrice: Number,

    // Benchmark prices for the same part at named rival wholesalers, in integer
    // cents like every other money field. Placeholder data for now — seeded,
    // not scraped — but it leaves through the SAME price gate as `price` does:
    // a buyer who may not see our number may not see the market's either,
    // because the two together ARE the trade position being gated.
    competitors: [
      {
        _id: false,
        name: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],

    // Operations data. Surfaced to admins; the storefront only ever learns
    // whether this is greater than zero (see productService.serialize).
    stock: { type: Number, default: 0, index: true },

    // Denormalised taxonomy slugs: the filter query hits these directly.
    deviceTypeSlug: { type: String, index: true },
    brandSlug: { type: String, index: true },
    seriesSlug: { type: String, index: true },
    modelSlug: { type: String, index: true },
    deviceTypeName: String,
    brandName: String,
    seriesName: String,
    modelName: String,

    specs: { type: Map, of: String, default: {} },
    searchTerms: [String],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// The exact shape of a filtered grid query.
productSchema.index({
  deviceTypeSlug: 1,
  brandSlug: 1,
  seriesSlug: 1,
  modelSlug: 1,
  partType: 1,
  grade: 1,
});

// Backs the header's live type-ahead.
productSchema.index({ name: 'text', sku: 'text', searchTerms: 'text' });

export const Product = mongoose.model('Product', productSchema);
export default Product;
