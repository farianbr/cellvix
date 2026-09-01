const { asyncHandler } = require('../utils/ApiError.js');
const taxonomyService = require('../services/taxonomyService.js');

/**
 * The category tree, optionally pruned to one component type.
 *
 * `?partType=battery` returns only the branches that stock a battery, counted
 * by batteries — what the wizard needs once the buyer has answered step 1.
 * Without it the response is the full tree, exactly as before.
 */
const tree = asyncHandler(async (req, res) => {
  const partType = typeof req.query.partType === 'string' ? req.query.partType.trim() : '';

  // Component types ride along on every response: they are step 1 of the wizard
  // and never change with the path, so fetching them separately would be a
  // second round trip for a list the first response could have carried.
  const [treePayload, components] = await Promise.all([
    partType ? taxonomyService.getTreeForPartType(partType) : taxonomyService.getTree(),
    taxonomyService.getComponentTypes(),
  ]);

  res.json({ ...treePayload, ...components });
});

// --- CommonJS exports -------------------------------------------------
exports.tree = tree;
