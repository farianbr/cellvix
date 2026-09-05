import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import Supplier from '../models/Supplier.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import { generatePassword } from './welcomeMail.js';
import { sendSupplierPortalInvite, sendSupplierResetEmail } from './supplierMail.js';

/**
 * The supplier portal's session (supplier process flow, §6.8a).
 *
 * **A different cookie from the buyer and admin session, on purpose.** The
 * whole safety argument for putting supplier credentials on `Supplier` rather
 * than adding a fourth `User.role` rests on this file: `middleware/auth.js`
 * reads `env.COOKIE_NAME` and looks the subject up in `User`, so a token minted
 * here can never satisfy `requireAuth`, `requireApproved`, `requireStaff` or
 * `requirePermission` — not because those were audited, but because the
 * collection it points into is the wrong one. The reverse holds too: a buyer's
 * cookie carries a `User` id, and `requireSupplier` refuses a subject that is
 * not a live supplier.
 *
 * The two cookies coexist in one browser, which is what a Cellvix employee who
 * is also testing the portal actually needs.
 *
 * **A supplier who is not `isActive` cannot sign in.** Deactivating a supplier
 * is how the purchasing team ends a relationship, and it already means "raise
 * no purchase orders against this one" everywhere else. It has to close the
 * door as well, or a supplier we stopped working with keeps reading requests
 * for quote.
 */

