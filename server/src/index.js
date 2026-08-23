import env from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { isDatabaseEmpty } from './seed/run.js';

await connectDb();

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

const server = app.listen(env.PORT, () => {
  console.log(`  Cellvix API listening on http://localhost:${env.PORT}\n`);
});

// Node's own keep-alive timeout is 5s — exactly the idle timeout of the agent
// that Vite's dev proxy (and most reverse proxies) pool sockets with. When both
// sides expire together the proxy writes a request onto a socket the server is
// already closing, and the browser sees `read ECONNRESET` instead of a
// response. Outliving the client's idle window keeps that decision on the
// client side, where it belongs.
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
