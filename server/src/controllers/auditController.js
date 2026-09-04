import { asyncHandler } from '../utils/ApiError.js';
import auditService from '../services/auditService.js';

/**
 * The two log screens (§6.15, category 6, phase 11b).
 *
 * **Read-only, and that is the whole surface.** There is no create, no update
 * and no delete — not hidden, not gated, simply absent. §6.15 says neither log
 * is ever deletable from the UI, and a log its subject can prune is not
 * evidence of anything. Rows are written as a side effect of the operations
 * being logged, through `auditService.record`, never through a route.
 *
 * **`kind` is decided here, never by the caller.** The security log is
 * admin-only and the activity log is not, so a client-supplied `kind` would be
 * a query parameter that escalates privilege — `?kind=security` on the activity
 * route would hand a staff account the sign-in failures.
 */

const activity = asyncHandler(async (req, res) => {
  res.json(await auditService.list({ ...req.query, kind: 'activity' }));
});

/**
 * Admin-only, enforced on the route (§6.15).
 *
 * Sign-in failures name accounts and addresses — precisely the material that
 * helps somebody who is guessing at them — so this is not something a
 * `settings: view` role should be able to read.
 */
const security = asyncHandler(async (req, res) => {
  res.json(await auditService.list({ ...req.query, kind: 'security' }));
});

export { activity, security };
