const mongoose = require('mongoose');

/**
 * One collection serves both the general FAQ page and the per-product FAQ
 * section. `scope` splits them; for product-scoped entries an empty `partType`
 * and `deviceTypeSlug` mean "applies to every product", which is what lets every
 * product detail page carry an FAQ without authoring one per SKU.
 */
const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'ordering', index: true },
    scope: { type: String, enum: ['general', 'product'], default: 'general', index: true },

    partType: { type: String, default: '', index: true },
    deviceTypeSlug: { type: String, default: '', index: true },

    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

faqSchema.index({ scope: 1, isPublished: 1, order: 1 });

const Faq = mongoose.model('Faq', faqSchema);

// --- CommonJS exports -------------------------------------------------
exports.Faq = Faq;
exports.default = Faq;
