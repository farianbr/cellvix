import { asyncHandler } from '../utils/ApiError.js';
import * as supplierPortalService from '../services/supplierPortalService.js';
import rfqService from '../services/rfqService.js';

/**
 * The supplier portal (supplier process flow, §6.8a).
 *
 * Every handler below reads `req.supplier`, which only
 * `middleware/supplierAuth.js` sets — never `req.user`. That is what keeps a
 * signed-in buyer or admin from reaching a supplier's requests by holding the
 * wrong cookie, and a supplier from reaching anything else.
 */

// ---- session ----------------------------------------------------------------

const login = asyncHandler(async (req, res) => {
  res.json(await supplierPortalService.login(req.body, res));
});

const logout = asyncHandler(async (req, res) => {
  res.json(supplierPortalService.logout(res));
});

/** Who am I. `null` rather than a 401 — the portal shell asks on every load. */
const me = asyncHandler(async (req, res) => {
  res.json({
    supplier: req.supplier ? supplierPortalService.shapePortalSupplier(req.supplier) : null,
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  res.json(await supplierPortalService.requestReset(req.body.email));
});

const resetPassword = asyncHandler(async (req, res) => {
  res.json(await supplierPortalService.resetPassword(req.body));
});

const changePassword = asyncHandler(async (req, res) => {
  res.json(await supplierPortalService.changePassword(req.supplier._id, req.body));
});

// ---- requests for quote -----------------------------------------------------

const listRfqs = asyncHandler(async (req, res) => {
  res.json(await rfqService.listForSupplier(req.supplier._id));
});

const getRfq = asyncHandler(async (req, res) => {
  res.json(await rfqService.getForSupplier(req.params.id, req.supplier._id));
});

const submitQuote = asyncHandler(async (req, res) => {
  res.json(await rfqService.submitQuote(req.params.id, req.supplier._id, req.body));
});

const declineQuote = asyncHandler(async (req, res) => {
  res.json(await rfqService.declineQuote(req.params.id, req.supplier._id, req.body));
});

export {
  changePassword,
  declineQuote,
  forgotPassword,
  getRfq,
  listRfqs,
  login,
  logout,
  me,
  resetPassword,
  submitQuote,
};
