import { asyncHandler } from '../utils/ApiError.js';
import * as adminService from '../services/adminService.js';

export const stats = asyncHandler(async (_req, res) => {
  res.json(await adminService.stats());
});

// ---- customers --------------------------------------------------------------

export const listUsers = asyncHandler(async (req, res) => {
  res.json(await adminService.listUsers(req.query));
});

export const getUser = asyncHandler(async (req, res) => {
  res.json(await adminService.getUser(req.params.id));
});

export const approveUser = asyncHandler(async (req, res) => {
  const user = await adminService.approveUser(req.params.id, req.user._id, req.body);
  res.json({ user });
});

export const rejectUser = asyncHandler(async (req, res) => {
  res.json({ user: await adminService.rejectUser(req.params.id, req.body) });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  res.json({ user: await adminService.setUserStatus(req.params.id, req.body) });
});

export const setCredit = asyncHandler(async (req, res) => {
  res.json({ user: await adminService.setCredit(req.params.id, req.body) });
});

// ---- products ---------------------------------------------------------------

export const listProducts = asyncHandler(async (req, res) => {
  res.json(await adminService.listProducts(req.query));
});

export const createProduct = asyncHandler(async (req, res) => {
  res.status(201).json({ product: await adminService.createProduct(req.body) });
});

export const updateProduct = asyncHandler(async (req, res) => {
  res.json({ product: await adminService.updateProduct(req.params.id, req.body) });
});

export const toggleProduct = asyncHandler(async (req, res) => {
  res.json({ product: await adminService.deactivateProduct(req.params.id) });
});

// ---- orders -----------------------------------------------------------------

export const listOrders = asyncHandler(async (req, res) => {
  res.json(await adminService.listOrders(req.query));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  res.json({ order: await adminService.updateOrderStatus(req.params.orderNumber, req.body) });
});

export const allocateStoreCredit = asyncHandler(async (req, res) => {
  res.status(201).json(await adminService.allocateStoreCredit(req.params.id, req.body, req.user._id));
});

export const storeCreditStatement = asyncHandler(async (req, res) => {
  res.json(await adminService.storeCreditStatement(req.params.id));
});

export const refundOrder = asyncHandler(async (req, res) => {
  res.status(201).json(await adminService.refundOrder(req.params.orderNumber, req.body, req.user._id));
});
