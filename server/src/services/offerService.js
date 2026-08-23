import Offer from '../models/Offer.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import { canSeePricing } from '../middleware/auth.js';
import { serialize as serializeProduct } from './productService.js';

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90);
}

/**
 * Live / scheduled / expired is DERIVED from the window on every read.
 * Storing it would need a cron job to stay true (PROJECT_INSTRUCTIONS.md §5.6).
 */
export function offerStatus(offer, now = new Date()) {
  if (!offer.isActive) return 'paused';
  if (offer.startsAt && offer.startsAt > now) return 'scheduled';
  if (offer.endsAt && offer.endsAt < now) return 'expired';
  return 'live';
}

function baseShape(offer, now) {
  return {
    id: offer._id.toString(),
    title: offer.title,
    slug: offer.slug,
    subtitle: offer.subtitle || '',
    description: offer.description || '',
    terms: offer.terms || '',
    kind: offer.kind,
    badge: offer.badge || '',
    accent: offer.accent || 'brand',
    code: offer.code || '',
    discountType: offer.discountType,
    discountPercent: offer.discountPercent ?? 0,
    discountAmount: offer.discountAmount ?? 0,
    minQty: offer.minQty ?? 0,
    minSpend: offer.minSpend ?? 0,
    target: {
      deviceTypeSlug: offer.target?.deviceTypeSlug || '',
      brandSlug: offer.target?.brandSlug || '',
      partType: offer.target?.partType || '',
      grade: offer.target?.grade || '',
    },
    items: (offer.items ?? []).map((item) => ({ sku: item.sku, qty: item.qty ?? 1 })),
    bundlePrice: offer.bundlePrice ?? 0,
    // A deal with no code applies on its own; one with a code has to be typed in
    // at the cart. The card says which, because they are different promises.
    requiresCode: Boolean(offer.code),
    redemption: offer.redemption ?? 'multi',
    usageLimit: offer.usageLimit ?? 0,
    usageCount: offer.usageCount ?? 0,
    eligibility: offer.eligibility ?? 'all',
    allowedUsers: (offer.allowedUsers ?? []).map((id) => id.toString()),
    startsAt: offer.startsAt ?? null,
    endsAt: offer.endsAt ?? null,
    isActive: offer.isActive !== false,
    isFeatured: Boolean(offer.isFeatured),
    order: offer.order ?? 0,
    status: offerStatus(offer, now),
    updatedAt: offer.updatedAt,
  };
}

/**
 * Resolves a combo's SKUs into product summaries.
 *
 * The bundle price, the regular total and the saving are all PRICES, so they go
 * through the same gate as the catalogue: a guest is told a combo exists and
 * what is in it, never what it costs (PROJECT_INSTRUCTIONS.md §5.3).
 */
async function attachComboProducts(offers, user) {
  const combos = offers.filter((offer) => offer.kind === 'combo' && offer.items.length);
  if (!combos.length) return offers;

  const skus = [...new Set(combos.flatMap((offer) => offer.items.map((item) => item.sku)))];
  const products = await Product.find({ sku: { $in: skus }, isActive: true }).lean();
  const bySku = new Map(products.map((product) => [product.sku, product]));
  const showPricing = canSeePricing(user);

  for (const offer of combos) {
    const lines = [];
    let regularTotal = 0;
    let complete = true;

    for (const item of offer.items) {
      const product = bySku.get(item.sku);
      // A SKU deactivated since the combo was written must not silently drop
      // out of the bundle — the whole combo stops being buyable.
      if (!product) {
        complete = false;
        continue;
      }
      regularTotal += product.price * item.qty;
      lines.push({ ...serializeProduct(product, user), qty: item.qty });
    }

    offer.products = lines;
    offer.available = complete && lines.length > 0 && lines.every((line) => line.inStock);
    offer.priceVisible = showPricing;

    if (showPricing) {
      offer.regularTotal = regularTotal;
      offer.savings = Math.max(0, regularTotal - offer.bundlePrice);
      offer.savingsPercent =
        regularTotal > 0 ? Math.round(((regularTotal - offer.bundlePrice) / regularTotal) * 100) : 0;
    } else {
      offer.bundlePrice = null;
      offer.regularTotal = null;
      offer.savings = null;
      offer.savingsPercent = null;
    }
  }

  return offers;
}

/** Drops the admin-only audience fields from a public payload. */
function stripAudience(offer) {
  const { allowedUsers, usageCount, usageLimit, ...rest } = offer;
  return { ...rest, restricted: offer.eligibility === 'accounts' };
}

/** Offer ids this account has already redeemed on an order that still stands. */
async function redeemedOfferIds(user) {
  const ids = await Order.distinct('promo.offer', {
    user: user._id,
    status: { $ne: 'cancelled' },
  });
  return new Set(ids.filter(Boolean).map((id) => id.toString()));
}

// --- public ------------------------------------------------------------------

/**
 * Only what is actually running right now, ordered as the admin arranged it.
 *
 * Account-restricted offers are filtered out for everyone they are not for, and
 * for guests entirely. An offer nobody outside a named list may redeem should
 * not be advertised to the whole internet — and a code that comes back "not
 * recognised" is a lot less annoying than one that was dangled and refused.
 */