const SUPPLIER_COOKIE = `${env.COOKIE_NAME}_supplier`;
const SESSION_DAYS = 30;
/** How long an invite or reset link stays good. Days, not an hour: a supplier's
 *  purchasing inbox is not watched the way a consumer's is. */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SIGN_IN_FAILED = [
  'That email and password do not match a supplier account.',
  'SUPPLIER_CREDENTIALS_INVALID',
];

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueSession(res, supplier) {
  const token = jwt.sign(
    { sub: supplier._id.toString(), kind: 'supplier' },
    env.JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` },
  );

  res.cookie(SUPPLIER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSupplierSession(res) {
  res.clearCookie(SUPPLIER_COOKIE, { path: '/' });
}

/** The shape the portal gets. Never the hash, never another supplier's anything. */
function shapePortalSupplier(supplier) {
  return {
    id: supplier._id.toString(),
    name: supplier.name,
    code: supplier.code ?? null,
    email: supplier.email ?? null,
    contactName: supplier.contactName ?? null,
    phone: supplier.phone ?? null,
    componentTypes: supplier.componentTypes ?? [],
    paymentTerms: supplier.paymentTerms,
    lastLoginAt: supplier.portalLastLoginAt ?? null,
  };
}

/**
 * Mint credentials and email them.
 *
 * Called when a supplier is created with an email, and by the admin's **Resend
 * portal link** button. Both paths generate a **fresh password** — the stored
 * value is a bcrypt hash, so the previous one cannot be read back out to be
 * re-sent, and pretending otherwise would mean keeping a plaintext copy for the
 * sake of a button.
 *
 * Never throws on a mail failure: the credential is already written, and the
 * result says whether the message got out so the admin screen can report
 * "saved, but the email did not send" rather than a lie in either direction.
 */
async function invitePortal(supplierId) {
  const supplier = await Supplier.findById(supplierId).select('+passwordHash');
  if (!supplier) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');

  if (!supplier.email) {
    throw ApiError.badRequest(
      `${supplier.name} has no email address, so there is nowhere to send the portal link.`,
      'SUPPLIER_NO_EMAIL',
    );
  }
  if (!supplier.isActive) {
    throw ApiError.badRequest(
      `${supplier.name} is inactive — activate them before sending portal access.`,
      'SUPPLIER_INACTIVE',
    );
  }

  const password = generatePassword();
  supplier.passwordHash = await bcrypt.hash(password, 10);
  supplier.portalInviteAt = new Date();
  // Any half-finished reset is void once a new password exists.
  supplier.portalTokenHash = undefined;
  supplier.portalTokenAt = undefined;
  await supplier.save();

  const mail = await sendSupplierPortalInvite({ supplier, password });

  return {
    supplier: shapePortalSupplier(supplier),
    invitedAt: supplier.portalInviteAt,
    delivered: mail.delivered,
    error: mail.error ?? null,
  };
}

/**
 * Sign in.
 *
 * One error for every failure — unknown email, wrong password, no portal access
 * yet — because the alternative tells an outsider which of our suppliers have
 * accounts. `isActive` is the exception in spirit but not in message: it also
 * answers with the same line.
 */
async function login({ email, password }, res) {
  const supplier = await Supplier.findOne({
    email: String(email ?? '').toLowerCase().trim(),
  }).select('+passwordHash');

  const hash = supplier?.passwordHash;
  // Compared even when there is no supplier, against a hash that cannot match,
  // so a missing account and a wrong password take the same time to answer.
  const ok = await bcrypt.compare(
    String(password ?? ''),
    hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
  );

  if (!supplier || !hash || !ok || !supplier.isActive) {
    throw ApiError.unauthorized(...SIGN_IN_FAILED);
  }

  supplier.portalLastLoginAt = new Date();
  await supplier.save();

  issueSession(res, supplier);
  return { supplier: shapePortalSupplier(supplier) };
}

function logout(res) {
  clearSupplierSession(res);
  return { ok: true };
}

/** A supplier changing their own password. Requires the current one. */
async function changePassword(supplierId, { currentPassword, password }) {
  const supplier = await Supplier.findById(supplierId).select('+passwordHash');
  if (!supplier) throw ApiError.notFound('Supplier not found.', 'SUPPLIER_NOT_FOUND');

  const ok = await bcrypt.compare(String(currentPassword ?? ''), supplier.passwordHash ?? '');
  if (!ok) {
    throw ApiError.badRequest('That is not your current password.', 'PASSWORD_INCORRECT');
  }

  supplier.passwordHash = await bcrypt.hash(password, 10);
  await supplier.save();
  return { ok: true };
}

/**
 * "I forgot my password", from the portal's own sign-in page.
 *
 * Answers the same way whether or not the email matches, for the reason the
 * buyer-side reset does: the response must not be a way to enumerate which
 * businesses supply Cellvix.
 */
async function requestReset(email) {
  const supplier = await Supplier.findOne({
    email: String(email ?? '').toLowerCase().trim(),
    isActive: true,
  });
  if (!supplier || !supplier.passwordHash) return { ok: true };

  const token = crypto.randomBytes(32).toString('base64url');
  supplier.portalTokenHash = hashToken(token);
  supplier.portalTokenAt = new Date(Date.now() + TOKEN_TTL_MS);
  await supplier.save();

  const origin = env.publicOrigin;
  await sendSupplierResetEmail({
    supplier,
    link: `${origin}/supplier/reset?token=${encodeURIComponent(token)}`,
    expiresDays: Math.round(TOKEN_TTL_MS / (24 * 60 * 60 * 1000)),
  });

  return { ok: true };
}

/** Redeem a reset token. Single-use: the token is cleared on success. */
async function resetPassword({ token, password }) {
  const supplier = await Supplier.findOne({ portalTokenHash: hashToken(String(token ?? '')) })
    .select('+portalTokenHash +portalTokenAt +passwordHash');

  if (!supplier || !supplier.portalTokenAt || supplier.portalTokenAt.getTime() < Date.now()) {
    throw ApiError.badRequest(
      'That link has expired. Ask us to send a new one.',
      'RESET_TOKEN_INVALID',
    );
  }

  supplier.passwordHash = await bcrypt.hash(password, 10);
  supplier.portalTokenHash = undefined;
  supplier.portalTokenAt = undefined;
  await supplier.save();

  return { ok: true };
}

export {
  SUPPLIER_COOKIE,
  changePassword,
  clearSupplierSession,
  invitePortal,
  login,
  logout,
  requestReset,
  resetPassword,
  shapePortalSupplier,
};
