import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import * as referralService from './referralService.js';
import * as notificationService from './notificationService.js';

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

export async function register(data, { ip } = {}) {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw ApiError.conflict(
      'An account already exists for that email. Try signing in instead.',
      'EMAIL_IN_USE',
    );
  }

  // Resolved before the account is written, so an unrecognised code fails the
  // registration outright rather than creating an account whose referrer was
  // quietly dropped (§6.13). Self-referral is impossible here — this account
  // does not exist yet, so it cannot be its own referrer.
  const referredBy = data.referralCode
    ? await referralService.resolveReferralCode(data.referralCode)
    : null;

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
    // CASL (§6.13). Opening a trade account is implied consent under s.10(9)
    // for messages about the business relationship — recorded explicitly, with
    // its source and the IP it came from, because an implied basis nobody
    // wrote down is one nobody can defend later. The buyer can withdraw it at
    // any time through the unsubscribe link, which sets `unsubscribedAt` and
    // outranks this.
    marketingConsent: { granted: true, source: 'registration', at: new Date(), ip },
    // Set once, at signup, and never editable afterwards (§6.13) — a referrer
    // that can be changed later is a way to redirect money already earned.
    referredBy,
    addresses: data.address
      ? [{ ...data.address, country: 'Canada', isDefaultShipping: true, isDefaultBilling: true }]
      : [],
  });

  await user.setPassword(data.password);
  await user.save();

  // The approvals queue is the one thing in this panel that nobody discovers on
  // their own — a pending account is invisible until somebody opens Clients
  // (§7.3). Emitted after the save, and awaited only to keep ordering tidy —
  // `emit` swallows its own failures, because a registration that succeeded
  // must not be reported as failed when the bell write loses a race.
  await notificationService.emit({
    type: 'new_registration',
    severity: 'info',
    title: `${user.businessName} registered`,
    detail: `${user.contactName} · ${user.email} · awaiting approval`,
    entity: { kind: 'user', id: user._id.toString(), label: user.businessName },
    href: `/admin/clients/${user._id}`,
  });

  return user;
}

/**
 * Signs a user in.
 *
 * A pending account gets a real session on purpose — the UI needs to show
 * "still under review" rather than a generic credential failure (brief §8.2).
 * Access to pricing and ordering is blocked separately by requireApproved.
 */
/**
 * The account behind an address, for stamping a security-log row (§6.15).
 *
 * **Read-only and never surfaced to the caller.** A failed sign-in returns the
 * same `INVALID_CREDENTIALS` whether or not the address exists — that must not
 * change — but the *log* is allowed to know which account was targeted, because
 * "forty failures against one real account" and "forty failures against
 * addresses that do not exist" are different events and need to look different.
 *
 * Returns null rather than throwing: this is called from a path that is already
 * handling an error, and it must not replace it with its own.
 */
export async function findForAudit(email) {
  if (!email) return null;
  try {
    return await User.findOne({ email: String(email).toLowerCase().trim() }).lean();
  } catch {
    return null;
  }
}

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

  // A locked staff account is refused at the door rather than handed a session
  // the guards would reject on every request. The pending-account exception
  // above is deliberate and buyer-only; there is no equivalent staff state that
  // benefits from being signed in but powerless.
  if (user.lockedAt) {
    throw ApiError.forbidden(
      'This account has been locked. Contact an administrator.',
      'STAFF_LOCKED',
    );
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
