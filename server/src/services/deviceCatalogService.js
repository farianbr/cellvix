import mongoose from 'mongoose';

import { DEVICE_KINDS } from '../models/DeviceCatalog.js';
import { db } from '../db/models.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';

/**
 * The devices a service business takes in (Sales § Ticket, § Quote).
 *
 * The counterpart of `taxonomyService` for the service side, and deliberately
 * **not** a branch inside it - see the note on `models/DeviceCatalog.js` for
 * why the catalogue tree cannot serve a repair shop.
 *
 * Two rules live here:
 *
 * **Nothing is pruned by what is for sale.** The whole reason this exists is
 * that `taxonomyService` drops any branch with no products under it. A repair
 * shop stocks parts for almost nothing it repairs, so every node is live until
 * somebody retires it by hand.
 *
 * **A node in use is deactivated, never deleted.** Tickets and estimates
 * snapshot the device name onto themselves, so deleting a model corrupts
 * nothing - but it takes its children with it, and a shop that stops taking in
 * one model has not stopped taking in the brand.
 */

/** The level each kind sits at, so a child's kind follows from its parent's. */
const CHILD_KIND = {
  deviceType: 'brand',
  brand: 'series',
  series: 'model',
  model: null,
};

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value ?? ''));
}

/**
 * A URL-safe slug from a display name.
 *
 * Generated rather than typed: a counter adding "iPhone 15 Pro Max" should not
 * have to think about slugs, and two staff inventing their own spellings is
 * how one device ends up in the tree twice.
 */
function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // Strip accents, so "Xiaomi Poco" and a pasted "Pocó" land on one slug.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Generous: a qualified slug is four names deep (phone-apple-iphone-15-...),
    // and truncating one is how two models collide again.
    .slice(0, 200);
}

/**
 * A node's slug, qualified by where it sits in the tree.
 *
 * **The same name legitimately appears several times**, which a flat
 * `slugify(name)` cannot express. "Apple" is a brand under Phone, under Laptop,
 * under Tablet AND under Watch; "Other" is a brand under every category; and a
 * model is very often named after the series holding it, so the model
 * "iPhone 15" sits inside the series "iPhone 15".
 *
 * With a global slug each of those collided: the second insert found the first
 * by slug, treated it as already present, and hung its children off the wrong
 * parent. The seed proved it - Tablet and Watch came out with no brands at all
 * because both Apples resolved to Phone's, and the iPhone 15 series lost the
 * iPhone 15 model.
 *
 * Qualifying by the parent's slug makes each path unique without making the
 * slug unreadable: `phone-apple-iphone-15-iphone-15-pro-max`.
 */
function slugFor(name, parent) {
  const own = slugify(name);
  if (!own) return '';
  return parent?.slug ? `${parent.slug}-${own}`.slice(0, 200) : own;
}

