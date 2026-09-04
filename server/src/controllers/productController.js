import { asyncHandler } from '../utils/ApiError.js';
import ApiError from '../utils/ApiError.js';
import * as productService from '../services/productService.js';

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

export { list, search, detail };
