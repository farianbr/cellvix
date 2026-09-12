import Business from '../models/Business.js';
import { dbFor } from '../db/connections.js';
import { runInBusiness } from '../db/context.js';

/**
 * Open the business's database for the rest of this request (SAAS_PLATFORM §4.1).
 *
 * **Everything downstream runs inside `runInBusiness`**, so every service the
 * request reaches — however many `await`s deep — reads the same connection from
 * async-local context without being handed one. That is the whole point of the
 * seam: 586 service functions keep their signatures.
 *
 * **Mounted after business scope and before the routes.** It needs
 * `req.businessScope` to know which business, and it must wrap the route
 * handlers rather than run beside them, because `next()` called inside
 * `runInBusiness` is what puts the rest of the stack inside the context.
 *
 * The business's **code** is what names a database, so this reads one document
 * to turn an id into a code. Cached on the request; while the split is off
 * `dbFor` ignores the code anyway and answers with the default connection.
 */

/** id -> code. Codes do not change, so this never needs invalidating. */
const codes = new Map();

async function codeFor(businessId) {
  if (!businessId) return null;

  const key = String(businessId);
  if (codes.has(key)) return codes.get(key);

  const business = await Business.findById(key).select('code').lean();
  const code = business?.code ?? null;
  // Cached even when null: a request naming a business that does not exist
  // should not re-read the collection on every retry.
  codes.set(key, code);
  return code;
}

async function openBusinessDb(req, _res, next) {
  try {
    const code = await codeFor(req.businessScope);

    /**
     * `next()` inside the context, not after it.
     *
     * Calling `next()` outside and then opening the context would put the
     * context around nothing — Express would have already moved on. Wrapping it
     * is what makes every downstream handler and service inherit the
     * connection.
     */
    return runInBusiness(
      { businessId: req.businessScope ?? null, code, connection: dbFor(code) },
      () => next(),
    );
  } catch (error) {
    /**
     * A lookup failure must not take the product down.
     *
     * With the split off, `dbFor(null)` is the default connection and the
     * request works exactly as it did before this middleware existed — so
     * carrying on is strictly better than a 500. Once the split is on this
     * becomes a real failure and will need to refuse instead; that change
     * belongs with the flip, not before it.
     */
    console.error(`  Business DB: could not resolve — ${error.message}`);
    return next();
  }
}

/** Forget the id→code cache. For tests, and after a business is renamed. */
function resetCodeCache() {
  codes.clear();
}

export { openBusinessDb, resetCodeCache };
export default openBusinessDb;
