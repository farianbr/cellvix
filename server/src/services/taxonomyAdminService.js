import mongoose from 'mongoose';

import { db } from '../db/models.js';
import '../models/Taxonomy.js';
import '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import { invalidateTree } from './taxonomyService.js';

/**
 * The taxonomy editor (ERP rework §6.15 — CellShoppe's *Device & Models*,
 * phase 11d).
 *
 * The master list behind the searchable picker on every product form and behind
 * the storefront's three filter UIs. Read-side lives in `taxonomyService`; this
 * is the write side, kept separate so the cached public tree has exactly one
 * owner and this file has to go through `invalidateTree` to affect it.
 *
 * **Aliases are the point of this screen** (§6.15). They sit on the model, so
 * one alias covers every SKU that fits that phone.
 *
 * **Nothing here deletes a node that is in use.** A model with products behind
 * it can be deactivated but not removed: deleting it would leave every one of
 * those products pointing at an id that resolves to nothing, and the storefront
 * filters read `path` slugs that would then match no node at all.
 */

/**
 * Aliases, cleaned.
 *
 * Lowercased so matching never case-folds at query time, deduplicated, and
 * stripped of anything that would match everything — an empty alias, or one
 * that is just whitespace, silently turns a search box into a firehose.
 */
function normaliseAliases(input) {
  const list = Array.isArray(input)
    ? input
    : String(input ?? '')
        .split(',')
        .map((value) => value.trim());

  const seen = new Set();
  const out = [];

  for (const raw of list) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!value || value.length > 60) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

/** One node, shaped for the table. */
function shape(node, counts) {
  return {
    id: node._id.toString(),
    kind: node.kind,
    name: node.name,
    slug: node.slug,
    parent: node.parent ? node.parent.toString() : null,
    path: node.path ?? {},
    aliases: node.aliases ?? [],
    isActive: node.isActive !== false,
    isFeatured: Boolean(node.isFeatured),
    order: node.order ?? 0,
    // The stored `productCount` is a denormalised rollup maintained by the
    // seed. `counts` is the live figure, which is what decides whether a node
    // may be deleted — so the screen shows the number the rule uses.
    productCount: counts?.get(node.slug) ?? 0,
  };
}

/**
 * The taxonomy table.
 *
 * Search spans name, slug **and aliases**, because a screen whose whole purpose
 * is managing aliases has to be able to find a node by one.
 */
async function list({ search, kind, parent, includeInactive, page = 1, limit = 50 } = {}) {
  const filter = {};

  if (kind && kind !== 'all') filter.kind = kind;
  if (parent) filter.parent = parent;
  if (!includeInactive || includeInactive === 'false') filter.isActive = { $ne: false };

  if (search) {
    const rx = likeRegex(search);
    filter.$or = [{ name: rx }, { slug: rx }, { aliases: rx }];
  }

  const perPage = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const current = Math.max(Number(page) || 1, 1);

  const [nodes, total, counts, stats] = await Promise.all([
    db().Taxonomy.find(filter)
      .sort({ kind: 1, order: 1, name: 1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .lean(),
    db().Taxonomy.countDocuments(filter),
    liveCounts(),
    // The KPI row counts the whole collection, never the filtered page: an
    // operator filtering to one brand still needs to know the totals.
    db().Taxonomy.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $ne: ['$isActive', false] }, 1, 0] } },
          brands: { $sum: { $cond: [{ $eq: ['$kind', 'brand'] }, 1, 0] } },
          withAliases: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$aliases', []] } }, 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const summary = stats[0] ?? { total: 0, active: 0, brands: 0, withAliases: 0 };

  return {
    nodes: nodes.map((node) => shape(node, counts)),
    total,
    page: current,
    pages: Math.max(Math.ceil(total / perPage), 1),
    stats: {
      total: summary.total,
      active: summary.active,
      inactive: summary.total - summary.active,
      brands: summary.brands,
      withAliases: summary.withAliases,
    },
  };
}

/**
 * How many live products sit under each taxonomy slug.
 *
 * Counted from `db().Product.path` rather than read off `db().Taxonomy.productCount`,
 * which the seed writes and nothing else maintains. The delete rule depends on
 * this being true right now, not true at the last seed.
 */
