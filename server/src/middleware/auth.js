import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import { clearSession } from '../services/authService.js';

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
export async function authenticate(req, res, next) {
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

export function requireAuth(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  return next();
}

/**
 * The B2B approval gate. Trade pricing and ordering stay locked until an admin
 * approves the business (brief §8.2).
 */
export function requireApproved(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.status === 'approved') return next();

  const [code, message] = STATUS_ERRORS[req.user.status] ?? [
    'ACCOUNT_NOT_APPROVED',
    'Your account is not approved yet.',
  ];
  return next(ApiError.forbidden(message, code));
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'admin') return next(ApiError.forbidden());
  return next();
}

/** True when this requester may see trade pricing. Used by the product serializer. */
export function canSeePricing(user) {
  return Boolean(user && user.status === 'approved');
}