/** Lowercased, trimmed, de-duplicated, so matching never case-folds at query time. */
function normaliseAliases(value) {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : String(value).split(',');
  return [
    ...new Set(
      list
        .map((entry) => String(entry ?? '').trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];
}

function shapeNode(node, children = []) {
  return {
    id: String(node._id),
    kind: node.kind,
    name: node.name,
    slug: node.slug,
    icon: node.icon ?? null,
    order: node.order ?? 0,
    aliases: node.aliases ?? [],
    isActive: node.isActive !== false,
    path: node.path ?? {},
    parent: node.parent ? String(node.parent) : null,
    children,
  };
}

/**
 * The whole tree, nested.
 *
 * **No pruning and no counting.** Both are what `taxonomyService` does and both
 * are wrong here: a device with nothing under it is still a device the shop
 * takes in, and there is no figure to count against it.
 *
 * `status` defaults to active because every caller but the settings screen is a
 * picker, and a picker offering a retired device puts it back on a ticket.
 */
async function getTree({ business, status = 'active' } = {}) {
  const filter = {};
  if (business) filter.business = business;
  if (status === 'active') filter.isActive = true;
  else if (status === 'inactive') filter.isActive = false;

  const nodes = await db()
    .DeviceCatalog.find(filter)
    .sort({ order: 1, name: 1 })
    .lean();

  const byId = new Map();
  for (const node of nodes) byId.set(String(node._id), shapeNode(node));

  const roots = [];
  for (const node of nodes) {
    const shaped = byId.get(String(node._id));
    const parentId = node.parent ? String(node.parent) : null;
    // A node whose parent was filtered out (retired, say) is NOT silently
    // dropped - it is surfaced at the root rather than vanishing, because a
    // model that has quietly disappeared from the picker is harder to diagnose
    // than one sitting in the wrong place.
    if (parentId && byId.has(parentId)) byId.get(parentId).children.push(shaped);
    else roots.push(shaped);
  }

  return { tree: roots, total: nodes.length };
}

/**
 * A flat list, for the settings screen and for search.
 *
 * Searches name, slug and aliases together: somebody reading "SM-S911B" off the
 * back of a handset is using the alias, and a search box that only matched the
 * display name would return nothing for the way the counter actually types.
 */
async function listNodes({ business, kind, parent, q, status = 'all' } = {}) {
  const filter = {};
  if (business) filter.business = business;
  if (kind && DEVICE_KINDS.includes(kind)) filter.kind = kind;
  if (parent === 'root') filter.parent = null;
  else if (parent && isObjectId(parent)) filter.parent = parent;
  if (status === 'active') filter.isActive = true;
  else if (status === 'inactive') filter.isActive = false;

  if (q) {
    const rx = likeRegex(q);
    filter.$or = [{ name: rx }, { slug: rx }, { aliases: rx }];
  }

  const nodes = await db()
    .DeviceCatalog.find(filter)
    .sort({ kind: 1, order: 1, name: 1 })
    .limit(500)
    .lean();

  return { nodes: nodes.map((node) => shapeNode(node)), total: nodes.length };
}

/**
 * The `path` a node inherits from its parent, plus its own slug at its level.
 *
 * Denormalised so a ticket can be filtered by brand without walking the tree,
 * exactly as `Taxonomy.path` does for products.
 */
function pathFor(parent, kind, slug) {
  const path = { ...(parent?.path ?? {}) };
  path[kind] = slug;
  return path;
}

async function createNode(body = {}, business = null) {
  const name = String(body.name ?? '').trim();
  if (name.length < 1) {
    throw ApiError.badRequest('Give the device a name.', 'DEVICE_NAME_REQUIRED');
  }

  let parent = null;
  let kind = body.kind;

  if (body.parent) {
    if (!isObjectId(body.parent)) {
      throw ApiError.badRequest('That parent does not exist.', 'DEVICE_PARENT_INVALID');
    }
    parent = await db().DeviceCatalog.findById(body.parent).lean();
    if (!parent) {
      throw ApiError.badRequest('That parent does not exist.', 'DEVICE_PARENT_INVALID');
    }

    /**
     * The kind follows from the parent's, and is never taken from the request.
     *
     * A client that could name the level could hang a `deviceType` under a
     * `model`, and the denormalised `path` would then be meaningless for every
     * node beneath it.
     */
    kind = CHILD_KIND[parent.kind];
    if (!kind) {
      throw ApiError.badRequest(
        'A model is the deepest level; nothing goes under it.',
        'DEVICE_PARENT_IS_LEAF',
      );
    }
  } else {
    // A root is always a device type. Anything else at the top would leave a
    // brand with no device type in its path.
    kind = 'deviceType';
  }

  const slug = body.slug ? slugify(body.slug) : slugFor(name, parent);
  if (!slug) {
    throw ApiError.badRequest('That name cannot be turned into a slug.', 'DEVICE_SLUG_INVALID');
  }

  try {
    const node = await db().DeviceCatalog.create({
      kind,
      name,
      slug,
      business: business ?? null,
      parent: parent?._id ?? null,
      path: pathFor(parent, kind, slug),
      icon: body.icon || undefined,
      order: Number(body.order) || 0,
      aliases: normaliseAliases(body.aliases) ?? [],
      isActive: body.isActive !== false,
    });

    return { node: shapeNode(node.toObject()) };
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.badRequest(
        `"${name}" is already in this device list.`,
        'DEVICE_DUPLICATE',
      );
    }
    throw error;
  }
}

/**
 * Rename, retire or re-order a node.
 *
 * **The slug does not change on a rename**, and neither does the kind or the
 * parent. Every ticket and estimate already written carries this slug in its
 * `path`, so changing it would orphan them - and correcting a typo in a display
 * name must not do that. A device genuinely in the wrong place is retired and
 * re-added, which leaves the history pointing at something that still resolves.
 */
async function updateNode(id, body = {}) {
  if (!isObjectId(id)) throw ApiError.notFound('Device not found.', 'DEVICE_NOT_FOUND');

  const node = await db().DeviceCatalog.findById(id);
  if (!node) throw ApiError.notFound('Device not found.', 'DEVICE_NOT_FOUND');

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw ApiError.badRequest('Give the device a name.', 'DEVICE_NAME_REQUIRED');
    node.name = name;
  }
  if (body.icon !== undefined) node.icon = body.icon || undefined;
  if (body.order !== undefined) node.order = Number(body.order) || 0;
  if (body.aliases !== undefined) node.aliases = normaliseAliases(body.aliases) ?? [];

  /**
   * Retiring a node retires everything under it.
   *
   * A brand nobody takes in any more cannot leave its models in the picker -
   * they would sit there orphaned, offering a device the shop has just said it
   * does not handle. Reactivating does NOT cascade: a shop coming back to a
   * brand usually wants a few current models, not every discontinued one it
   * ever listed.
   */
  if (body.isActive !== undefined) {
    node.isActive = Boolean(body.isActive);
    if (!node.isActive) await deactivateDescendants(node._id);
  }

  await node.save();
  return { node: shapeNode(node.toObject()) };
}

