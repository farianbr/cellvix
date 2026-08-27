import Product from '../models/Product.js';
import Taxonomy from '../models/Taxonomy.js';
import { canSeePricing } from '../middleware/auth.js';
import { listForProduct as listFaqsForProduct } from './faqService.js';
import { likeRegex } from '../utils/regex.js';

const PAGE_SIZE = 24;

const SORTS = {
  relevance: { stock: -1, _id: 1 },
  'name-asc': { name: 1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  'stock-desc': { stock: -1 },
  newest: { createdAt: -1 },
};

/**
 * Shapes a product for the wire.
 *
 * THE PRICE GATE LIVES HERE. For anyone who is not an approved buyer, `price` is
 * omitted from the payload entirely — not blurred, not zeroed. The client's blur
 * is cosmetic; this is the actual control (PROJECT_INSTRUCTIONS.md §5.3).
 *
 * Availability leaves as a BOOLEAN and nothing else. The storefront states in
 * stock or out of stock; the on-hand count is a wholesale-operations number that
 * belongs to the admin payload, and shipping it here invited a buyer to plan
 * around a figure that moves between page loads.
 */
export function serialize(product, user) {
  const showPricing = canSeePricing(user);
  const doc = product.toObject ? product.toObject() : product;

  const base = {
    id: doc._id.toString(),
    sku: doc.sku,
    name: doc.name,
    slug: doc.slug,
    image: doc.image ?? null,
    partType: doc.partType,
    partTypeLabel: doc.partTypeLabel,
    grade: doc.grade,
    inStock: doc.stock > 0,
    deviceTypeSlug: doc.deviceTypeSlug,
    deviceTypeName: doc.deviceTypeName,
    brandSlug: doc.brandSlug,
    brandName: doc.brandName,
    seriesSlug: doc.seriesSlug,
    seriesName: doc.seriesName,
    modelSlug: doc.modelSlug,
    modelName: doc.modelName,
    priceVisible: showPricing,
  };

  if (!showPricing) return base;

  return {
    ...base,
    price: doc.price,
    compareAtPrice: doc.compareAtPrice ?? null,
    market: marketPosition(doc),
  };
}

/**
 * The competitor comparison, computed HERE and never on the client.
 *
 * The card shows one sentence — "save $8.80 vs market" — and that number is
 * arithmetic over prices. Handing the client an array and letting it do the
 * subtraction would put a second money calculation in the browser, which is the
 * thing the pricing rules exist to prevent; it would also let a rounding
 * difference put a different saving on the card than in the tooltip.
 *
 * Returns null when there is nothing honest to claim: no benchmarks, or we are
 * not actually the cheapest. An undercut competitor is not a saving, and
 * dressing one up as one is the kind of number a trade buyer checks once and
 * then never trusts again.
 */
function marketPosition(doc) {
  const competitors = (doc.competitors ?? [])
    .filter((entry) => entry && Number.isFinite(entry.price) && entry.price > 0)
    .map((entry) => ({ name: entry.name, price: entry.price }));

  if (!competitors.length) return null;

  const total = competitors.reduce((sum, entry) => sum + entry.price, 0);
  // Integer cents out, like every other money field on the wire.
  const average = Math.round(total / competitors.length);
  const lowest = Math.min(...competitors.map((entry) => entry.price));
  const savings = average - doc.price;

  if (savings <= 0) return null;

  return {
    competitors,
    average,
    lowest,
    savings,
    // Whole percent — a card has no room for a decimal, and "18%" is the claim
    // a buyer repeats back anyway.
    savingsPercent: Math.round((savings / average) * 100),
    // True only when we beat every single one, not just their mean. It is a
    // stronger claim, so it gets a stricter test.
    isLowest: doc.price < lowest,
  };
}

export function serializeDetail(product, user) {
  const doc = product.toObject ? product.toObject() : product;
  return {
    ...serialize(product, user),
    description: doc.description,
    images: doc.images ?? [],
    specs: doc.specs instanceof Map ? Object.fromEntries(doc.specs) : (doc.specs ?? {}),
  };
}

/** Translates the shared filter state into a Mongo query. */
function buildQuery({ deviceType, brand, series, model, partType, grade, inStockOnly, q }) {
  const query = { isActive: true };

  // `String()` on every equality value, belt to the `query parser` braces in
  // app.js: a filter value must never reach Mongo as an object, because an
  // object here IS a query operator.
  if (deviceType) query.deviceTypeSlug = String(deviceType);
  if (brand) query.brandSlug = String(brand);
  if (series) query.seriesSlug = String(series);
  if (model) query.modelSlug = String(model);

  const partTypes = toArray(partType);
  if (partTypes.length) query.partType = { $in: partTypes };

  const grades = toArray(grade);
  if (grades.length) query.grade = { $in: grades };

  if (inStockOnly) query.stock = { $gt: 0 };

  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { sku: rx }, { searchTerms: rx }, { modelName: rx }];
  }

  return query;
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').filter(Boolean);
}

