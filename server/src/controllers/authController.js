const { asyncHandler } = require('../utils/ApiError.js');
const authService = require('../services/authService.js');
const auditService = require('../services/auditService.js');
const { default: Role, PERMISSION_AREAS } = require('../models/Role.js');

/**
 * The session shape, plus the resolved permission map for Cellvix staff.
 *
 * The map is sent so the panel can hide what a role cannot reach — a courtesy,
 * never the control (§7.6). `requirePermission` decides for real on every
 * request, so a client that ignores this learns nothing and gains nothing.
 *
 * An admin gets every area at full rather than a null: the sidebar then has one
 * shape to read instead of two, and "admin bypasses the map" stays a server
 * concern.
 */
async function sessionUser(user) {
  if (!user) return null;
  const shape = user.toPublic();

  if (user.role === 'admin') {
    shape.permissions = PERMISSION_AREAS.reduce((out, a) => ({ ...out, [a]: 'full' }), {});
    return shape;
  }

  if (user.role === 'staff' && user.staffRole) {
    const role = await Role.findById(user.staffRole).lean();
    shape.permissions = role
      ? PERMISSION_AREAS.reduce((out, a) => ({ ...out, [a]: role.areas?.[a] ?? 'none' }), {})
      : null;
    shape.staffRoleName = role?.name ?? null;
  }

  return shape;
}

const register = asyncHandler(async (req, res) => {
  // The IP is recorded with the CASL consent, so it is read here — only the
  // request knows it, and the service must not reach for `req` (§6.13).
  const user = await authService.register(req.body, { ip: req.ip });
  // Deliberately no session: sign-up does not grant access until an admin
  // approves the business (brief §8.2).
  res.status(201).json({
    user: user.toPublic(),
    message:
      'Thanks for signing up — your account is pending admin approval. We will email you once it is verified.',
  });
});

/**
 * Sign in, and record the attempt either way (§6.15, Security Log).
 *
 * **Both outcomes are logged.** A security log that only records successes
 * answers the least interesting question — the failures are what show somebody
 * working through a password list, and a lockout with no failures before it
 * reads as a system fault rather than an attack.
 *
 * The failure row is written and the original error is then re-thrown
 * unchanged: the caller must still get `INVALID_CREDENTIALS`, and the response
 * must not reveal whether the address exists.
 */
const login = asyncHandler(async (req, res) => {
  let user;
  try {
    user = await authService.login(req.body);
  } catch (error) {
    await auditService.recordSecurity({
      req,
      action: `auth.login_${error.code === 'STAFF_LOCKED' ? 'locked' : 'failed'}`,
      entity: { kind: 'session', id: '', label: req.body?.email ?? '' },
      description:
        error.code === 'STAFF_LOCKED'
          ? `Sign-in refused for ${req.body?.email} — account is locked.`
          : `Failed sign-in for ${req.body?.email}.`,
      // Resolved without leaking anything: the row names the account when it
      // exists, while the response stays identical either way.
      subject: await authService.findForAudit(req.body?.email),
    });
    throw error;
  }

  authService.issueSession(res, user, req.body.remember);

  await auditService.recordSecurity({
    req,
    action: 'auth.login',
    entity: { kind: 'session', id: user._id.toString(), label: user.email },
    description: `${user.email} signed in.`,
    subject: user,
  });

  res.json({ user: await sessionUser(user) });
});

const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await auditService.recordSecurity({
      req,
      action: 'auth.logout',
      entity: { kind: 'session', id: req.user._id.toString(), label: req.user.email },
      description: `${req.user.email} signed out.`,
    });
  }

  authService.clearSession(res);
  res.status(204).end();
});

/**
 * Who is signed in, if anyone.
 *
 * A guest gets 200 with `user: null`, not 401. "Nobody is signed in" is a valid
 * answer to this question rather than a failure, and every visitor asks it on
 * first paint — answering with an error meant a red entry in the browser console
 * on every anonymous page load, which no client-side catch can suppress.
 */
const me = asyncHandler(async (req, res) => {
  res.json({ user: await sessionUser(req.user) });
});

const forgotPassword = asyncHandler(async (_req, res) => {
  // Always 204 — never reveal whether an address is registered.
  // TODO: wire to a transactional mail provider once the client picks one.
  res.status(204).end();
});

// --- CommonJS exports -------------------------------------------------
exports.register = register;
exports.login = login;
exports.logout = logout;
exports.me = me;
exports.forgotPassword = forgotPassword;
