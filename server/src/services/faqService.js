import Faq from '../models/Faq.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import { FAQ_CATEGORIES } from '../../../shared/schemas/content.js';

const CATEGORY_ORDER = FAQ_CATEGORIES.map((category) => category.value);

function serialize(faq) {
  return {
    id: faq._id.toString(),
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    scope: faq.scope,
    partType: faq.partType || '',
    deviceTypeSlug: faq.deviceTypeSlug || '',
    order: faq.order ?? 0,
    isPublished: faq.isPublished !== false,
    updatedAt: faq.updatedAt,
  };
}

// --- public ------------------------------------------------------------------

/**
 * The general FAQ page. Grouped server-side so the page renders sections in the
 * canonical category order rather than whatever order Mongo returned.
 */
export async function listGeneral({ q } = {}) {
  const query = { scope: 'general', isPublished: true };
  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ question: rx }, { answer: rx }];
  }

  const faqs = await Faq.find(query).sort({ order: 1, createdAt: 1 }).limit(300).lean();
  const shaped = faqs.map(serialize);

  const groups = FAQ_CATEGORIES.map((category) => ({
    value: category.value,
    label: category.label,
    faqs: shaped.filter((faq) => faq.category === category.value),
  })).filter((group) => group.faqs.length > 0);

  // A category that was renamed in the schema after entries were written would
  // otherwise silently vanish from the page.
  const orphans = shaped.filter((faq) => !CATEGORY_ORDER.includes(faq.category));
  if (orphans.length) groups.push({ value: 'other', label: 'Other', faqs: orphans });

  return { groups, total: shaped.length };
}

/**
 * FAQs for one product.
 *
 * An entry with neither `partType` nor `deviceTypeSlug` applies to everything;
 * filling either narrows it. The most specific entries sort first, so a screen
 * question outranks a generic shipping one on a screen's page.
 */
export async function listForProduct(product, { limit = 8 } = {}) {
  if (!product) return [];

  const faqs = await Faq.find({
    scope: 'product',
    isPublished: true,
    partType: { $in: ['', product.partType] },
    deviceTypeSlug: { $in: ['', product.deviceTypeSlug] },
  })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  const specificity = (faq) => (faq.partType ? 2 : 0) + (faq.deviceTypeSlug ? 1 : 0);

  return faqs
    .map(serialize)
    .sort((a, b) => specificity(b) - specificity(a) || a.order - b.order)
    .slice(0, limit)
    .map((faq) => ({
      ...faq,
      // Authors write one entry for a whole part type; the placeholders let it
      // read as if it were written for this SKU.
      question: fill(faq.question, product),
      answer: fill(faq.answer, product),
    }));
}

/** `{product}`, `{model}`, `{brand}`, `{partType}` and `{grade}` in FAQ copy. */
function fill(text, product) {
  return text
    .replaceAll('{product}', product.name ?? 'this part')
    .replaceAll('{model}', product.modelName ?? 'this model')
    .replaceAll('{brand}', product.brandName ?? 'this brand')
    .replaceAll('{partType}', product.partTypeLabel ?? 'part')
    .replaceAll('{grade}', product.grade ?? '');
}

// --- admin -------------------------------------------------------------------

export async function listAll({ scope, q } = {}) {
  const query = {};
  if (scope && scope !== 'all') query.scope = String(scope);
  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ question: rx }, { answer: rx }];
  }

  const [faqs, counts] = await Promise.all([
    Faq.find(query).sort({ scope: 1, order: 1, createdAt: 1 }).limit(400).lean(),
    Faq.aggregate([{ $group: { _id: '$scope', count: { $sum: 1 } } }]),
  ]);

  return {
    faqs: faqs.map(serialize),
    counts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
  };
}

function shapeWrite(data) {
  return {
    question: data.question,
    answer: data.answer,
    category: data.category,
    scope: data.scope,
    // A general FAQ carries no targeting; leaving stale values on it would make
    // it reappear on product pages after a scope switch.
    partType: data.scope === 'product' ? data.partType || '' : '',
    deviceTypeSlug: data.scope === 'product' ? data.deviceTypeSlug || '' : '',
    order: data.order ?? 0,
    isPublished: data.isPublished !== false,
  };
}

export async function createFaq(data) {
  const faq = await Faq.create(shapeWrite(data));
  return serialize(faq.toObject());
}

export async function updateFaq(id, data) {
  const faq = await Faq.findById(id);
  if (!faq) throw ApiError.notFound('FAQ entry not found.', 'FAQ_NOT_FOUND');
  Object.assign(faq, shapeWrite(data));
  await faq.save();
  return serialize(faq.toObject());
}

export async function deleteFaq(id) {
  const faq = await Faq.findByIdAndDelete(id).lean();
  if (!faq) throw ApiError.notFound('FAQ entry not found.', 'FAQ_NOT_FOUND');
  return serialize(faq);
}
