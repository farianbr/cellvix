import { asyncHandler } from '../utils/ApiError.js';
import * as superAdminService from '../services/superAdminService.js';

/**
 * The super-admin console (SAAS_PLATFORM §4.5, §6).
 *
 * Every handler below reads `req.superAdmin`, which only
 * `middleware/superAdminAuth.js` sets — never `req.user`, never `req.supplier`.
 * That is what keeps a signed-in admin or supplier out of the console by
 * holding the wrong cookie, and a super admin out of everything else.
 */

const login = asyncHandler(async (req, res) => {
  res.json(await superAdminService.login(req.body, res));
});

const logout = asyncHandler(async (_req, res) => {
  res.json(superAdminService.logout(res));
});

/** Who is signed in. `null` rather than a 401 — the shell asks on every load. */
const me = asyncHandler(async (req, res) => {
  res.json({ admin: req.superAdmin ? req.superAdmin.toPublic() : null });
});

// ---- tenants ----------------------------------------------------------------

const listTenants = asyncHandler(async (_req, res) => {
  res.json(await superAdminService.listTenants());
});

const createTenant = asyncHandler(async (req, res) => {
  res.status(201).json(await superAdminService.createTenant(req.body));
});

const updateTenant = asyncHandler(async (req, res) => {
  res.json(await superAdminService.updateTenant(req.params.id, req.body));
});

const setSlots = asyncHandler(async (req, res) => {
  res.json(await superAdminService.setSlots(req.params.id, req.body));
});

// ---- businesses -------------------------------------------------------------

const createBusiness = asyncHandler(async (req, res) => {
  res.status(201).json(await superAdminService.createBusiness(req.params.id, req.body));
});

const assignBusiness = asyncHandler(async (req, res) => {
  res.json(await superAdminService.assignBusiness(req.params.id, req.body));
});

// ---- features ---------------------------------------------------------------

const getBusinessFeatures = asyncHandler(async (req, res) => {
  res.json(await superAdminService.getBusinessFeatures(req.params.id));
});

const setBusinessFeature = asyncHandler(async (req, res) => {
  res.json(await superAdminService.setBusinessFeature(req.params.id, req.body));
});

// ---- plans ------------------------------------------------------------------

const listPlans = asyncHandler(async (_req, res) => {
  res.json(await superAdminService.listPlans());
});

const createPlan = asyncHandler(async (req, res) => {
  res.status(201).json(await superAdminService.createPlan(req.body));
});

export {
  assignBusiness,
  createBusiness,
  createPlan,
  createTenant,
  getBusinessFeatures,
  listPlans,
  listTenants,
  login,
  logout,
  me,
  setBusinessFeature,
  setSlots,
  updateTenant,
};
