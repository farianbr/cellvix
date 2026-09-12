import Business from '../models/Business.js';

/**
 * Which business this request is for, decided before anybody signs in
 * (SAAS_PLATFORM §4.2).
 *
 * **This is the prerequisite for per-business `User`.** A buyer signs in at the
 * storefront before any business is known, so authentication cannot resolve the
 * business — the business has to be resolved first, and `authenticate` then
 * looks the account up in *that* business's database. Until this existed,
 * `businessScope` was read from `?business=` on admin requests only, which is
 * why the storefront carried no business at all.
 *
 * ## Resolution order, most explicit first
 *
 * 1. **An impersonation grant.** Already pinned by `impersonationAuth`, and it
 *    outranks everything: an operator inside one business must not reach
 *    another by editing a host header or a query string.
 * 2. **`X-Business` header.** Development and internal tooling. Trusted because
 *    it is *not* an authorisation — it selects which business to serve, and
 *    every permission check still runs inside it.
 * 3. **Custom domain**, then **subdomain** — how production actually routes.
 * 4. **`?business=` query** — the admin panel's switcher.
 * 5. **The single business**, when the installation has exactly one.
 *
 * **There is no "default tenant" fallback.** §4.2 is explicit, and the reason is
 * worth keeping in front of whoever edits this next: a fallback means a request
 * that resolves to nothing quietly serves *somebody's* data. Better to serve
 * none and say so.
 *
 * The one deliberate exception is an installation with a single business, where
 * "which one" has only one answer — that is not a guess, and it is what keeps a
 * one-business deployment from needing DNS to function.
 */

/** host -> business id. Domains change rarely; a miss costs one indexed read. */
const byHost = new Map();
/** How many businesses exist, cached — it decides the single-business shortcut. */
let businessCount = null;

/** `shop.example.com` -> `shop`. Null when the host has no meaningful label. */
function subdomainOf(host) {
  const name = String(host ?? '')
    .toLowerCase()
    .split(':')[0]
    .trim();

  if (!name) return null;
  // An IP address or a bare `localhost` names no business.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return null;

  const parts = name.split('.');
  if (parts.length < 3) return null;

  const label = parts[0];
  // `www` is the site, not a tenant.
  if (label === 'www') return null;
  return label;
}

async function countBusinesses() {
  if (businessCount !== null) return businessCount;
  businessCount = await Business.countDocuments({ deletedAt: null });
  return businessCount;
}

/**
 * Look a host up, cached.
 *
 * Matches a custom domain first and a slug-shaped subdomain second, because a
 * business that has bought a domain means it more than it means its original
 * handle.
 */
async function businessForHost(host) {
  if (!host) return null;

  const key = String(host).toLowerCase();
  if (byHost.has(key)) return byHost.get(key);

  const bare = key.split(':')[0];
  const sub = subdomainOf(key);

  const found = await Business.findOne({
    deletedAt: null,
    $or: [
      { domain: bare },
      ...(sub ? [{ slug: sub }, { code: sub }] : []),
    ],
  })
    .select('_id')
    .lean();

  const id = found ? String(found._id) : null;
  // Cached even when null, so a request for an unknown host does not re-read
  // the collection on every retry.
  byHost.set(key, id);
  return id;
}

async function resolveBusiness(req, _res, next) {
  try {
    // 1. An impersonation grant already decided, and it is not negotiable.
    if (req.businessScopePinned && req.businessScope) return next();

    // 2. An explicit header — development, tooling, and the smoke suite.
    const header = req.get('x-business');
    if (header) {
      req.businessScope = header;
      return next();
    }

    // 3. The host, which is how production routes.
    const fromHost = await businessForHost(req.get('host'));
    if (fromHost) {
      req.businessScope = fromHost;
      return next();
    }

    // 4. The admin switcher. Left for `resolveBusinessScope` to apply, since it
    //    also enforces that a staff member cannot widen their own scope.
    const requested = String(req.query.business ?? '').trim();
    if (requested && requested !== 'all') {
      req.businessScope = requested;
      return next();
    }

    /**
     * 5. One business, one answer.
     *
     * Not a fallback: where exactly one business exists there is nothing to
     * choose between, and requiring DNS to serve a single-business install
     * would make the common case the hardest one. With two or more, this stays
     * null and the request is unscoped — which the admin panel treats as "pick
     * one" rather than "show everything" once §4.2 lands in full.
     */
    if ((await countBusinesses()) === 1) {
      const only = await Business.findOne({ deletedAt: null }).select('_id').lean();
      req.businessScope = only ? String(only._id) : null;
      return next();
    }

    /**
     * 6. The default business, when nothing else named one.
     *
     * **Not the "default tenant" fallback §4.2 forbids.** That rule is about
     * resolving a *tenant* from an ambiguous host — serving somebody's account
     * because the request could not be placed. This is narrower and already
     * decided: `Business.isDefault` is the single business designated as where
     * an unattributed record lands, enforced to be exactly one, and it is the
     * same answer the seed, the order builder and the admin switcher all use.
     *
     * Without it the storefront had no business at all on a host that names
     * none — which is every request on `localhost` once a second business
     * exists. The catalogue read the control database, found no products, and
     * `buyer@cellvix.ca` could not sign in because their account lives in
     * Cellvix's database rather than in the control plane. The site was, in
     * effect, off.
     *
     * In production the host resolves this long before it is reached; this is
     * what keeps development and a single-domain deployment working.
     */
    const fallback = await Business.findOne({ isDefault: true, deletedAt: null })
      .select('_id')
      .lean();

    req.businessScope = req.businessScope ?? (fallback ? String(fallback._id) : null);
    return next();
  } catch (error) {
    // Resolution failing must not take the site down: the request continues
    // unscoped, exactly as it did before this middleware existed.
    console.error(`  Business resolution failed — ${error.message}`);
    return next();
  }
}

/** Forget the host and count caches. After a domain change, and for tests. */
function resetBusinessResolution() {
  byHost.clear();
  businessCount = null;
}

export { resolveBusiness, resetBusinessResolution, subdomainOf };
export default resolveBusiness;
