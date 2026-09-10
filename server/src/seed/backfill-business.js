import { connectDb, disconnectDb } from '../config/db.js';
import Business from '../models/Business.js';
import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import Ticket from '../models/Ticket.js';
import Quote from '../models/Quote.js';
import Rma from '../models/Rma.js';

/**
 * Stamps `business` onto the records that predate per-business scoping.
 *
 * Orders, invoices, tickets, quotes and returns each gained an `business` field.
 * Every row written before that has none, and a null business is invisible to a
 * switcher filtering by one — so on a panel switched to "Cellvix Main" the
 * business would appear to have no history at all.
 *
 * **The default business is the oldest one**, which is the shop that existed when
 * those records were written and therefore the only one they can have belonged
 * to. It is not a guess: Cellvix ran one location for the whole period this
 * data covers (§6.14).
 *
 * Idempotent, and narrow by construction — the filter is `business: null`, so a
 * second run touches nothing and a record already assigned to a shop is never
 * reassigned. Safe on a database with real data.
 */
async function backfillBusiness({ quiet = false, dryRun = false } = {}) {
  const log = (...args) => {
    if (!quiet) console.log(...args);
  };

  // Oldest first: the business that was there when the unassigned rows were made.
  const business = await Business.findOne({}).sort({ createdAt: 1 }).lean();
  if (!business) {
    log('No businesses exist — nothing to assign to. Create one first.');
    return { assigned: 0 };
  }

  log(`Default business: ${business.name} (${business.code})`);

  const models = [
    ['orders', Order],
    ['invoices', Invoice],
    ['tickets', Ticket],
    ['quotes', Quote],
    ['returns', Rma],
  ];

  let assigned = 0;

  for (const [label, Model] of models) {
    const filter = { $or: [{ business: null }, { business: { $exists: false } }] };
    const pending = await Model.countDocuments(filter);

    if (pending === 0) {
      log(`  ${label}: nothing to do`);
      continue;
    }

    if (dryRun) {
      log(`  ${label}: ${pending} would be assigned`);
      assigned += pending;
      continue;
    }

    const result = await Model.updateMany(filter, { $set: { business: business._id } });
    log(`  ${label}: ${result.modifiedCount} assigned`);
    assigned += result.modifiedCount;
  }

  log(`\n${dryRun ? 'Would assign' : 'Assigned'} ${assigned} records to ${business.name}.`);
  return { assigned, business: business._id };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDb();
  try {
    await backfillBusiness({ dryRun });
  } finally {
    await disconnectDb();
  }
}

// Run only when invoked directly, so the function can also be imported.
if (process.argv[1]?.endsWith('backfill-business.js')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { backfillBusiness };
export default backfillBusiness;
