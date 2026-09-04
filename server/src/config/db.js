import mongoose from 'mongoose';
import env from './env.js';

let shuttingDown = false;

/**
 * Connects to MongoDB.
 *
 * `MONGODB_URI` is required and validated in `env.js` — there is deliberately no
 * in-memory fallback (PROJECT_INSTRUCTIONS.md §8). One that re-seeds on every
 * boot mints new ObjectIds for every user and product, so a live session cookie
 * still passes `jwt.verify` but no longer resolves to a user: every signed-in
 * request becomes a silent 401 and every cart is orphaned. That reads as an
 * authentication bug and is not one, so the convenience is not worth it.
 */
async function connectDb() {
  mongoose.set('strictQuery', true);

  // A remote cluster drops connections in ways a local mongod never did: laptop
  // sleep, a Wi-Fi change, an Atlas IP allowlist that no longer covers this
  // address. Mongoose retries on its own but says nothing, which turns a dropped
  // link into requests that just hang. Attach before connecting so a failure
  // during the initial handshake is logged too.
  mongoose.connection.on('error', (error) => {
    console.error(`  MongoDB error: ${error.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    // A deliberate shutdown fires this too; only an unexpected drop is news.
    if (!shuttingDown) console.warn('  MongoDB disconnected — mongoose will keep retrying.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('  MongoDB reconnected.');
  });

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });

  const { host, name } = mongoose.connection;
  console.log(`  MongoDB connected: ${host}/${name}`);

  return mongoose.connection;
}

async function disconnectDb() {
  shuttingDown = true;
  await mongoose.disconnect();
}

export { connectDb, disconnectDb };
