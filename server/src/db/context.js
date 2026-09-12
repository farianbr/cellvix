import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which business's database the current work belongs to.
 *
 * **This exists because services take scalars, not `req`.** Controllers unpack
 * a request into `(body, id, userId)` and hand those to a service, so there are
 * 586 service functions with no path for a connection to arrive through.
 * Threading one as an argument would mean changing every signature and every
 * call site — a mechanical diff whose risk is proportional to its volume rather
 * than its difficulty. Async-local storage carries it instead: the middleware
 * puts the connection in context once, and any service reads it with no
 * signature change at all.
 *
 * **The cost, stated plainly:** the dependency becomes implicit. A service
 * called outside a request — a seed script, a cron job, a queue worker — has no
 * context, and `runInBusiness` is how those supply one. `currentConnection()`
 * returning null is therefore a real state and not a bug, which is why the
 * model registry falls back to the default connection rather than throwing.
 *
 * Async-local context follows `await` chains, so a service that awaits three
 * layers deep still sees it. What it does *not* survive is work deliberately
 * detached from the request — a `setTimeout`, an unawaited promise that outlives
 * the response. Anything like that must capture the connection explicitly
 * before detaching.
 */

const storage = new AsyncLocalStorage();

/**
 * Run `fn` with a business connection in context.
 *
 * Everything `fn` awaits, however deep, reads this connection from
 * `currentConnection()`.
 */
function runInBusiness(context, fn) {
  return storage.run(context, fn);
}

/** The current context, or null outside a request. */
function currentContext() {
  return storage.getStore() ?? null;
}

/** The current business's connection, or null. */
function currentConnection() {
  return storage.getStore()?.connection ?? null;
}

/** The current business's id, or null. */
function currentBusinessId() {
  return storage.getStore()?.businessId ?? null;
}

export { currentBusinessId, currentConnection, currentContext, runInBusiness, storage };
