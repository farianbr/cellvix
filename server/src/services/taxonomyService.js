const { default: Taxonomy } = require('../models/Taxonomy.js');

let cache = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

/**
 * Returns the whole category tree in one payload.
 *
 * The sidebar, mega menu and tab wizard all render from this single response —
 * three sources would drift. It changes rarely, so it is cached in process.
 */
async function getTree({ force = false } = {}) {
  if (!force && cache && Date.now() - cachedAt < TTL_MS) return cache;

  const nodes = await Taxonomy.find({}).sort({ order: 1, name: 1 }).lean();

  const byId = new Map();
  for (const node of nodes) {
    byId.set(node._id.toString(), {
      id: node._id.toString(),
      kind: node.kind,
      name: node.name,
      slug: node.slug,
      icon: node.icon ?? null,
      isFeatured: Boolean(node.isFeatured),
      count: node.productCount ?? 0,
      path: node.path ?? {},
      children: [],
    });
  }

  const roots = [];
  for (const node of nodes) {
    const shaped = byId.get(node._id.toString());
    if (node.parent) {
      byId.get(node.parent.toString())?.children.push(shaped);
    } else {
      roots.push(shaped);
    }
  }

  // Roll counts up so a device type shows the sum of its models, not zero.
  const rollup = (node) => {
    if (node.children.length === 0) return node.count;
    node.count = node.children.reduce((sum, child) => sum + rollup(child), 0);
    return node.count;
  };
  roots.forEach(rollup);

  cache = { tree: roots };
  cachedAt = Date.now();
  return cache;
}

/** Call after any catalogue mutation so the next request rebuilds the tree. */
function invalidateTree() {
  cache = null;
  cachedAt = 0;
}

// --- CommonJS exports -------------------------------------------------
exports.getTree = getTree;
exports.invalidateTree = invalidateTree;
