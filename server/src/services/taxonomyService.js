const { default: Taxonomy } = require('../models/Taxonomy.js');
const { default: Product } = require('../models/Product.js');

let cache = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

/**
 * Pruned trees, keyed by component type.
 *
 * Small and bounded — one entry per part type, ~25 of them — and each is the
 * same shape as the full tree, so the client cannot tell which it got.
 */
const prunedCache = new Map();
let prunedAt = 0;

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

/**
 * The same tree, containing only the branches that actually stock one component
 * type — and counting only that component's products.
 *
 * The wizard asks for a component FIRST (§5.3), so every level below it has to
 * answer "which device types / brands / series / models can I get a battery
 * for". Returning the full tree there walks a buyer into a dead end: they pick
 * Optical Drive, then Smartphone, and land on an empty grid having been offered
 * the combination by us.
 *
 * The counts come from the products themselves rather than from the stored
 * `productCount`, which is a total across every part type and would tell a
 * buyer looking at batteries that Samsung has 97 of them.
 */
async function getTreeForPartType(partType) {
  if (!partType) return getTree();

  if (prunedCache.has(partType) && Date.now() - prunedAt < TTL_MS) {
    return prunedCache.get(partType);
  }

  // One pass over the matching products gives the exact count for every node in
  // the tree at once: a model's count is its own group, and the levels above it
  // are the rollup that getTree() already does.
  const groups = await Product.aggregate([
    { $match: { partType, isActive: true } },
    {
      $group: {
        _id: {
          deviceType: '$deviceTypeSlug',
          brand: '$brandSlug',
          series: '$seriesSlug',
          model: '$modelSlug',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Every slug that survives, at any level — a node is kept when its own slug
  // appears, which for a leaf means it has stock and for a parent means one of
  // its descendants does.
  const live = new Set();
  const modelCounts = new Map();
  for (const group of groups) {
    const { deviceType, brand, series, model } = group._id;
    for (const slug of [deviceType, brand, series, model]) {
      if (slug) live.add(slug);
    }
    if (model) modelCounts.set(model, (modelCounts.get(model) ?? 0) + group.count);
  }

  const { tree: full } = await getTree();

  const prune = (nodes) =>
    nodes
      .filter((node) => live.has(node.slug))
      .map((node) => {
        const children = prune(node.children ?? []);
        return {
          ...node,
          children,
          count: children.length
            ? children.reduce((sum, child) => sum + child.count, 0)
            : (modelCounts.get(node.slug) ?? 0),
        };
      })
      // A branch that kept no children and counts nothing is a node whose slug
      // matched but whose products all sit under a level we dropped.
      .filter((node) => node.count > 0 || node.children.length > 0);

  const result = { tree: prune(full) };

  if (Date.now() - prunedAt >= TTL_MS) {
    prunedCache.clear();
    prunedAt = Date.now();
  }
  prunedCache.set(partType, result);

  return result;
}

let componentCache = null;
let componentsAt = 0;

/**
 * Every component type in the catalogue, with its label and how many live
 * products carry it.
 *
 * This is step 1 of the wizard, so it is deliberately NOT derived from the
 * taxonomy tree: a component type cuts across the tree (a battery exists for
 * phones, laptops and watches alike) and has no node of its own.
 */
async function getComponentTypes() {
  if (componentCache && Date.now() - componentsAt < TTL_MS) return componentCache;

  const rows = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$partType',
        label: { $first: '$partTypeLabel' },
        count: { $sum: 1 },
      },
    },
    { $sort: { label: 1 } },
  ]);

  componentCache = {
    componentTypes: rows
      .filter((row) => row._id)
      .map((row) => ({ slug: row._id, name: row.label || row._id, count: row.count })),
  };
  componentsAt = Date.now();
  return componentCache;
}

/** Call after any catalogue mutation so the next request rebuilds the tree. */
function invalidateTree() {
  cache = null;
  cachedAt = 0;
  prunedCache.clear();
  prunedAt = 0;
  componentCache = null;
  componentsAt = 0;
}

// --- CommonJS exports -------------------------------------------------
exports.getTree = getTree;
exports.getTreeForPartType = getTreeForPartType;
exports.getComponentTypes = getComponentTypes;
exports.invalidateTree = invalidateTree;
