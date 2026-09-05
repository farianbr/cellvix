/**
 * Which outlet this request is about.
 *
 * Two inputs, and the order matters because one is a permission and the other
 * is only a view:
 *
 *   1. **A staff account's own outlet is binding.** `User.outlet` scopes what a
 *      staff member may see (§6.14), so it wins outright. A staff member cannot
 *      widen their view by sending a different `?outlet=`, which is the whole
 *      point of scoping them.
 *
 *   2. **An admin's `?outlet=` is a filter they chose.** Admins see everything
 *      by default and narrow it with the top-bar switcher. Absent or `all`
 *      means no filter, which is the honest reading of "All outlets".
 *
 * The result lands on `req.outletScope` as an id or null. `null` means "do not
 * filter" and is deliberately the same value as "no outlet chosen" — a query
 * builder can then spread the filter unconditionally.
 *
 * **This middleware only reads.** It never rejects: a staff member asking for
 * another outlet is not attacking anything, they are usually just carrying a
 * stale query string from a bookmark, and the right answer is to show them
 * their own outlet rather than an error page.
 */
function resolveOutletScope(req, _res, next) {
  const user = req.user;

  // Staff are pinned to their own outlet, whatever the query says.
  if (user?.role === 'staff' && user.outlet) {
    req.outletScope = String(user.outlet);
    return next();
  }

  const requested = String(req.query.outlet ?? '').trim();
  req.outletScope = requested && requested !== 'all' ? requested : null;
  return next();
}

/**
 * The Mongo filter for the current scope, as an object to spread into a query.
 *
 * Returns `{}` when nothing is scoped, so callers can write
 * `{ ...outletFilter(req), status: 'open' }` without branching.
 *
 * **An exact match, deliberately.** The tempting alternative is to also match
 * `outlet: null` so that anything unassigned stays visible — but that leaks:
 * every unassigned record would appear under *every* outlet, so switching to
 * one shop would show another's history and the figures would not add up.
 * `backfill-outlet.js` is what makes exactness safe; it stamps the pre-scoping
 * rows onto the original shop, and it is idempotent so it can be re-run if an
 * old code path ever writes another null.
 */
function outletFilter(req) {
  const scope = req?.outletScope;
  if (!scope) return {};
  return { outlet: scope };
}

export { resolveOutletScope, outletFilter };
export default resolveOutletScope;