/** Walk down from a node, switching every descendant off. */
async function deactivateDescendants(parentId) {
  const children = await db().DeviceCatalog.find({ parent: parentId }).select('_id').lean();
  if (!children.length) return;

  const ids = children.map((child) => child._id);
  await db().DeviceCatalog.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
  for (const id of ids) await deactivateDescendants(id);
}

/**
 * Delete a node nothing points at.
 *
 * Refused when it has children or when any ticket or estimate names it. The
 * records would still render - they snapshot the device name - but the tree
 * would lose a level that their `path` still refers to, and every filter built
 * on it would quietly stop matching.
 */
async function deleteNode(id) {
  if (!isObjectId(id)) throw ApiError.notFound('Device not found.', 'DEVICE_NOT_FOUND');

  const node = await db().DeviceCatalog.findById(id).lean();
  if (!node) throw ApiError.notFound('Device not found.', 'DEVICE_NOT_FOUND');

  const children = await db().DeviceCatalog.countDocuments({ parent: node._id });
  if (children > 0) {
    throw ApiError.badRequest(
      `"${node.name}" has ${children} device${children === 1 ? '' : 's'} under it. Retire it instead, which retires those too.`,
      'DEVICE_HAS_CHILDREN',
    );
  }

  const used = await usageCount(node);
  if (used > 0) {
    throw ApiError.badRequest(
      `"${node.name}" is on ${used} ticket${used === 1 ? '' : 's'} or estimate${used === 1 ? '' : 's'}. ` +
        'Retire it instead - it will stop appearing in the pickers and the history stays readable.',
      'DEVICE_IN_USE',
    );
  }

  await db().DeviceCatalog.deleteOne({ _id: node._id });
  return { deleted: true, name: node.name };
}

/**
 * How many tickets and estimates name this device.
 *
 * Matched on the **name**, not the slug: `Ticket.devices` stores what the
 * counter picked as free text (`brand`, `model`), because a ticket has to stay
 * readable after the tree moves on. That is exactly why the count is worth
 * taking before allowing a delete.
 */
async function usageCount(node) {
  const field = node.kind === 'deviceType' ? 'category' : node.kind;
  const match = { [`devices.${field}`]: node.name };

  const [tickets, quotes] = await Promise.all([
    db().Ticket.countDocuments(match),
    db().ServiceQuote.countDocuments(match),
  ]);
  return tickets + quotes;
}

export {
  slugify,
  slugFor,
  getTree,
  listNodes,
  createNode,
  updateNode,
  deleteNode,
};
export default { getTree, listNodes, createNode, updateNode, deleteNode };
