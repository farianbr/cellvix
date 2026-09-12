import mongoose from 'mongoose';

import env from '../config/env.js';

/**
 * One database per business (SAAS_PLATFORM §4.1).
 *
 * **One client, many databases.** `connection.useDb()` does not open a socket
 * or perform a handshake — it returns a handle onto the same pool pointed at a
 * different database name. So "a database per business" costs a `Map` entry per
 * business rather than a connection per business, and an installation with two
 * hundred tenants is not two hundred TCP connections.
 *
 * **Why this is worth doing at all.** Businesses were separated by a `business`
 * field filtered per query, and CLAUDE.md is explicit about what that costs: a
 * query that forgets `businessFilter(req)` is a cross-business leak rather than
 * a cosmetic bug. Auditing found that filter applied at six call sites out of
 * hundreds. Under database-per-business a forgotten filter returns that
 * business's own rows, because there is nowhere else to look — the guarantee
 * stops depending on every future author remembering.
 *
 * **Every business record read or written goes through `dbFor`.** There is no
 * mode in which it does not: the migration flag that once made this a no-op was
 * removed once the split went live, because a per-process flag deciding which
 * database a script writes to is a silent wrong answer waiting to happen.
 */

/** `<prefix>_control` — tenants, plans, super admins, businesses, grants. */
function controlDbName() {
  return `${env.DB_PREFIX}_control`;
}

/**
 * `<prefix>_biz_<code>` — one business's records.
 *
 * Keyed on the business **code** rather than its ObjectId: a code is short,
 * stable and legible, so an operator reading a database list can tell which
 * business they are looking at. An id would be correct and unreadable.
 */
function businessDbName(code) {
  const safe = String(code ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!safe) throw new Error('A business needs a code before it can have a database.');
  return `${env.DB_PREFIX}_biz_${safe}`;
}

/**
 * **The split is always on. There is no flag.**
 *
 * There was one — `DB_SPLIT` — and it earned its place while the seam was being
 * built: it let the plumbing land across forty files without changing a single
 * behaviour, so each step could be proven against an unchanged application.
 *
 * It stopped being a safety feature the moment the flip happened. Because it
 * was read from the environment at import time, it was a property of the
 * *process* rather than of the database — so a script started without it read a
 * different database than the server, silently and with no error. That is not a
 * hypothetical: the smoke teardown reported "removed 0" twice while the records
 * it was written to clear sat untouched in the business database beside it.
 *
 * Rolling back would mean re-seeding either way, so the flag bought nothing and
 * cost a whole class of silent wrong answers. Removed.
 */

/** Handles are cached: `useDb` is cheap, but not free, and this runs per request. */
const handles = new Map();

function handleFor(name) {
  const existing = handles.get(name);
  if (existing) return existing;

  // `useCache` lets Mongoose keep its own handle too, so two callers asking for
  // the same database share one.
  const handle = mongoose.connection.useDb(name, { useCache: true });
  handles.set(name, handle);
  return handle;
}

/**
 * The connection for one business.
 *
 * Takes the business's code.
 */
function dbFor(code) {
  // No code means no business — an unassigned record, or a request that never
  // resolved one. The control database is the honest answer there rather than a
  // guess at which business was meant.
  if (!code) return mongoose.connection;
  return handleFor(businessDbName(code));
}

/**
 * The control plane's connection.
 *
 * Tenants, plans, super admins, businesses and impersonation grants live here
 * and never in a business database — they are what *describes* businesses, so a
 * business database holding them would be circular.
 *
 * **This is the database `MONGODB_URI` names, split or not.** The alternative —
 * moving the control plane to `<prefix>_control` when the split turns on —
 * looked tidier and was wrong: the connection string already points somewhere,
 * and quietly reading a *different* database than the one an operator
 * configured is how a migration runner reports "1 database checked" against an
 * empty collection while the real one sits untouched beside it. Which is
 * exactly what it did.
 *
 * `controlDbName()` therefore describes the naming convention for a fresh
 * installation; it is not used to redirect an existing one.
 */
function controlDb() {
  return mongoose.connection;
}

/** Forget every cached handle. For tests and for a deliberate reconnect. */
function resetHandles() {
  handles.clear();
}

export {
  businessDbName,
  controlDb,
  controlDbName,
  dbFor,
  resetHandles,
};
