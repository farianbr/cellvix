import ApiError from '../utils/ApiError.js';
import { IMPERSONATION_COOKIE, resolve } from '../services/impersonationService.js';

/**
 * The impersonation session — a fourth cookie (SAAS_PLATFORM §4.5).
 *
 * **`req.impersonation` is set; `req.user` is never touched.** That is the
 * decision this whole file rests on. Synthesising a `User` would have made
 * every existing guard pass for free — `requireAdmin`, `requireStaff`,
 * `requirePermission` — and the only thing standing between a platform operator
 * and any tenant route would be that nobody had thought about it. Instead the
 * guards learn about impersonation one at a time, in `auth.js`, where the
 * decision is visible next to the rule it bends.
 *
 * The cost is real and worth naming: a route that should admit an operator and
 * was never updated will refuse them. That failure is a support ticket. The
 * opposite failure — a route that admits an operator nobody intended to admit —
 * is a breach, and it is silent.
 *
 * **The grant is re-read from the database on every request**, not trusted from
 * the token. Revocation has to bite now rather than whenever the JWT happens to
 * expire, and `resolve` checks the grant's own `expiresAt` as well.
 */
async function authenticateImpersonation(req, res, next) {
  req.impersonation = null;

  const token = req.cookies?.[IMPERSONATION_COOKIE];
  if (!token) return next();

  const resolved = await resolve(token);
  if (!resolved) {
    // Expired, revoked, or minted for a deactivated operator. Clearing it stops
    // the browser presenting a dead token on every request for the rest of its
    // life, exactly as `authenticate` does for a dead session.
    res.clearCookie(IMPERSONATION_COOKIE, { path: '/' });
    return next();
  }

  req.impersonation = {
    grant: resolved.grant,
    superAdmin: resolved.superAdmin,
    business: resolved.business,
  };

  /**
   * The business is decided by the grant, not by the query string.
   *
   * An operator inside one business must not be able to reach another by
   * editing `?business=`. `resolveBusinessScope` runs after this and would
   * otherwise honour whatever was asked for, so the scope is pinned here and
   * that middleware leaves a pinned scope alone.
   */
  req.businessScope = resolved.business;
  req.businessScopePinned = true;

  return next();
}

/**
 * True when this request is a platform operator working inside a business.
 *
 * The one predicate every guard should ask, so the shape of the check lives in
 * a single place: the day impersonation gains a read-only mode, this is where
 * that distinction appears rather than in a dozen `req.impersonation?.x` tests
 * scattered through `auth.js`.
 */
function isImpersonating(req) {
  return Boolean(req?.impersonation?.superAdmin);
}

/** Refuses anybody who is not inside an impersonation grant. */
function requireImpersonation(req, _res, next) {
  if (!isImpersonating(req)) {
    return next(
      ApiError.unauthorized('No active support session.', 'IMPERSONATION_REQUIRED'),
    );
  }
  return next();
}

export { authenticateImpersonation, isImpersonating, requireImpersonation };
export default authenticateImpersonation;
