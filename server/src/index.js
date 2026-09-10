import env from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { isDatabaseEmpty } from './seed/run.js';
import { ensureBuiltInRoles, ensureDefaultBusiness } from './services/accessService.js';
import { ensureBuiltInRules } from './models/InvoiceStatusRule.js';

/**
 * Everything boots inside `main` rather than at module scope.
 *
 * The sequence is order-dependent — the database must be connected before the
 * role and business upserts run, and those must finish before the app listens —
 * so it is kept in one async function with explicit `await`s and a single
 * failure path, rather than spread across top-level awaits.
 */
async function main() {
  await connectDb();

  // The built-in roles and the default business are established at boot, not only
  // by the seed.
  //
  // Both are **additive upserts** — they create what is missing and touch nothing
  // else — which is what makes them safe here when `seedDatabase` is not: seeding
  // wipes, these do not. Leaving them to the seed alone meant any database that
  // was populated before phase 8 had zero roles and no default business, so the
  // Roles screen rendered empty, no staff account could be created, and an
  // unattributed stock movement had nowhere to land. A durable database must not
  // have to be wiped to gain a table of constants.
  try {
    await ensureBuiltInRoles();
    await ensureDefaultBusiness();
    // Same reasoning, phase 11d: the built-in invoice messages are constants, and
    // all four ship inactive, so creating them sends nobody anything.
    await ensureBuiltInRules();
  } catch (error) {
    // Never fatal: the API is still useful without them, and crashing the server
    // over a bootstrap upsert would turn a missing role into an outage.
    console.warn(`  Access bootstrap skipped — ${error.message}`);
  }

  // Seeding is never automatic: `seedDatabase` wipes products, users, orders and
  // invoices, which must not happen on the boot of a durable database. Say so
  // clearly instead, so an empty catalogue is not mistaken for a query bug.
  if (await isDatabaseEmpty()) {
    console.warn(
      '\n  This database has no products. Run `npm run seed` to populate it' +
        '\n  (it WIPES taxonomy, products, users, orders and invoices first).\n',
    );
  }

  const app = createApp();

  // Passenger assigns the port and passes it in the environment; `env.PORT`
  // reads it. Never hardcode one here — a literal port binds a socket Passenger
  // is not proxying to, and every request 502s.
  const server = app.listen(env.PORT, () => {
    console.log(`  Cellvix API listening on port ${env.PORT}\n`);
  });

  // Node's own keep-alive timeout is 5s — exactly the idle timeout of the agent
  // that Vite's dev proxy (and most reverse proxies, Passenger included) pool
  // sockets with. When both sides expire together the proxy writes a request
  // onto a socket the server is already closing, and the browser sees
  // `read ECONNRESET` instead of a response. Outliving the client's idle window
  // keeps that decision on the client side, where it belongs.
  server.keepAliveTimeout = 65_000;
  // Must stay above keepAliveTimeout, or headers time out on a still-valid socket.
  server.headersTimeout = 66_000;

  async function shutdown(signal) {
    console.log(`\n  ${signal} received, shutting down.`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// A failed boot must exit non-zero, not hang as a half-started process that
// Passenger keeps restarting into the same wall. The message is what shows up
// in the app's stderr log.
main().catch((error) => {
  console.error(`\n  Cellvix API failed to start: ${error.message}\n`);
  console.error(error);
  process.exit(1);
});
