import { connectDb, disconnectDb } from '../config/db.js';
import { db } from '../db/models.js';
import '../models/Quote.js';
import '../models/Order.js';
import '../models/User.js';
import '../models/Product.js';
import '../models/Settings.js';
import { buildQuotes } from './sales.data.js';

/**
 * Demo quotes, added to a database that already has real data.
 *
 * **Additive, like `seed:content` — it never wipes.** `npm run seed` rebuilds
 * the whole database from scratch, which is the wrong tool for "give me some
 * quotes to look at" on an instance that already holds accounts and orders
 * somebody is using. This adds rows and leaves everything else alone.
 *
 * Quote numbers continue from whatever is already there rather than restarting
 * at 1, so running it twice does not collide on the unique index — and it
 * refuses to run at all against a database with no approved buyer or no
 * catalogue, because a quote is priced *for an account* and a quote with no
 * lines teaches the screen nothing.
 *
 * Pricing comes from `buildQuotes`, the same builder the full seed uses, which
 * computes totals exactly as `quoteService.recomputeTotals` does. Duplicating
 * that arithmetic here is how a seeded quote ends up disagreeing with one the
 * running code would produce.
 */

/**
 * The one state `buildQuotes` cannot produce on its own.
 *
 * `converted` means a real order came out of the quote, so it needs an order to
 * point at — the builder runs before orders exist in the full seed, and a
 * `convertedOrder` pointing at nothing would render a broken link on the row
 * the client's screenshots show. It is added here, where orders are already in
 * the database.
 */
async function attachConverted(quote, order) {
  return {
    ...quote,
    status: 'converted',
    convertedOrder: order._id,
    timeline: [
      ...quote.timeline,
      { status: 'accepted', at: order.createdAt, note: 'Client accepted.' },
      { status: 'converted', at: order.createdAt, note: `Converted to ${order.orderNumber}.` },
    ],
  };
}

async function run() {
  await connectDb();

  const [buyers, products, settings] = await Promise.all([
    db().User.find({ role: 'buyer', status: 'approved' }).select('_id businessName').lean(),
    db().Product.find({ isActive: true }).select('_id sku name price cost').limit(200).lean(),
    db().Settings.load(),
  ]);

  if (!buyers.length) {
    throw new Error(
      'No approved buyer to quote for. A quote is priced for an account — approve one first.',
    );
  }
  if (!products.length) {
    throw new Error('No active products to quote. Seed the catalogue first.');
  }

  // Continue the sequence rather than restarting it, so a second run does not
  // collide on `quoteNumber`'s unique index.
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;
  const last = await db().Quote.findOne({ quoteNumber: new RegExp(`^${prefix}`) })
    .sort({ quoteNumber: -1 })
    .select('quoteNumber')
    .lean();
  const startAt = last ? Number(last.quoteNumber.slice(prefix.length)) + 1 : 1;

  const rate = db().Settings.rateFor(settings, 'ON');
  const built = buildQuotes({ products, users: buyers, rate, year });

  // Renumber onto the end of the existing sequence.
  const rows = built.map((quote, index) => ({
    ...quote,
    quoteNumber: `${prefix}${String(startAt + index).padStart(5, '0')}`,
  }));

  // Give one of them the `converted` state, pointed at a real order.
  const order = await db().Order.findOne({ status: { $ne: 'cancelled' } })
    .sort({ createdAt: -1 })
    .select('_id orderNumber createdAt user')
    .lean();

  if (order) {
    /**
     * The converted row is **added**, not promoted from the accepted one.
     *
     * Converting the accepted quote in place left the `accepted` filter with
     * nothing in it — the builder produces exactly one of each state, so
     * borrowing one empties a pill. It is cloned instead, and belongs to the
     * account that actually placed the order, because a quote converted into
     * somebody else's order is nonsense.
     */
    const source = rows.find((row) => row.status === 'accepted') ?? rows[0];

    rows.push(
      await attachConverted(
        {
          ...source,
          user: order.user,
          quoteNumber: `${prefix}${String(startAt + rows.length).padStart(5, '0')}`,
          createdAt: order.createdAt,
          updatedAt: order.createdAt,
        },
        order,
      ),
    );
  }

  const inserted = await db().Quote.insertMany(rows);

  const byStatus = inserted.reduce((out, row) => {
    out[row.status] = (out[row.status] ?? 0) + 1;
    return out;
  }, {});

  console.log(`Added ${inserted.length} quotes (${inserted[0].quoteNumber} … ${inserted[inserted.length - 1].quoteNumber})`);
  console.log(`  by status: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`  total quotes in database: ${await db().Quote.countDocuments({})}`);
  if (!order) {
    console.log('  note: no order to point at, so nothing is in the `converted` state.');
  }

  await disconnectDb();
}

run().catch(async (error) => {
  console.error(`Seeding quotes failed: ${error.message}`);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
