import { db } from '../db/models.js';
import '../models/ProductArticle.js';
import '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import { authorFromForm, authorToPublic } from '../../../shared/author.js';

/**
 * The per-product articles authored under admin SEO.
 *
 * One article per product, enforced by a unique index on `product`. Everything
 * here goes through `upsert` rather than separate create and update paths: the
 * admin screen opens an editor for a product whether or not an article exists
 * yet, so "save" means the same thing in both cases and a client should not
 * have to know which.
 */

const WORDS_PER_MINUTE = 220;

function readMinutes(body) {
  const words = String(body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function serialize(article) {
  if (!article) return null;
  return {
    id: article._id.toString(),
    product: article.product?.toString?.() ?? String(article.product),
    heading: article.heading,
    body: article.body,
    // Empty name means no byline was authored - 773 seeded articles are in that
    // state. The storefront tests the name and falls back rather than drawing a
    // rail for nobody.
    author: authorToPublic(article.author, ''),
    status: article.status,
    publishedAt: article.publishedAt ?? null,
    readMinutes: article.readMinutes ?? 1,
    updatedAt: article.updatedAt,
  };
}

/**
 * What the storefront renders on a product page.
 *
 * Published only, and the whole point of the `status` field: a draft is written
 * against a live product, so returning drafts here would publish every article
 * the moment somebody started writing it.
 */
async function getPublishedForProduct(productId) {
  const article = await db()
    .ProductArticle.findOne({ product: productId, status: 'published' })
    .lean();
  return serialize(article);
}

/**
 * The admin list: every product, with whatever article state it has.
 *
 * Driven from PRODUCTS rather than from articles, because the staff member's
 * question is "which parts still need one" and a list of existing articles
 * cannot answer it. The articles are fetched in one query and joined in memory
 * rather than per row: this is two round trips regardless of how many products
 * come back.
 *
 * No server pagination, matching `blogService.listAll`: the admin table
 * paginates client-side through `useTablePage`, so a server page would fight it
 * and the counts below would only ever describe the visible slice.
 */
async function listForAdmin({ q = '', status = '' } = {}) {
  const { Product, ProductArticle } = db();

  const query = { isActive: true };
  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ name: rx }, { sku: rx }];
  }

  const products = await Product.find(query).sort({ name: 1 }).limit(500).lean();

  const articles = await ProductArticle.find({
    product: { $in: products.map((p) => p._id) },
  }).lean();

  const byProduct = new Map(articles.map((a) => [a.product.toString(), a]));

  const all = products.map((product) => {
    const article = byProduct.get(product._id.toString()) ?? null;
    return {
      productId: product._id.toString(),
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      partTypeLabel: product.partTypeLabel,
      grade: product.grade,
      modelName: product.modelName,
      // `none` rather than null, so the three states are one vocabulary the
      // client can filter and sort on without special-casing absence.
      articleStatus: article ? article.status : 'none',
      heading: article?.heading ?? '',
      readMinutes: article?.readMinutes ?? 0,
      updatedAt: article?.updatedAt ?? null,
    };
  });

  // Counted over ALL rows, before the status filter narrows them - the tabs
  // have to keep saying how many are in the bucket you are not looking at.
  const counts = all.reduce((acc, row) => {
    acc[row.articleStatus] = (acc[row.articleStatus] ?? 0) + 1;
    return acc;
  }, {});

  const rows = status && status !== 'all' ? all.filter((row) => row.articleStatus === status) : all;

  return { rows, counts, total: all.length };
}

/** The editor's payload: the product being written about, and its article. */
async function getForAdmin(productId) {
  const { Product, ProductArticle } = db();

  const product = await Product.findById(productId).lean();
  if (!product) throw new ApiError(404, 'Product not found');

  const article = await ProductArticle.findOne({ product: productId }).lean();

  return {
    product: {
      id: product._id.toString(),
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      partTypeLabel: product.partTypeLabel,
      grade: product.grade,
      modelName: product.modelName,
    },
    article: serialize(article),
  };
}

/**
 * Create or replace the article for one product.
 *
 * `findOneAndUpdate` with `upsert` rather than a read-then-write: the unique
 * index makes a concurrent double-save a duplicate-key error otherwise, and two
 * staff on the same product is a normal thing rather than a race worth
 * failing on.
 *
 * `readMinutes` and `publishedAt` are computed here rather than left to the
 * schema hook, because `findOneAndUpdate` does not run `pre('save')`.
 */
async function upsert(productId, { heading, body, status = 'draft', ...rest }) {
  const { Product, ProductArticle } = db();

  const product = await Product.findById(productId).select('_id').lean();
  if (!product) throw new ApiError(404, 'Product not found');

  if (!heading?.trim()) throw new ApiError(400, 'A heading is required');
  if (!body?.trim()) throw new ApiError(400, 'An article body is required');

  const existing = await ProductArticle.findOne({ product: productId }).select('publishedAt').lean();

  const article = await ProductArticle.findOneAndUpdate(
    { product: productId },
    {
      $set: {
        heading: heading.trim(),
        body,
        // Built from the flat form fields by the shared mapper, so this and the
        // blog's write path cannot disagree about which key goes where.
        author: authorFromForm(rest),
        status,
        readMinutes: readMinutes(body),
        // Stamped the first time it goes live and never moved again: an edit to
        // a published article is not a republication, and resetting this would
        // make the storefront claim it was written today.
        publishedAt:
          status === 'published' ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
      },
      $setOnInsert: { product: productId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return serialize(article);
}

async function remove(productId) {
  const result = await db().ProductArticle.deleteOne({ product: productId });
  if (!result.deletedCount) throw new ApiError(404, 'No article for this product');
  return { ok: true };
}

export default { getPublishedForProduct, listForAdmin, getForAdmin, upsert, remove };
export { getPublishedForProduct, listForAdmin, getForAdmin, upsert, remove };
