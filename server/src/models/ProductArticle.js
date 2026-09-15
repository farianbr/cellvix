import mongoose from 'mongoose';

import { authorModelShape } from '../../../shared/author.js';

/**
 * A long-form article attached to ONE product, authored in the admin panel
 * under SEO and rendered on that product's detail page.
 *
 * WHY A SEPARATE COLLECTION rather than a field on `Product`. A product
 * document is read on every grid query, every facet count and every cart and
 * order line; an article body is several kilobytes of prose that none of those
 * paths want. Kept here, the catalogue query is unchanged and the body is
 * fetched exactly once, on the one page that renders it.
 *
 * It also means a draft can exist against a product without touching the
 * product record, so writing an article is never a write to inventory data.
 *
 * ONE PER PRODUCT, enforced by the unique index on `product`. The alternative -
 * a reusable article attached to many products - was considered and rejected:
 * the point of this section is copy that speaks about a specific part, and a
 * shared article cannot name the part it is on without lying on the others.
 */
const productArticleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },

    // The heading the section carries on the storefront. Separate from the
    // product name: "How to tell an OEM screen from a copy" is the reason
    // somebody reads this, and repeating the part name there would waste the
    // one line that has to earn the scroll.
    heading: { type: String, required: true, trim: true, maxlength: 140 },

    /**
     * Plain text in the tiny markup vocabulary `lib/richText.jsx` understands -
     * the same one the blog and FAQ use. NEVER HTML: storing HTML would mean
     * trusting it at render time, and the project forbids
     * `dangerouslySetInnerHTML` anywhere (Instructions §8).
     */
    body: { type: String, required: true },

    /**
     * Who wrote it. The same shape a blog post carries (`shared/author.js`), so
     * the storefront can draw one author rail for both.
     *
     * NOT required, unlike the blog's. Every product article predates this
     * field - `seed:articles` writes 773 of them with no byline - and making it
     * required would have made every one of those documents unsaveable. The
     * rail renders the section only when there is a name, and the page falls
     * back to the parts-desk line it carried before.
     */
    author: { ...authorModelShape(), name: { type: String, trim: true, maxlength: 80 } },

    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date },

    // NO `business` field, and that is deliberate. Isolation here comes from
    // the connection: `db()` resolves the per-business database and every model
    // is bound to it, so an article written under one business is physically in
    // a different database from another's. `BlogPost` and `Faq` - the two models
    // this one sits beside in the SEO section - carry no such field either, and
    // adding one would imply a filter that nothing applies.

    // Derived on save from the body's word count - never authored, so it cannot
    // drift from the text it describes. Same rule, and the same 220 words per
    // minute, as BlogPost - two reading speeds on one site would be a
    // difference nobody chose.
    readMinutes: { type: Number, default: 1 },
  },
  { timestamps: true },
);

/** The storefront's lookup: this product, published only. */
productArticleSchema.index({ product: 1, status: 1 });

productArticleSchema.pre('save', function setReadMinutes(next) {
  if (this.isModified('body')) {
    const words = String(this.body ?? '').trim().split(/\s+/).filter(Boolean).length;
    this.readMinutes = Math.max(1, Math.round(words / 220));
  }
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

const ProductArticle = mongoose.model('ProductArticle', productArticleSchema);

export { ProductArticle };
export default ProductArticle;