export async function listLive(user) {
  const now = new Date();

  const docs = await Offer.find({
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ order: 1, createdAt: -1 })
    .limit(60)
    .lean();

  const visible = docs.filter((doc) => {
    if ((doc.eligibility ?? 'all') !== 'accounts') return true;
    if (!user) return false;
    return (doc.allowedUsers ?? []).some((id) => id.toString() === user._id.toString());
  });

  // A single-use code this account has already spent is dead to them, so it is
  // not shown. `usageLimit` reached retires it for everyone.
  const spent = user ? await redeemedOfferIds(user) : new Set();

  const offers = await attachComboProducts(
    visible
      .filter((doc) => !(doc.usageLimit > 0 && doc.usageCount >= doc.usageLimit))
      .filter((doc) => !(doc.redemption === 'single' && spent.has(doc._id.toString())))
      .map((doc) => baseShape(doc, now)),
    user,
  );

  // Who else an offer belongs to is nobody's business but the admin's.
  const publicOffers = offers.map(stripAudience);

  return {
    featured: publicOffers.find((offer) => offer.isFeatured) ?? null,
    deals: publicOffers.filter((offer) => offer.kind === 'deal'),
    combos: publicOffers.filter((offer) => offer.kind === 'combo'),
    total: publicOffers.length,
  };
}

export async function getBySlug(slug, user) {
  const now = new Date();
  const doc = await Offer.findOne({ slug }).lean();
  if (!doc) throw ApiError.notFound('That offer does not exist.', 'OFFER_NOT_FOUND');

  const shaped = baseShape(doc, now);
  if (shaped.status !== 'live') {
    throw ApiError.notFound('That offer is no longer running.', 'OFFER_NOT_LIVE');
  }

  const [offer] = await attachComboProducts([shaped], user);
  return { offer: stripAudience(offer) };
}

// --- admin -------------------------------------------------------------------

export async function listAll({ status, q } = {}) {
  const now = new Date();
  const query = {};
  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ title: rx }, { subtitle: rx }, { code: rx }];
  }

  const docs = await Offer.find(query).sort({ order: 1, createdAt: -1 }).limit(200).lean();
  let offers = docs.map((doc) => baseShape(doc, now));

  const counts = offers.reduce((accumulator, offer) => {
    accumulator[offer.status] = (accumulator[offer.status] ?? 0) + 1;
    return accumulator;
  }, {});

  if (status && status !== 'all') offers = offers.filter((offer) => offer.status === status);

  // This route is behind requireAdmin, so staff see real bundle economics.
  offers = await attachComboProducts(offers, { status: 'approved' });

  return { offers, counts, total: offers.length };
}

async function uniqueSlug(title, excludeId = null) {
  const base = slugify(title) || 'offer';
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await Offer.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * SKUs are checked against the catalogue at write time.
 *
 * A typo here renders as an incomplete bundle on a public page and the admin who
 * typed it has no way to tell. Refusing at the boundary is the only point where
 * the mistake is still cheap.
 */
async function assertSkusExist(items) {
  if (!items?.length) return;
  const skus = items.map((item) => item.sku.trim().toUpperCase());
  const found = await Product.find({ sku: { $in: skus } }).select('sku').lean();
  const known = new Set(found.map((product) => product.sku));
  const missing = skus.filter((sku) => !known.has(sku));
  if (missing.length) {
    throw ApiError.badRequest(`No product with SKU ${missing.join(', ')}.`, 'UNKNOWN_SKU', {
      items: `Unknown SKU: ${missing.join(', ')}`,
    });
  }
}

function shapeWrite(data) {
  const isCombo = data.kind === 'combo';
  return {
    title: data.title,
    subtitle: data.subtitle || '',
    description: data.description || '',
    terms: data.terms || '',
    kind: data.kind,
    badge: data.badge || '',
    accent: data.accent,
    code: data.code ? data.code.trim().toUpperCase() : '',
    // Each kind clears the other's fields, so switching kind cannot leave a
    // combo advertising a percentage it no longer has.
    discountType: isCombo ? 'amount' : data.discountType,
    discountPercent: isCombo ? 0 : (data.discountPercent ?? 0),
    discountAmount: isCombo ? 0 : (data.discountAmount ?? 0),
    minQty: isCombo ? 0 : (data.minQty ?? 0),
    minSpend: isCombo ? 0 : (data.minSpend ?? 0),
    target: isCombo
      ? {}
      : {
          deviceTypeSlug: data.target?.deviceTypeSlug || '',
          brandSlug: data.target?.brandSlug || '',
          partType: data.target?.partType || '',
          grade: data.target?.grade || '',
        },
    items: isCombo
      ? data.items.map((item) => ({ sku: item.sku.trim().toUpperCase(), qty: item.qty ?? 1 }))
      : [],
    bundlePrice: isCombo ? data.bundlePrice : 0,
    redemption: data.redemption,
    usageLimit: data.usageLimit ?? 0,
    eligibility: data.eligibility,
    // Clearing the list when the offer opens up keeps a stale audience from
    // reappearing if it is later restricted again.
    allowedUsers: data.eligibility === 'accounts' ? data.allowedUsers : [],
    startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
    endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
    isActive: data.isActive !== false,
    isFeatured: Boolean(data.isFeatured),
    order: data.order ?? 0,
  };
}

export async function createOffer(data) {
  const write = shapeWrite(data);
  await assertSkusExist(write.items);

  const offer = await Offer.create({ ...write, slug: await uniqueSlug(data.title) });
  return baseShape(offer.toObject(), new Date());
}

export async function updateOffer(id, data) {
  const offer = await Offer.findById(id);
  if (!offer) throw ApiError.notFound('Offer not found.', 'OFFER_NOT_FOUND');

  const write = shapeWrite(data);
  await assertSkusExist(write.items);

  Object.assign(offer, write);
  await offer.save();
  return baseShape(offer.toObject(), new Date());
}

export async function deleteOffer(id) {
  const offer = await Offer.findByIdAndDelete(id).lean();
  if (!offer) throw ApiError.notFound('Offer not found.', 'OFFER_NOT_FOUND');
  return baseShape(offer, new Date());
}
