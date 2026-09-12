/**
 * Which business this request is about.
 *
 * **This was `outletScope`.** Same two rules, one much larger consequence: an
 * outlet filter that was forgotten showed one shop's rows under another shop of
 * the same business. A business filter that is forgotten shows **another
 * business's records entirely** — its customers, its invoices, its margins.
 *
 * §4.1 specified database-per-business precisely so that could not happen, and
 * that ruling was reversed on 2026-09-11 in favour of shipping. So the
 * guarantee is no longer structural, and this file is where it now lives:
 *
 *   **Every query that reads records for a screen must spread
 *   `businessFilter(req)`.** Not most of them. A `Model.find({ status })`
 *   without it is a leak, and it will not announce itself — the rows simply
 *   look like more data than expected.
 *
 * Two inputs, and the order matters because one is a permission and the other
 * is only a view:
 *
 *   1. **A staff account's own business is binding.** `User.business` scopes
 *      what a staff member may see, so it wins outright. A staff member cannot
 *      widen their view by sending a different `?business=`, which is the whole
 *      point of scoping them.
 *
 *   2. **An admin's `?business=` is a filter they chose.** Admins see
 *      everything by default and narrow it with the top-bar switcher. Absent or
 *      `all` means no filter, which is the honest reading of "All businesses".
 *
 * The result lands on `req.businessScope` as an id or null. `null` means "do
 * not filter" and is deliberately the same value as "no business chosen" — a
 * query builder can then spread the filter unconditionally.
 *
 * **This middleware only reads.** It never rejects: a staff member asking for
 * another business is not attacking anything, they are usually just carrying a
 * stale query string from a bookmark, and the right answer is to show them
 * their own business rather than an error page.
 */
function resolveBusinessScope(req, _res, next) {
  const user = req.user;

  /**
   * A support session is pinned to the business its grant names.
   *
   * **This is a containment boundary, not a convenience.** A platform operator
   * who could edit `?business=` would reach every business on the installation
   * from a grant issued for one — and the audit trail would record the actions
   * in the business they entered, not the one they actually touched. The pin is
   * set by `authenticateImpersonation`, which runs first; honouring it here is
   * the half that makes it stick.
   */
  if (req.businessScopePinned) return next();

  // Staff are pinned to their own business, whatever the query says.
  if (user?.role === 'staff' && user.business) {
    req.businessScope = String(user.business);
    return next();
  }

  const requested = String(req.query.business ?? '').trim();

  if (requested && requested !== 'all') {
    req.businessScope = requested;
    return next();
  }

  /**
   * Nothing asked for — keep whatever `resolveBusiness` worked out.
   *
   * **This used to null the scope**, which was correct while `?business=` was
   * the only source: absent meant "all businesses". Now the host resolves a
   * business before authentication (§4.2), so overwriting here would throw away
   * the storefront's business on every request that happens not to carry a
   * query string — which is all of them.
   *
   * `all` still clears it, because that is a deliberate request for the
   * unscoped view rather than an absent answer.
   */
  if (requested === 'all') {
    req.businessScope = null;
    return next();
  }

  req.businessScope = req.businessScope ?? null;
  return next();
}

/**
 * The Mongo filter for the current scope, as an object to spread into a query.
 *
 * Returns `{}` when nothing is scoped, so callers can write
 * `{ ...businessFilter(req), status: 'open' }` without branching.
 *
 * **An exact match, deliberately.** The tempting alternative is to also match
 * `business: null` so that anything unassigned stays visible — but that leaks:
 * every unassigned record would appear under *every* business, so switching to
 * one would show another's history and the figures would not add up.
 * `backfill:business` is what makes exactness safe; it stamps the pre-scoping
 * rows onto the default business, and it is idempotent so it can be re-run if
 * an old code path ever writes another null.
 */
function businessFilter(req) {
  const scope = req?.businessScope;
  if (!scope) return {};
  return { business: scope };
}

export { resolveBusinessScope, businessFilter };
export default resolveBusinessScope;
