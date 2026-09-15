import { asyncHandler } from '../utils/ApiError.js';
import * as reviewService from '../services/reviewService.js';

/**
 * Product reviews.
 *
 * The customer-facing handlers all take the user from `req.user` and never from
 * the body: which account is writing is not something a client gets to assert.
 */

/** What this buyer may still review. `?orderId=` narrows it to one order. */
const listPending = asyncHandler(async (req, res) => {
  res.json({
    pending: await reviewService.listPending(req.user._id, { orderId: req.query.orderId }),
  });
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json({ review: await reviewService.create(req.user._id, req.body) });
});

/** Public: the reviews on one product. */
const listForProduct = asyncHandler(async (req, res) => {
  res.json(await reviewService.listForProduct(req.params.productId));
});

/* ---- admin ---------------------------------------------------------------- */

const adminList = asyncHandler(async (req, res) => {
  res.json(await reviewService.listForAdmin(req.query));
});

const adminSetHidden = asyncHandler(async (req, res) => {
  res.json(await reviewService.setHidden(req.params.id, req.body));
});

export { listPending, create, listForProduct, adminList, adminSetHidden };
