import mongoose from 'mongoose';

/**
 * A running promotion. Two kinds:
 *   deal  — a discount over a slice of the catalogue, described by `target`
 *   combo — a fixed list of SKUs sold together at `bundlePrice`
 *
 * Whether an offer is live is DERIVED from `startsAt`/`endsAt` at read time,
 * never stored: a stored flag would need a cron job to stay honest
 * (PROJECT_INSTRUCTIONS.md §5.6).
 */
const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    subtitle: String,
    description: String,
    terms: String,

    kind: { type: String, enum: ['deal', 'combo'], default: 'deal', index: true },
    badge: String,
    accent: { type: String, enum: ['brand', 'ok', 'info', 'warn'], default: 'brand' },
    code: String,

    discountType: {
      type: String,
      enum: ['percent', 'amount', 'free-shipping'],
      default: 'percent',
    },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 }, // integer cents
    minQty: { type: Number, default: 0 },
    minSpend: { type: Number, default: 0 }, // integer cents

    target: {
      deviceTypeSlug: { type: String, default: '' },
      brandSlug: { type: String, default: '' },
      partType: { type: String, default: '' },
      grade: { type: String, default: '' },
    },

    items: [
      {
        sku: { type: String, required: true },
        qty: { type: Number, default: 1 },
      },
    ],
    bundlePrice: { type: Number, default: 0 }, // integer cents

    // --- who may redeem it, and how often ---------------------------------
    // `single` means once per account, ever. Enforced against order history
    // rather than a counter, so it cannot drift out of step with what was
    // actually bought (pricingService.assertRedeemable).
    redemption: { type: String, enum: ['multi', 'single'], default: 'multi' },
    // Total redemptions across all accounts. 0 = unlimited.
    usageLimit: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },

    eligibility: { type: String, enum: ['all', 'accounts'], default: 'all' },
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    startsAt: Date,
    endsAt: { type: Date, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

offerSchema.index({ isActive: 1, order: 1, createdAt: -1 });

const Offer = mongoose.model('Offer', offerSchema);

export { Offer };
export default Offer;
