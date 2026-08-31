const { asyncHandler } = require('../utils/ApiError.js');
const taxonomyService = require('../services/taxonomyService.js');

const tree = asyncHandler(async (_req, res) => {
  res.json(await taxonomyService.getTree());
});

// --- CommonJS exports -------------------------------------------------
exports.tree = tree;
