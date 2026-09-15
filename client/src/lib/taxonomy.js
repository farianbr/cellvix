/**
 * Helpers for walking the category tree returned by GET /api/taxonomy.
 * The tree is a single nested structure: deviceType > brand > series > model.
 */

const LEVELS = ['deviceType', 'brand', 'series', 'model'];

/**
 * Finds the node for a given level in the current path.
 *
 * An unset level in the middle of a path is a GAP to step over, not the end of
 * the walk. `?brand=samsung` with no device type is a real URL - the footer and
 * the homepage both produce them, and the catalogue filters on whatever levels
 * are present - so returning null there made the wizard treat an applied brand
 * as unset and show its step "Locked".
 */
export function findNode(tree, path, level) {
  if (!tree) return null;

  let nodes = tree;
  for (const current of LEVELS) {
    const slug = path[current];

    if (!slug) {
      // Nothing chosen here: flatten to every child at this level so a deeper
      // slug can still be found under any branch.
      if (current === level) return null;
      nodes = nodes.flatMap((node) => node.children ?? []);
      continue;
    }

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

/** The chain of chosen nodes, shallowest first - used for breadcrumbs and chips. */
export function pathNodes(tree, path) {
  const out = [];
  let nodes = tree ?? [];

  for (const level of LEVELS) {
    const slug = path[level];

    // A GAP, not the end. A path can legitimately skip a level: the footer
    // links to `?brand=samsung` and the homepage to `?brand=apple`, neither
    // naming a device type, and the catalogue filters on whichever levels are
    // present. Breaking here left those with no label at all, so the wizard
    // step showed "Locked" beside a filter that was actually applied.
    if (!slug) {
      // Descend through every branch at this level so the search below still
      // has somewhere to look for the next one.
      nodes = nodes.flatMap((node) => node.children ?? []);
      continue;
    }

    const node = nodes.find((n) => n.slug === slug);
    if (!node) break;
    out.push({ level, ...node });
    nodes = node.children ?? [];
  }

  return out;
}

export { LEVELS };
