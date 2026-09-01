const jwt = require('jsonwebtoken');
const { default: User } = require('../models/User.js');
const { default: ApiError } = require('../utils/ApiError.js');
const { default: env } = require('../config/env.js');
const { clearSession } = require('../services/authService.js');
const { default: Role } = require('../models/Role.js');

const STATUS_ERRORS = {
  pending: [
    'ACCOUNT_PENDING',
    'Your account is still under review. We will email you as soon as it is approved.',
  ],
  rejected: [
    'ACCOUNT_REJECTED',
    'This account was not approved. Contact sales@cellvix.ca if you think that is a mistake.',
  ],
  suspended: [
    'ACCOUNT_SUSPENDED',
    'This account is suspended. Contact your account representative.',
  ],
};

/**
 * Reads the session cookie and attaches `req.user` when it resolves.
 * Never throws — an anonymous visitor is a valid state everywhere.
 *
 * A cookie that cannot resolve to a user is actively cleared. Otherwise the
 * browser keeps presenting a dead token on every request for the rest of its
 * 7-day life, and the UI reads as "signed out" while the cookie says otherwise.
 */
async function authenticate(req, res, next) {
  const token = req.cookies?.[env.COOKIE_NAME];
  req.user = null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (user) {
      req.user = user;
    } else {
      // Signature is valid but the subject is gone: a deleted account, or a dev
      // database reseeded underneath a live session.
      clearSession(res);
    }
  } catch {
    // Expired or tampered cookie: treat as anonymous, and stop it coming back.
    clearSession(res);
  }

  return next();
}

function requireAuth(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  return next();
}

/**
 * The B2B approval gate. Wholesale pricing and ordering stay locked until an admin
 * approves the business (brief §8.2).
 */
function requireApproved(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.status === 'approved') return next();

  const [code, message] = STATUS_ERRORS[req.user.status] ?? [
    'ACCOUNT_NOT_APPROVED',
    'Your account is not approved yet.',
  ];
  return next(ApiError.forbidden(message, code));
}

/**
 * The mirror of `requireStaff`: keeps Cellvix people out of the buyer side.
 *
 * A staff login is not a business. It has no cart, no orders, no invoices and
 * no credit, so every route beneath this one would either read an empty shape
 * or write buyer data against an account that should never own any. The client
 * redirects staff away from the storefront (`RootLayout`); this is the half
 * that holds when the request does not come from our UI.
 *
 * Its own code rather than `requireApproved`'s: an admin is not `approved` and
 * would otherwise be told their account is under review, which is nonsense and
 * would send them looking for an approval that is never coming.
 */
function denyAdmin(req, _res, next) {
  if (isStaffAccount(req.user)) {
    return next(
      ApiError.forbidden(
        'Staff accounts do not have a buyer side. Use the admin console.',
        'ADMIN_NOT_A_BUYER',
      ),
    );
  }
  return next();
}

/**
 * Full admin. Deliberately NOT satisfied by a `staff` account, however
 * permissive its role: the things behind this guard are the ones §7.6 keeps
 * admin-only regardless of role — editing roles, creating users, API keys and
 * the security log — because a role that can grant itself power is not a
 * permission system.
 */
function requireAdmin(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'admin') return next(ApiError.forbidden());
  return next();
}

/**
 * Admin panel access: an admin, or a staff member holding a role.
 *
 * A staff account with no `staffRole` is refused here — access is granted,
 * never inherited, so an employee nobody has assigned is a locked door rather
 * than a door standing open.
 */
function requireStaff(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === 'admin') return next();
  if (req.user.role !== 'staff') return next(ApiError.forbidden());
  if (req.user.lockedAt) {
    return next(ApiError.forbidden('This staff account is locked.', 'STAFF_LOCKED'));
  }
  if (!req.user.staffRole) {
    return next(
      ApiError.forbidden(
        'This staff account has no role assigned yet. An administrator must grant access.',
        'NO_STAFF_ROLE',
      ),
    );
  }
  return next();
}

/**
 * The real control (§7.6). The nav filter, hidden `+ Create` entries and
 * disabled buttons are a courtesy; this is what actually decides.
 *
 * `admin` bypasses the role system entirely. Everyone else must hold `level`
 * or better on `area`, where `view` is genuinely read-only — it must not reach
 * a mutating route, including an export that writes an audit row.
 */
function requirePermission(area, level = 'view') {
  return async function permissionGuard(req, _res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();
    if (req.user.role !== 'staff') return next(ApiError.forbidden());
    if (req.user.lockedAt) {
      return next(ApiError.forbidden('This staff account is locked.', 'STAFF_LOCKED'));
    }

    try {
      // Populated per request rather than cached on the user: a role edited in
      // one tab has to bite on the next request in another, and a cached map is
      // how somebody keeps access they were just denied.
      const role = await Role.findById(req.user.staffRole);
      if (!role?.allows(area, level)) {
        return next(
          ApiError.forbidden(
            `Your role does not have ${level} access to ${area}.`,
            'PERMISSION_DENIED',
          ),
        );
      }
      req.staffPermissions = role;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** True when this account belongs to Cellvix rather than to a customer. */
function isStaffAccount(user) {
  return Boolean(user && (user.role === 'admin' || user.role === 'staff'));
}

/** True when this requester may see wholesale pricing. Used by the product serializer. */
function canSeePricing(user) {
  return Boolean(user && user.status === 'approved');
}

// --- CommonJS exports -------------------------------------------------
exports.authenticate = authenticate;
exports.requireAuth = requireAuth;
exports.requireApproved = requireApproved;
exports.denyAdmin = denyAdmin;
exports.requireAdmin = requireAdmin;
exports.requireStaff = requireStaff;
exports.requirePermission = requirePermission;
exports.isStaffAccount = isStaffAccount;
exports.canSeePricing = canSeePricing;
