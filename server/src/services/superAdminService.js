import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import SuperAdmin from '../models/SuperAdmin.js';
import Tenant from '../models/Tenant.js';
import Plan from '../models/Plan.js';
import Business from '../models/Business.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import { FEATURES, resolveFeatures } from '../../../shared/schemas/features.js';

/**
 * The super-admin console (SAAS_PLATFORM §4.5, §6).
 *
 * **A third session, on a third cookie.** `middleware/auth.js` reads
 * `env.COOKIE_NAME` into `User`; `supplierAuth.js` reads its own cookie into
 * `Supplier`; this reads a third into `SuperAdmin`. None can produce another,
 * so "an admin cannot reach the console" and "a super admin cannot reach a
 * tenant's records" are both properties of the wiring rather than rules
 * somebody has to remember when adding the next route.
 *
 * ## What a super admin may and may not do (§4.5)
 *
 * **May:** create tenants, grant slots, set plans, create businesses, and
 * toggle features per business.
 *
 * **May not:** read a tenant's business records. Nothing in this file returns a
 * customer, an invoice, an order or a ticket — the console lists *businesses*
 * and their configuration, never what is inside them. That is a deliberate
 * limit and not an oversight: an operator who can read every tenant's books is
 * a breach waiting for one stolen laptop.
 */

const SUPERADMIN_COOKIE = `${env.COOKIE_NAME}_superadmin`;
/** Deliberately shorter than the 30-day supplier session: this account can
 *  reconfigure every tenant, so a forgotten browser is a bigger problem. */
const SESSION_DAYS = 7;

const SIGN_IN_FAILED = [
  'That email and password do not match a super-admin account.',
  'SUPERADMIN_CREDENTIALS_INVALID',
];

