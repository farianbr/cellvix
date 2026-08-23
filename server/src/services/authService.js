import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

// "Remember me" drives a long-lived cookie so the buyer is auto-signed-in on
// return visits (brief §8.1).
const REMEMBER_MS = 90 * 24 * 60 * 60 * 1000;

export function issueSession(res, user, remember = false) {
  const token = jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
    expiresIn: remember ? '90d' : env.JWT_EXPIRES_IN,
  });

  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    // Without "Remember me" this is a SESSION cookie — no maxAge, so the browser
    // drops it on close. It previously carried a 7-day maxAge, which meant both
    // branches survived a restart and the checkbox changed nothing the buyer
    // could observe. The brief makes this control the thing that drives
    // persistence, so unchecked has to mean "do not persist".
    ...(remember ? { maxAge: REMEMBER_MS } : {}),
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(env.COOKIE_NAME, { path: '/' });
}

export async function register(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw ApiError.conflict(
      'An account already exists for that email. Try signing in instead.',
      'EMAIL_IN_USE',
    );
  }

  const user = new User({
    businessName: data.businessName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone,
    businessType: data.businessType,
    website: data.website,
    taxId: data.taxId,
    // Every new B2B account starts gated. An admin unlocks trade pricing.
    status: 'pending',
    role: 'buyer',
    addresses: data.address
      ? [{ ...data.address, country: 'Canada', isDefaultShipping: true, isDefaultBilling: true }]
      : [],
  });

  await user.setPassword(data.password);
  await user.save();
  return user;
}

/**
 * Signs a user in.
 *
 * A pending account gets a real session on purpose — the UI needs to show
 * "still under review" rather than a generic credential failure (brief §8.2).
 * Access to pricing and ordering is blocked separately by requireApproved.
 */
export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('That email and password do not match.', 'INVALID_CREDENTIALS');
  }

  const ok = await user.verifyPassword(password);
  if (!ok) {
    throw ApiError.unauthorized('That email and password do not match.', 'INVALID_CREDENTIALS');
  }

  if (user.status === 'rejected') {
    throw ApiError.forbidden(
      'This account was not approved. Contact sales@cellvix.ca if you think that is a mistake.',
      'ACCOUNT_REJECTED',
    );
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