/**
 * Facet counts for the sidebar.
 *
 * Each facet is counted against the query WITHOUT its own constraint applied, so
 * ticking "PULL-A" does not collapse every other grade's count to zero. Price
 * bounds are always computed but only released to approved buyers.
 */
async function buildFacets(params) {
  const withoutGrade = buildQuery({ ...params, grade: null });
  const withoutPartType = buildQuery({ ...params, partType: null });
  const full = buildQuery(params);

  const [grades, partTypes, availability, priceRange] = await Promise.all([
    Product.aggregate([
      { $match: withoutGrade },
      { $group: { _id: '$grade', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Product.aggregate([
      { $match: withoutPartType },
      {
        $group: {
          _id: '$partType',
          label: { $first: '$partTypeLabel' },
          count: { $sum: 1 },
        },
      },
      { $sort: { label: 1 } },
    ]),
    Product.aggregate([
      { $match: buildQuery({ ...params, inStockOnly: false }) },
      { $group: { _id: null, inStock: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } }, total: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: full },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]),
  ]);

  return {
    grade: grades.map((g) => ({ value: g._id, count: g.count })),
    partType: partTypes.map((p) => ({ value: p._id, label: p.label, count: p.count })),
    availability: {
      inStock: availability[0]?.inStock ?? 0,
      total: availability[0]?.total ?? 0,
    },
    price: priceRange[0] ? { min: priceRange[0].min, max: priceRange[0].max } : null,
  };
}

/** The grid query. One call returns products, facet counts and pagination. */
export async function listProducts(params, user) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(96, Number(params.limit) || PAGE_SIZE);
  const query = buildQuery(params);

  // Price bounds only bite for users who can see prices at all.
  if (canSeePricing(user)) {
    const min = Number(params.priceMin);
    const max = Number(params.priceMax);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      query.price = {};
      if (Number.isFinite(min)) query.price.$gte = min;
      if (Number.isFinite(max)) query.price.$lte = max;
    }
  }

  const sort = SORTS[params.sort] ?? SORTS.relevance;

  const [items, total, facets] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
    buildFacets(params),
  ]);

  // Prices are stripped for non-approved users, so hide the price sorts too.
  const facetsOut = canSeePricing(user) ? facets : { ...facets, price: null };

  return {
    products: items.map((item) => serialize(item, user)),
    facets: facetsOut,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProductBySlug(slug, user) {
  const product = await Product.findOne({ slug, isActive: true }).lean();
  if (!product) return null;

  // FAQs ride along with the product rather than in a second round trip: the
  // section is on every product page, so a separate request would only ever
  // arrive late and shift the layout under the reader.
  const [related, faqs] = await Promise.all([
    Product.find({
      _id: { $ne: product._id },
      modelSlug: product.modelSlug,
      isActive: true,
    })
      .limit(8)
      .lean(),
    listFaqsForProduct(product),
  ]);

  return {
    product: serializeDetail(product, user),
    related: related.map((item) => serialize(item, user)),
    faqs,
  };
}

/**
 * Payload for the header's live type-ahead (brief §4.3): facet suggestions on
 * the left, live product results on the right, total for the "View All" CTA.
 */
export async function searchProducts(term, user, { limit = 6 } = {}) {
  // `?q=a&q=b` arrives as an array; anything but a string would throw on `.trim`.
  const q = typeof term === 'string' ? term : '';
  if (q.trim().length < 2) {
    return { suggestions: [], models: [], pages: [], products: [], total: 0 };
  }

  const rx = likeRegex(q);
  const query = {
    isActive: true,
    $or: [{ name: rx }, { sku: rx }, { searchTerms: rx }, { modelName: rx }],
  };

  const [products, total, models, partTypes] = await Promise.all([
    Product.find(query).sort({ stock: -1 }).limit(limit).lean(),
    Product.countDocuments(query),
    Taxonomy.find({ kind: 'model', name: rx }).sort({ productCount: -1 }).limit(6).lean(),
    Product.aggregate([
      { $match: query },
      { $group: { _id: '$partType', label: { $first: '$partTypeLabel' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  return {
    // Left column of the dropdown.
    models: models.map((m) => ({
      slug: m.slug,
      name: m.name,
      count: m.productCount,
      path: m.path,
    })),
    suggestions: partTypes.map((p) => ({ value: p._id, label: p.label, count: p.count })),
    pages: staticPageMatches(q),
    // Right column.
    products: products.map((p) => serialize(p, user)),
    total,
  };
}

const STATIC_PAGES = [
  { title: 'About Us', href: '/about' },
  { title: 'Contact Us', href: '/contact' },
  { title: 'Offers & Combo Deals', href: '/offers' },
  { title: 'Blog', href: '/blog' },
  { title: 'FAQ', href: '/faq' },
  { title: 'My Account', href: '/account' },
  { title: 'Order History', href: '/account/orders' },
  { title: 'Invoices & Statements', href: '/account/invoices' },
  { title: 'Quick Order Pad', href: '/account/quick-order' },
];

function staticPageMatches(q) {
  const needle = q.trim().toLowerCase();
  return STATIC_PAGES.filter((page) => page.title.toLowerCase().includes(needle)).slice(0, 4);
}