function issueSession(res, admin) {
  const token = jwt.sign(
    { sub: admin._id.toString(), kind: 'superadmin' },
    env.JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` },
  );

  res.cookie(SUPERADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSuperAdminSession(res) {
  res.clearCookie(SUPERADMIN_COOKIE, { path: '/' });
}

// ---- session ----------------------------------------------------------------

async function login({ email, password }, res) {
  const admin = await SuperAdmin.findOne({ email: String(email).toLowerCase().trim() }).select(
    '+passwordHash',
  );

  // One message for "no such account" and "wrong password", as every other
  // sign-in here does: telling them apart is an account-enumeration oracle.
  if (!admin) throw ApiError.unauthorized(...SIGN_IN_FAILED);
  if (!admin.isActive) throw ApiError.unauthorized(...SIGN_IN_FAILED);

  const ok = await bcrypt.compare(String(password), admin.passwordHash);
  if (!ok) throw ApiError.unauthorized(...SIGN_IN_FAILED);

  admin.lastLoginAt = new Date();
  await admin.save();

  issueSession(res, admin);
  return { admin: admin.toPublic() };
}

function logout(res) {
  clearSuperAdminSession(res);
  return { ok: true };
}

// ---- tenants ----------------------------------------------------------------

/** URL-safe, lowercase, collapsed — the same shaping `taxonomyAdminService` uses. */
function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Every tenant, with the businesses each one owns.
 *
 * The business rows carry configuration only — name, type, status — never a
 * count of customers or a figure of revenue. See the note at the top of this
 * file.
 */
async function listTenants() {
  const [tenants, businesses, plans] = await Promise.all([
    Tenant.find({}).sort({ name: 1 }).lean(),
    Business.find({}).select('name code businessType status tenant isDefault').lean(),
    Plan.find({}).select('name slug').lean(),
  ]);

  const planName = new Map(plans.map((plan) => [String(plan._id), plan.name]));
  const byTenant = new Map();
  for (const business of businesses) {
    const key = String(business.tenant ?? 'unassigned');
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key).push({
      id: business._id.toString(),
      name: business.name,
      code: business.code,
      businessType: business.businessType,
      status: business.status,
      isDefault: Boolean(business.isDefault),
    });
  }

  return {
    tenants: tenants.map((tenant) => {
      const owned = byTenant.get(String(tenant._id)) ?? [];
      return {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        contactName: tenant.contactName ?? null,
        contactEmail: tenant.contactEmail ?? null,
        slots: tenant.slots ?? 0,
        // What is left to spend. A tenant with no free slot cannot create a
        // business, and the console should say so before the button is pressed.
        slotsUsed: owned.length,
        slotsFree: Math.max(0, (tenant.slots ?? 0) - owned.length),
        plan: tenant.plan ? { id: String(tenant.plan), name: planName.get(String(tenant.plan)) ?? '—' } : null,
        businesses: owned,
        createdAt: tenant.createdAt,
      };
    }),
    /**
     * Businesses belonging to no tenant.
     *
     * Cellvix and CellShoppe are both here until somebody assigns them, because
     * they predate tenants entirely. Surfacing them rather than hiding them is
     * the point: a business owned by nobody is a real state that somebody has
     * to resolve, and a console that omitted it would make the slot arithmetic
     * disagree with the database.
     */
    unassigned: byTenant.get('unassigned') ?? [],
  };
}

async function createTenant(body) {
  const slug = slugify(body.slug || body.name);
  if (!slug) throw ApiError.badRequest('Give the tenant a name.', 'TENANT_NAME_REQUIRED');

  const clash = await Tenant.findOne({ slug }).lean();
  if (clash) {
    throw ApiError.badRequest(`A tenant already uses "${slug}".`, 'TENANT_SLUG_TAKEN');
  }

  const tenant = await Tenant.create({
    name: body.name,
    slug,
    status: body.status ?? 'active',
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    phone: body.phone,
    slots: body.slots ?? 1,
    plan: body.plan || undefined,
    notes: body.notes,
  });

  return { tenant: tenant.toPublic() };
}

async function updateTenant(id, body) {
  const tenant = await Tenant.findById(id);
  if (!tenant) throw ApiError.notFound('Tenant not found.', 'TENANT_NOT_FOUND');

  if (body.slug && slugify(body.slug) !== tenant.slug) {
    const slug = slugify(body.slug);
    const clash = await Tenant.findOne({ slug, _id: { $ne: tenant._id } }).lean();
    if (clash) throw ApiError.badRequest(`A tenant already uses "${slug}".`, 'TENANT_SLUG_TAKEN');
    tenant.slug = slug;
  }

  for (const field of ['name', 'status', 'contactName', 'contactEmail', 'phone', 'notes']) {
    if (body[field] !== undefined) tenant[field] = body[field];
  }
  if (body.slots !== undefined) tenant.slots = body.slots;
  if (body.plan !== undefined) tenant.plan = body.plan || undefined;

  await tenant.save();
  return { tenant: tenant.toPublic() };
}

/**
 * Grant or revoke slots.
 *
 * **Never below what is already used.** Taking a tenant to fewer slots than it
 * has businesses would leave it over its own limit with no way to act on that —
 * the console cannot delete somebody's business to make the arithmetic work,
 * and silently allowing it would make `slotsFree` negative everywhere it is
 * read.
 */
async function setSlots(id, { slots }) {
  const tenant = await Tenant.findById(id);
  if (!tenant) throw ApiError.notFound('Tenant not found.', 'TENANT_NOT_FOUND');

  const used = await Business.countDocuments({ tenant: tenant._id });
  if (slots < used) {
    throw ApiError.badRequest(
      `${tenant.name} already runs ${used} business(es) — grant at least that many slots, or remove a business first.`,
      'SLOTS_BELOW_USED',
    );
  }

  tenant.slots = slots;
  await tenant.save();
  return { tenant: tenant.toPublic(), slotsUsed: used };
}

// ---- businesses -------------------------------------------------------------

/**
 * Create a business for a tenant, spending a slot.
 *
 * The slot check is here rather than on the model because it is a *policy*
 * about what a tenant has paid for, and policy belongs where it can produce a
 * message somebody can act on.
 */
async function createBusiness(tenantId, body) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw ApiError.notFound('Tenant not found.', 'TENANT_NOT_FOUND');

  const used = await Business.countDocuments({ tenant: tenant._id });
  if (used >= (tenant.slots ?? 0)) {
    throw ApiError.badRequest(
      `${tenant.name} has used all ${tenant.slots ?? 0} of its slots. Grant another before adding a business.`,
      'NO_SLOTS_LEFT',
    );
  }

  const { nextBusinessCode } = await import('./accessService.js');

  const business = await Business.create({
    name: body.name,
    code: await nextBusinessCode(),
    businessType: body.businessType ?? 'product',
    status: 'active',
    colorToken: body.colorToken ?? 'brand',
    tenant: tenant._id,
    plan: tenant.plan,
    slotGrantedAt: new Date(),
    // Never the default. Exactly one business is the default and it is the one
    // an unattributed record lands in — a new tenant's business must not
    // quietly become that for everybody.
    isDefault: false,
  });

  return { business: business.toPublic() };
}

/** Assign an existing business to a tenant, or move it between tenants. */
async function assignBusiness(businessId, { tenant: tenantId }) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound('Business not found.', 'BUSINESS_NOT_FOUND');

  if (!tenantId) {
    business.tenant = undefined;
    await business.save();
    return { business: business.toPublic() };
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw ApiError.notFound('Tenant not found.', 'TENANT_NOT_FOUND');

  // Moving between tenants does not spend a slot on the way out, so the check
  // is only against the destination.
  const used = await Business.countDocuments({
    tenant: tenant._id,
    _id: { $ne: business._id },
  });
  if (used >= (tenant.slots ?? 0)) {
    throw ApiError.badRequest(
      `${tenant.name} has used all ${tenant.slots ?? 0} of its slots.`,
      'NO_SLOTS_LEFT',
    );
  }

  business.tenant = tenant._id;
  if (!business.plan && tenant.plan) business.plan = tenant.plan;
  await business.save();

  return { business: business.toPublic() };
}

// ---- features ---------------------------------------------------------------

/**
 * One business's feature grid: every key, where its answer came from, and
 * whether it can be changed at all.
 *
 * `source` is what makes the screen honest. A key that is on because the
 * business type says so reads differently from one somebody switched on, and a
 * grid that showed only the effective value would make an override
 * indistinguishable from a default.
 */
async function getBusinessFeatures(businessId) {
  const business = await Business.findById(businessId).lean();
  if (!business) throw ApiError.notFound('Business not found.', 'BUSINESS_NOT_FOUND');

  const plan = business.plan ? await Plan.findById(business.plan).lean() : null;
  const planDefaults = plan?.featureDefaults ?? null;
  const overrides = business.featureOverrides ?? {};

  const effective = resolveFeatures({
    businessType: business.businessType,
    planDefaults,
    overrides,
  });

  const typeOnly = resolveFeatures({ businessType: business.businessType });

  return {
    business: {
      id: business._id.toString(),
      name: business.name,
      code: business.code,
      businessType: business.businessType,
      plan: plan ? { id: plan._id.toString(), name: plan.name } : null,
    },
    features: FEATURES.map((feature) => {
      const has = Object.prototype.hasOwnProperty.call(overrides, feature.key);
      const planHas = planDefaults
        ? Object.prototype.hasOwnProperty.call(planDefaults, feature.key)
        : false;

      return {
        key: feature.key,
        label: feature.label,
        description: feature.description,
        area: feature.area,
        locked: Boolean(feature.locked),
        enabled: effective[feature.key],
        // Where the answer came from, most specific first.
        source: feature.locked ? 'locked' : has ? 'override' : planHas ? 'plan' : 'type',
        typeDefault: typeOnly[feature.key],
      };
    }),
  };
}

/**
 * Switch one feature on or off for one business.
 *
 * **A locked key is refused rather than silently ignored.** `resolveFeatures`
 * would force it back on anyway (§3.2 rule 4), so accepting the write would
 * store a setting that does nothing — and a console that appears to accept a
 * change it did not make is worse than one that says no.
 *
 * Passing `null` clears the override and returns the key to its plan or type
 * default, which is a different act from switching it off and has to stay
 * expressible.
 */
async function setBusinessFeature(businessId, { key, enabled }) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound('Business not found.', 'BUSINESS_NOT_FOUND');

  const feature = FEATURES.find((row) => row.key === key);
  if (!feature) throw ApiError.badRequest('No such feature.', 'FEATURE_UNKNOWN');

  if (feature.locked) {
    throw ApiError.badRequest(
      `${feature.label} runs for every business and cannot be switched off.`,
      'FEATURE_LOCKED',
    );
  }

  /**
   * A plain object, replaced wholesale rather than mutated.
   *
   * `featureOverrides` is `Mixed`, and Mongoose cannot see a mutation inside a
   * `Mixed` value — `overrides[key] = true` on the existing object would save
   * nothing and the console would appear to accept a change it never made.
   * Assigning a new object is what marks the path dirty; `markModified` below
   * says so explicitly rather than relying on that being remembered.
   */
  const next = { ...(business.featureOverrides ?? {}) };
  if (enabled === null) delete next[key];
  else next[key] = Boolean(enabled);

  business.featureOverrides = next;
  business.markModified('featureOverrides');

  await business.save();
  return getBusinessFeatures(businessId);
}

// ---- plans ------------------------------------------------------------------

async function listPlans() {
  const plans = await Plan.find({}).sort({ priceCents: 1, name: 1 });
  return { plans: plans.map((plan) => plan.toPublic()) };
}

async function createPlan(body) {
  const slug = slugify(body.slug || body.name);
  if (!slug) throw ApiError.badRequest('Give the plan a name.', 'PLAN_NAME_REQUIRED');

  const clash = await Plan.findOne({ slug }).lean();
  if (clash) throw ApiError.badRequest(`A plan already uses "${slug}".`, 'PLAN_SLUG_TAKEN');

  const plan = await Plan.create({
    name: body.name,
    slug,
    description: body.description,
    priceCents: body.priceCents ?? 0,
    includedSlots: body.includedSlots ?? 1,
  });

  return { plan: plan.toPublic() };
}

export {
  SUPERADMIN_COOKIE,
  assignBusiness,
  clearSuperAdminSession,
  createBusiness,
  createPlan,
  createTenant,
  getBusinessFeatures,
  listPlans,
  listTenants,
  login,
  logout,
  setBusinessFeature,
  setSlots,
  updateTenant,
};
