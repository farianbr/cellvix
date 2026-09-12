import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { controlModels, db } from '../db/models.js';
import '../models/User.js';
import '../models/Supplier.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import referralService from './referralService.js';
import notificationService from './notificationService.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from './welcomeMail.js';
import { displayNameOf } from '../utils/displayName.js';

// "Remember me" drives a long-lived cookie so the buyer is auto-signed-in on
// return visits (brief §8.1).
const REMEMBER_MS = 90 * 24 * 60 * 60 * 1000;

function issueSession(res, user, remember = false) {
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

function clearSession(res) {
  res.clearCookie(env.COOKIE_NAME, { path: '/' });
}

async function register(data, { ip } = {}) {
  const existing = await db().User.findOne({ email: data.email });
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

  const user = new (db().User)({
    businessName: data.businessName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone,
    businessType: data.businessType,
    website: data.website,
    taxId: data.taxId,
    // Every new B2B account starts gated. An admin unlocks wholesale pricing.
    status: 'pending',
    role: 'buyer',
    // CASL (§6.13). Opening a wholesale account is implied consent under s.10(9)
    // for messages about the business relationship — recorded explicitly, with
    // its source and the IP it came from, because an implied basis nobody
    // wrote down is one nobody can defend later. The buyer can withdraw it at
    // any time through the unsubscribe link, which sets `unsubscribedAt` and
    // outranks this.
    marketingConsent: { granted: true, source: 'registration', at: new Date(), ip },
    // The narrower question of which channels they actively ticked. Written
    // only when the form sent something: an untouched control must leave the
    // field unset — "never asked" and "asked and declined every channel" are
    // different facts, and the model's read path relies on the difference.
    ...(data.contactConsent
      ? {
          contactConsent: {
            ...data.contactConsent,
            at: new Date(),
            source: 'registration',
          },
        }
      : {}),
    // Set once, at signup, and never editable afterwards (§6.13) — a referrer
    // that can be changed later is a way to redirect money already earned.
    referredBy,
    addresses: data.address
      ? [{ ...data.address, country: data.address.country || 'Canada', isDefaultShipping: true, isDefaultBilling: true }]
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
    title: `${displayNameOf(user)} registered`,
    detail: `${user.contactName} · ${user.email} · awaiting approval`,
    entity: { kind: 'user', id: user._id.toString(), label: displayNameOf(user) },
    href: `/admin/clients/${user._id}`,
  });

  /**
   * No `password` argument: this buyer chose their own, so the message is the
   * confirmation variant with no credentials block. Sending somebody back the
   * password they just typed would put it in an inbox for no reason at all.
   *
   * Fire-and-forget for the same reason as the notification above — a
   * registration that succeeded must not be reported as failed because mail
   * was down.
   */
  await sendWelcomeEmail({ user });

  return user;
}

/**
 * Records a business applying to sell to Cellvix.
 *
 * Creates **no account and no password**: this is an application for the
 * purchasing team, not a login. It lands as a real `Supplier` document so it is
 * reviewed on the screen buyers already use, but with `isActive: false`, which
 * keeps it out of the supplier picker and stops any purchase order being raised
 * against a business nobody has vetted. `appliedAt` is what tells an unreviewed
 * application apart from a supplier that was deliberately deactivated.
 *
 * A repeat application from the same address updates the existing record rather
 * than creating a second one — somebody applying twice is somebody who thinks
 * the first one did not arrive, and two half-identical rows in the review queue
 * help nobody. An already-active supplier is left completely alone: they are
 * onboarded, and a public form must not be able to edit a live supplier.
 */
async function applyAsSupplier(data) {
  const email = String(data.email).toLowerCase().trim();

  const existing = await db().Supplier.findOne({ email });

  // Already trading with us. Answer as though it was recorded — the purchasing
  // team knows them, and telling an anonymous form which businesses are already
  // suppliers is not something this endpoint should do.
  if (existing?.isActive) return { recorded: true };

  const fields = {
    name: data.businessName,
    contactName: data.contactName,
    email,
    phone: data.phone,
    website: data.website || undefined,
    supplies: data.supplies || undefined,
    address: data.address
      ? {
          line1: data.address.line1 || undefined,
          line2: data.address.line2 || undefined,
          city: data.address.city || undefined,
          region: data.address.region || undefined,
          postal: data.address.postal || undefined,
          country: 'CA',
        }
      : undefined,
    isActive: false,
    appliedAt: new Date(),
  };

  const supplier = existing
    ? Object.assign(existing, fields)
    : new (db().Supplier)({ ...fields, paymentTerms: 'net30' });

  await supplier.save();

  // Same reasoning as a new registration: an application nobody is told about
  // sits unread until somebody happens to open the suppliers screen.
  await notificationService.emit({
    type: 'supplier_application',
    severity: 'info',
    title: `${supplier.name} applied to supply`,
    detail: `${supplier.contactName} · ${supplier.email} · awaiting review`,
    entity: { kind: 'supplier', id: supplier._id.toString(), label: supplier.name },
    href: `/admin/suppliers`,
  });

  return { recorded: true };
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
async function findForAudit(email) {
  if (!email) return null;
  try {
    return await db().User.findOne({ email: String(email).toLowerCase().trim() }).lean();
  } catch {
    return null;
  }
}

async function login({ email, password }) {
  /**
   * A tenant admin, then this business's own accounts.
   *
   * Admins live in the control plane so one login reaches every business the
   * tenant owns (`User.tenant`); staff and buyers live in the business's own
   * database. Signing in has to look in both, because the person typing an
   * address has no way to say which they are — and being told "that email and
   * password do not match" when the account plainly exists is the worst
   * possible answer.
   */
  const user =
    (await controlModels()
      .User.findOne({ email, role: 'admin' })
      .select('+passwordHash')) ??
    (await db().User.findOne({ email }).select('+passwordHash'));

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

/**
 * How long a reset link is good for.
 *
 * An hour: long enough to walk away from the desk and come back, short enough
 * that a link sitting in a mailbox somebody else later reads is usually dead.
 */
const RESET_TTL_MS = 60 * 60 * 1000;

/** `sha256(token)` — what is stored, so a database dump holds no usable link. */
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Starts a password reset.
 *
 * **Always resolves the same way**, whether or not the address is registered.
 * The caller returns 204 regardless: an endpoint that answered differently for
 * a known address would be a way to ask "does this business buy from Cellvix",
 * which is the same reason `applyAsSupplier` is silent.
 *
 * A staff account is deliberately included — staff sign in through the same
 * form, and excluding them would leak which addresses are staff.
 */
async function forgotPassword({ email }, { origin } = {}) {
  const user = await db().User.findOne({ email });
  // No account: return quietly, having done nothing. Deliberately not an error.
  if (!user) return;

  // A suspended or rejected account must not be able to let itself back in.
  // Silent for the same reason as above — the reply cannot say which it was.
  if (user.status === 'suspended' || user.status === 'rejected' || user.lockedAt) return;

  // 32 random bytes. The email carries this; only its hash is stored, and
  // issuing a new link invalidates any previous one because there is one slot.
  const token = crypto.randomBytes(32).toString('base64url');
  user.resetTokenHash = hashResetToken(token);
  user.resetTokenAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  await sendPasswordResetEmail({
    user,
    token,
    origin: origin || env.publicOrigin,
    expiresMinutes: Math.round(RESET_TTL_MS / 60000),
  });
}

/**
 * Completes a password reset.
 *
 * The token is the entire authorisation, so every check that makes it safe
 * lives here: it must hash to a stored value, must not have expired, and is
 * destroyed on use so the link cannot be replayed.
 *
 * The token is looked up **by its hash**, which is also what makes the lookup
 * constant-work — there is no partial match to time.
 */
async function resetPassword({ token, password }) {
  const user = await db().User.findOne({ resetTokenHash: hashResetToken(token) }).select(
    '+resetTokenHash +resetTokenAt',
  );

  const invalid = ApiError.badRequest(
    'That reset link is no longer valid. Request a new one.',
    'RESET_TOKEN_INVALID',
  );

  if (!user) throw invalid;
  if (!user.resetTokenAt || user.resetTokenAt.getTime() < Date.now()) {
    // Expired links are cleared rather than left to be retried forever.
    user.resetTokenHash = undefined;
    user.resetTokenAt = undefined;
    await user.save();
    throw invalid;
  }

  await user.setPassword(password);
  // Single use: the link dies with the reset it performed.
  user.resetTokenHash = undefined;
  user.resetTokenAt = undefined;
  await user.save();

  return user;
}

export { issueSession, clearSession, register, applyAsSupplier, findForAudit, login, forgotPassword, resetPassword, hashResetToken, RESET_TTL_MS };
