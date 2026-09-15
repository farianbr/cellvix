import mongoose from 'mongoose';

/**
 * A customer's review of a product they actually bought.
 *
 * ## Every review is tied to an order line
 *
 * `order` and `product` together are what make a review possible: the service
 * refuses to write one unless that user's order contains that product AND the
 * order is `delivered`. That is why there is no `verified` flag on this schema
 * the way `Offer.reviews` has one - an unverifiable review cannot exist here, so
 * a field claiming verification would be a field that is always true.
 *
 * The unique index on `{ order, product }` is what stops a buyer reviewing the
 * same line twice. Deliberately NOT `{ user, product }`: a shop that buys the
 * same screen on three orders across a year has three honest opinions to give,
 * and the second one is often the useful one.
 *
 * ## Author naming
 *
 * `authorName` and `authorBusiness` are SNAPSHOTS, taken at submission from
 * `displayNameOf(user)`. A review is a published statement made at a point in
 * time; renaming an account afterwards should not silently rewrite who said it,
 * and a join to `User` on every product page would be a query the storefront
 * does not need.
 */
const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    // Who wrote it, and the order that entitles them to. Both required: a
    // review with no order behind it is the thing this model exists to prevent.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },

    // Snapshotted at submission. See the note above on why these are not joins.
    authorName: { type: String, required: true, trim: true, maxlength: 80 },
    authorBusiness: { type: String, trim: true, maxlength: 120 },

    rating: { type: Number, min: 1, max: 5, required: true },

    // A one-line summary. Optional: a rating and a sentence is a complete
    // review, and forcing a title makes people write "Good" in a heading.
    title: { type: String, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },

    /**
     * Hidden by an admin.
     *
     * Reviews publish immediately - these are approved wholesale accounts, not
     * anonymous visitors, and a queue nobody works is worse than no queue. This
     * is the lever for the case that does go wrong: hidden rather than deleted,
     * so the desk can see what it acted on and put it back if it was a mistake.
     */
    isHidden: { type: Boolean, default: false, index: true },
    hiddenReason: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

/** One review per order line. See the note above on why not per user+product. */
reviewSchema.index({ order: 1, product: 1 }, { unique: true });

/** The product page's query: this product, visible, newest first. */
reviewSchema.index({ product: 1, isHidden: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

export { Review };
export default Review;
