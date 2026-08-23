import BlogPost from '../models/BlogPost.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';

const PAGE_SIZE = 9;
const WORDS_PER_MINUTE = 220;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90);
}

/** Read time is derived from the body, so it can never disagree with the text. */
function readMinutes(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function serialize(post) {
  return {
    id: post._id.toString(),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags ?? [],
    coverImage: post.coverImage || null,
    author: { name: post.author?.name ?? 'Cellvix', role: post.author?.role ?? '' },
    status: post.status,
    publishedAt: post.publishedAt ?? null,
    isFeatured: Boolean(post.isFeatured),
    readMinutes: post.readMinutes ?? 1,
    updatedAt: post.updatedAt,
  };
}

/** The list payload omits `body` — a nine-card index does not need nine articles. */
function serializeDetail(post) {
  return { ...serialize(post), body: post.body };
}

// --- public ------------------------------------------------------------------

/**
 * Published posts only, newest first. A draft is invisible here no matter what
 * is typed in the query string — status is fixed on the query, not filtered
 * from a parameter.
 */
export async function listPublished({ category, tag, q, page = 1, limit = PAGE_SIZE } = {}) {
  const query = { status: 'published', publishedAt: { $lte: new Date() } };

  if (category && category !== 'all') query.category = String(category);
  if (tag) query.tags = String(tag);
  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(24, Number(limit) || PAGE_SIZE);

  const [posts, total, categories, featured] = await Promise.all([
    BlogPost.find(query)
      .sort({ publishedAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    BlogPost.countDocuments(query),
    BlogPost.aggregate([
      { $match: { status: 'published', publishedAt: { $lte: new Date() } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    // The lead card is only meaningful on an unfiltered first page; anywhere
    // else it would repeat a post the grid below is already showing.
    pageNumber === 1 && !category && !tag && !q
      ? BlogPost.findOne({ status: 'published', isFeatured: true, publishedAt: { $lte: new Date() } })
          .sort({ publishedAt: -1 })
          .lean()
      : null,
  ]);

  return {
    posts: posts.map(serialize),
    featured: featured ? serialize(featured) : null,
    categories: categories.map((row) => ({ value: row._id, count: row.count })),
    total,
    page: pageNumber,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getBySlug(slug) {
  const post = await BlogPost.findOne({
    slug,
    status: 'published',
    publishedAt: { $lte: new Date() },
  }).lean();
  if (!post) throw ApiError.notFound('That article does not exist.', 'POST_NOT_FOUND');

  const related = await BlogPost.find({
    _id: { $ne: post._id },
    status: 'published',
    publishedAt: { $lte: new Date() },
    $or: [{ category: post.category }, { tags: { $in: post.tags ?? [] } }],
  })
    .sort({ publishedAt: -1 })
    .limit(3)
    .lean();

  return { post: serializeDetail(post), related: related.map(serialize) };
}

// --- admin -------------------------------------------------------------------

export async function listAll({ status, q } = {}) {
  const query = {};
  if (status && status !== 'all') query.status = String(status);
  if (q) {
    const rx = likeRegex(q);
    query.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
  }

  const [posts, counts] = await Promise.all([
    BlogPost.find(query).sort({ updatedAt: -1 }).limit(200).lean(),
    BlogPost.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    posts: posts.map(serialize),
    counts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
  };
}

export async function getById(id) {
  const post = await BlogPost.findById(id).lean();
  if (!post) throw ApiError.notFound('Post not found.', 'POST_NOT_FOUND');
  return serializeDetail(post);
}

/** Slugs are unique; a repeated title gets a numeric suffix rather than a 409. */
async function uniqueSlug(title, excludeId = null) {
  const base = slugify(title) || 'post';
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await BlogPost.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function shapeWrite(data) {
  return {
    title: data.title,
    excerpt: data.excerpt,
    body: data.body,
    category: data.category,
    tags: data.tags ?? [],
    coverImage: data.coverImage || undefined,
    author: { name: data.authorName, role: data.authorRole || undefined },
    status: data.status,
    isFeatured: data.isFeatured,
    readMinutes: readMinutes(data.body),
  };
}

/**
 * Publishing stamps `publishedAt` if the author left it blank — a published post
 * with no date sorts to the bottom of every index and reads as a bug.
 */
function resolvePublishedAt(data, existing) {
  if (data.publishedAt) return new Date(data.publishedAt);
  if (data.status !== 'published') return existing?.publishedAt ?? undefined;
  return existing?.publishedAt ?? new Date();
}

export async function createPost(data) {
  const post = await BlogPost.create({
    ...shapeWrite(data),
    slug: await uniqueSlug(data.title),
    publishedAt: resolvePublishedAt(data, null),
  });
  return serializeDetail(post.toObject());
}

export async function updatePost(id, data) {
  const post = await BlogPost.findById(id);
  if (!post) throw ApiError.notFound('Post not found.', 'POST_NOT_FOUND');

  const renamed = post.title !== data.title;
  Object.assign(post, shapeWrite(data), {
    publishedAt: resolvePublishedAt(data, post),
    // A published post keeps its URL: renaming it must not break links people
    // already have. Drafts have never been public, so they can still move.
    slug: renamed && post.status === 'draft' ? await uniqueSlug(data.title, post._id) : post.slug,
  });

  await post.save();
  return serializeDetail(post.toObject());
}

export async function deletePost(id) {
  const post = await BlogPost.findByIdAndDelete(id).lean();
  if (!post) throw ApiError.notFound('Post not found.', 'POST_NOT_FOUND');
  return serialize(post);
}
