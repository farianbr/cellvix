/**
 * Helpers for walking the category tree returned by GET /api/taxonomy.
 * The tree is a single nested structure: deviceType > brand > series > model.
 */

const LEVELS = ['deviceType', 'brand', 'series', 'model'];

/** Finds the node for a given level in the current path. */
export function findNode(tree, path, level) {
  if (!tree) return null;

  let nodes = tree;
  for (const current of LEVELS) {
    const slug = path[current];
    if (!slug) return null;
    const node = nodes.find((n) => n.slug === slug);
    if (!node) return null;
    if (current === level) return node;
    nodes = node.children ?? [];
  }
  return null;
}

/**
 * The selectable options for one level, given everything chosen above it.
 * Returns [] when the parent level has not been chosen yet.
 */
export function optionsFor(tree, path, level) {
  if (!tree) return [];
  if (level === 'deviceType') return tree;

  const parentLevel = LEVELS[LEVELS.indexOf(level) - 1];
  const parent = findNode(tree, path, parentLevel);
  return parent?.children ?? [];
}

/** The chain of chosen nodes, shallowest first — used for breadcrumbs and chips. */
export function pathNodes(tree, path) {
  const out = [];
  let nodes = tree ?? [];

  for (const level of LEVELS) {
    const slug = path[level];
    if (!slug) break;
    const node = nodes.find((n) => n.slug === slug);
    if (!node) break;
    out.push({ level, ...node });
    nodes = node.children ?? [];
  }

  return out;
}

export { LEVELS };
