import mongoose from 'mongoose';

import { controlDb, dbFor } from './connections.js';
import { currentConnection } from './context.js';

/**
 * The model registry — every collection, bound to the right database.
 *
 * **Schemas are read back off the already-compiled models rather than exported
 * from each model file.** `mongoose.model('Order').schema` is the same object
 * the file built, so binding it to another connection needs no change to any of
 * the 35 model files — and, more usefully, none of them can drift out of step
 * with a parallel list of schema exports. Several files define three or four
 * schemas (sub-documents for lines, addresses, hours); only the compiled one
 * matters, and this finds it without anybody deciding which.
 *
 * ## Which database holds what (SAAS_PLATFORM §4.1)
 *
 * **Control plane** — what *describes* businesses. A business database holding
 * these would be circular: the record naming a business cannot live inside the
 * thing it names.
 *
 * **Per-business** — everything else. Including `User`, `Product` and
 * `Taxonomy`: a repair shop's parts list has nothing to do with a wholesaler's,
 * and a customer belongs to the business they buy from.
 *
 * `AuditLog` is per-business on purpose. SAAS_PLATFORM invariant 9 requires an
 * impersonation to be written into *the target business's own* trail, where its
 * owner reads it; a central audit collection would put every tenant's history
 * in one place, which is the opposite of what that asks for.
 */

/** Lives in the control plane. Everything not named here is per-business. */
const CONTROL_MODELS = new Set([
  'Tenant',
  'Plan',
  'SuperAdmin',
  'Business',
  'ImpersonationGrant',
  // A support conversation is about the account, outlives any one business, and
  // must stay readable while the tenant is suspended — which is exactly when
  // they most need to reach us.
  'SupportThread',
]);

/** `connection -> { modelName: Model }`, so a schema is compiled once per database. */
const cache = new WeakMap();

/**
 * Bind one model name to one connection.
 *
 * `connection.model(name)` with no schema returns an already-bound model, and
 * with a schema compiles one. Asking for the existing one first avoids
 * recompiling on every call and keeps Mongoose's own registry authoritative.
 */
function bind(connection, name) {
  try {
    return connection.model(name);
  } catch {
    // Not yet compiled on this connection — build it from the default's schema.
    const { schema } = mongoose.model(name);
    return connection.model(name, schema);
  }
}

/**
 * Every model, bound to the database that should hold it.
 *
 * Returns a `Proxy` rather than an eagerly-built object: there are 35 models and
 * a given request touches two or three, so binding them all on every call would
 * be work nobody asked for. The proxy also means `db().Order` reads exactly
 * like the import it replaces.
 */
function modelsFor(connection) {
  const target = connection ?? mongoose.connection;

  let bound = cache.get(target);
  if (!bound) {
    bound = {};
    cache.set(target, bound);
  }

  return new Proxy(bound, {
    get(store, name) {
      if (typeof name !== 'string') return undefined;
      if (store[name]) return store[name];

      // A control-plane model ignores the business connection entirely: a
      // `Tenant` is the same record whichever business is being served.
      const home = CONTROL_MODELS.has(name) ? controlDb() : target;
      const model = bind(home, name);
      store[name] = model;
      return model;
    },
    has(store, name) {
      return typeof name === 'string' && (name in store || Boolean(mongoose.models[name]));
    },
  });
}

/**
 * The models for the business this request is about.
 *
 * **The one call a service makes.** `const { Order } = db();` replaces
 * `import Order from '../models/Order.js'`, and everything else about the
 * service stays as it was.
 *
 * Outside a request there is no context, and the default connection is the
 * honest answer rather than an error — a seed script writing to the database it
 * was pointed at is doing exactly what it should. `runInBusiness` is how a
 * script opts into a specific one.
 */
function db() {
  return modelsFor(currentConnection());
}

/** The control plane's models, whatever business the request is about. */
function controlModels() {
  return modelsFor(controlDb());
}

export { CONTROL_MODELS, controlModels, db, dbFor, modelsFor };
