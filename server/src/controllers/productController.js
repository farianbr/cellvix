const { asyncHandler } = require('../utils/ApiError.js');
const { default: ApiError } = require('../utils/ApiError.js');
const productService = require('../services/productService.js');

const list = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query, req.user);
  res.json(result);
});

const search = asyncHandler(async (req, res) => {
  const result = await productService.searchProducts(req.query.q, req.user);
  res.json(result);
});

const detail = asyncHandler(async (req, res) => {
  const result = await productService.getProductBySlug(req.params.slug, req.user);
  if (!result) throw ApiError.notFound('That product is no longer listed.', 'PRODUCT_NOT_FOUND');
  res.json(result);
});

// --- CommonJS exports -------------------------------------------------
exports.list = list;
exports.search = search;
exports.detail = detail;
