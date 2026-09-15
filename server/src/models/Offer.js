import mongoose from 'mongoose';

/**
 * A running promotion. Two kinds:
 *   deal - a discount over a slice of the catalogue, described by `target`
 *   combo - a fixed list of SKUs sold together at `bundlePrice`
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

    // --- the exclusive deal page ------------------------------------------
    // An offer flagged `isExclusive` gets a page of its own at
    // /deals/:slug rather than a card in the offers list. Everything below
    // is for that page and is optional: a section renders only when it has
    // content, so an offer promoted to exclusive without any of it is still a
    // valid page rather than a scaffold of empty headings.
    isExclusive: { type: Boolean, default: false, index: true },

    // A hosted MP4 or an embed URL. Stored as given and rendered in an
    // aspect-ratio box; the page never guesses at dimensions.
    videoUrl: { type: String, trim: true },
    videoPoster: { type: String, trim: true },

    // The long copy under the video. Rendered through lib/richText.jsx like
    // every other admin-authored field - never dangerouslySetInnerHTML.
    pitch: { type: String, maxlength: 4000 },

    // Bullet points beside the price. Short claims, not paragraphs.
    highlights: [{ type: String, trim: true, maxlength: 140 }],

    // Buyer reviews of the deal itself. Seeded demo content today; there is no
    // review submission flow yet, so these are admin-authored and `verified`
    // means the desk confirmed the account bought it, not that a system did.
    reviews: [
      {
        _id: false,
        author: { type: String, required: true, trim: true, maxlength: 80 },
        business: { type: String, trim: true, maxlength: 120 },
        rating: { type: Number, min: 1, max: 5, required: true },
        body: { type: String, required: true, maxlength: 1200 },
        verified: { type: Boolean, default: false },
        postedAt: Date,
      },
    ],

    // Questions specific to this deal. The site-wide FAQ stays where it is;
    // these answer "what am I actually buying here".
    faqs: [
      {
        _id: false,
        question: { type: String, required: true, trim: true, maxlength: 200 },
        answer: { type: String, required: true, maxlength: 2000 },
      },
    ],

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