async function liveCounts() {
  // `Product` carries flat `*Slug` fields, not a nested `path` — the nested
  // shape is `Taxonomy`'s. One product contributes to all four of its ancestors,
  // so a brand's count is every part under every model it makes.
  const rows = await db().Product.aggregate([
    { $match: { isActive: true } },
    {
      $project: {
        slugs: ['$deviceTypeSlug', '$brandSlug', '$seriesSlug', '$modelSlug'],
      },
    },
    { $unwind: '$slugs' },
    { $match: { slugs: { $nin: [null, ''] } } },
    { $group: { _id: '$slugs', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id, row.count]));
}

/** One node, for the edit form. */
async function get(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Not found.', 'TAXONOMY_NOT_FOUND');

  const node = await db().Taxonomy.findById(id).lean();
  if (!node) throw ApiError.notFound('Not found.', 'TAXONOMY_NOT_FOUND');

  return { node: shape(node, await liveCounts()) };
}

/**
 * Edits a node.
 *
 * **Only the safe fields.** `kind`, `slug`, `parent` and `path` are deliberately
 * not editable here: they are the structure every product's denormalised `path`
 * was written against, and changing one would silently detach products from a
 * tree that still looks correct on screen. Restructuring the taxonomy is a
 * re-seed, not a form.
 */
async function update(id, input) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Not found.', 'TAXONOMY_NOT_FOUND');

  const node = await db().Taxonomy.findById(id);
  if (!node) throw ApiError.notFound('Not found.', 'TAXONOMY_NOT_FOUND');

  if (input.name !== undefined) node.name = input.name.trim();
  if (input.aliases !== undefined) node.aliases = normaliseAliases(input.aliases);
  if (input.isActive !== undefined) node.isActive = Boolean(input.isActive);
  if (input.isFeatured !== undefined) node.isFeatured = Boolean(input.isFeatured);
  if (input.order !== undefined) node.order = Number(input.order) || 0;

  // An alias that duplicates another node's is refused rather than stored: two
  // models answering to `15pm` makes the search box ambiguous in a way no
  // amount of ranking fixes, and the operator is the only one who knows which
  // one is right.
  if (node.aliases.length) {
    const clash = await db().Taxonomy.findOne({
      _id: { $ne: node._id },
      aliases: { $in: node.aliases },
    })
      .select('name aliases')
      .lean();

    if (clash) {
      const overlap = node.aliases.filter((alias) => clash.aliases.includes(alias));
      throw ApiError.badRequest(
        `“${overlap[0]}” is already an alias for ${clash.name}. An alias can only point at one model.`,
        'ALIAS_IN_USE',
      );
    }
  }

  await node.save();
  invalidateTree();

  return { node: shape(node.toObject(), await liveCounts()) };
}

/**
 * Removes a node — only when nothing points at it.
 *
 * Two guards, both refusing rather than cascading: a node with products behind
 * it, and a node with children. Cascading either would delete catalogue
 * structure from a screen whose job is editing labels.
 */
async function remove(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Not found.', 'TAXONOMY_NOT_FOUND');

  const node = await db().Taxonomy.findById(id);
  if (!node) throw ApiError.notFound('Not found.', 'TAXONOMY_NOT_FOUND');

  const children = await db().Taxonomy.countDocuments({ parent: node._id });
  if (children) {
    throw ApiError.badRequest(
      `${node.name} has ${children} ${children === 1 ? 'entry' : 'entries'} under it. Remove or move those first.`,
      'TAXONOMY_HAS_CHILDREN',
    );
  }

  const counts = await liveCounts();
  const used = counts.get(node.slug) ?? 0;
  if (used) {
    throw ApiError.badRequest(
      `${node.name} is used by ${used} ${used === 1 ? 'product' : 'products'}. Deactivate it instead — deleting it would leave those products pointing at nothing.`,
      'TAXONOMY_IN_USE',
    );
  }

  await node.deleteOne();
  invalidateTree();

  return { removed: true, name: node.name };
}

export default { list, get, update, remove, normaliseAliases };

export { normaliseAliases, list, get, update, remove };
