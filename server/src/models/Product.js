const mongoose = require('mongoose');

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
    //
    // Everything in this block is admin-only. `productService.serialize` is an
    // allowlist rather than a blocklist, so a field added here cannot reach a
    // public payload by being forgotten — but the storefront rule is worth
    // restating where the fields live: in stock / out of stock, never a count,
    // never a reorder point, never a cost (ERP rework §6.10).
    stock: { type: Number, default: 0, index: true },

    // The reorder point the Inventory screen compares `stock` against. Zero
    // means "no point set", which reads as never low rather than always low.
    minStock: { type: Number, default: 0 },

    // What Cellvix pays for the part, integer cents. Distinct from `price`,
    // which is what a client pays. Margin in every report is the gap between
    // the two, and an order line snapshots this at order time (§9.4) so a later
    // cost change cannot rewrite the margin on a sale that already happened.
    cost: { type: Number, default: 0 },

    // Bin or shelf, free text — 'A-12-3'. One outlet today (§0.9).
    location: { type: String, trim: true, maxlength: 40 },

    // The default supplier for a reorder. A purchase-order line may still name
    // a different one; this is the suggestion, not a constraint.
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true },

    barcode: { type: String, trim: true, maxlength: 60, index: true },

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

const Product = mongoose.model('Product', productSchema);

// --- CommonJS exports -------------------------------------------------
exports.Product = Product;
exports.default = Product;
