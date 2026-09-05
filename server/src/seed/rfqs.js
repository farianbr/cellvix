import bcrypt from 'bcryptjs';

import { connectDb, disconnectDb } from '../config/db.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Rfq from '../models/Rfq.js';
import rfqService from '../services/rfqService.js';
import { SUPPLIER_COMPONENT_TYPES, buildRfqs } from './rfq.data.js';

/**
 * Demo data for the supplier process flow (§6.8a) — tags, portal logins and a
 * set of requests for quote across every state.
 *
 * **Additive, like `seed:quotes` and `seed:content` — it never wipes.**
 * `npm run seed` rebuilds the whole database, which is the wrong tool for
 * "give me some requests to look at" on an instance that already holds
 * suppliers and purchase orders somebody is using. This tags what is there and
 * adds rows.
 *
 * Three things it does, in order, and each is separately re-runnable:
 *
 *   1. **Tags suppliers with component types.** Without this the request
 *      picker is empty and the feature reads as broken rather than unused. Only
 *      suppliers with **no tags at all** are touched — one somebody has already
 *      tagged by hand keeps their answer.
 *   2. **Gives each active supplier portal credentials**, so the portal can
 *      actually be signed into. The password is the shared demo one, and this
 *      is the one place in the codebase that writes a known password to a
 *      supplier — see the note on `DEMO_PASSWORD` below.
 *   3. **Adds requests for quote**, numbering on from whatever is already
 *      there so a second run cannot collide on `rfqNumber`'s unique index.
 *
 * The awarded request is awarded **through `rfqService.awardRfq`**, not by
 * writing an `awarded` document directly. That is the whole point: the purchase
 * order it raises is then a real one, produced by the same code path an
 * operator's click goes through, and it cannot drift from what the running
 * system would have created.
 */

/**
 * The same password as the demo buyer and admin accounts (`seed/run.js`).
 *
 * **This is demo data, and the password is public in the repo.** That is
 * acceptable here for exactly the reason it is acceptable for
 * `buyer@cellvix.ca` — every one of these suppliers is fictional, their
 * addresses are `.example`, and the whole database is dummy data. It must never
 * become the way a real supplier is onboarded: that path is the admin's
 * **Send portal link** button, which mints a random password through
 * `supplierPortalService.invitePortal` and emails it.
 */
const DEMO_PASSWORD = 'Cellvix123!';

async function seedRfqs({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...args) => console.log(...args);

  const [suppliers, products] = await Promise.all([
    Supplier.find({}).select('_id code name email isActive componentTypes passwordHash').lean(),
    Product.find({ isActive: true }).select('_id sku name price grade partType').lean(),
  ]);

  if (!suppliers.length) {
    throw new Error(
      'No suppliers to tag. A request for quote is asked OF somebody — run `npm run seed` first.',
    );
  }
  if (!products.length) {
    throw new Error('No active products to ask about. Seed the catalogue first.');
  }

  // ---- 1. component-type tags ----------------------------------------------

  let tagged = 0;
  for (const supplier of suppliers) {
    const tags = SUPPLIER_COMPONENT_TYPES[supplier.code];
    if (!tags) continue;
    // Already tagged — by hand or by an earlier run. Somebody's answer is not
    // ours to overwrite.
    if (supplier.componentTypes?.length) continue;

    await Supplier.updateOne({ _id: supplier._id }, { componentTypes: tags });
    tagged += 1;
  }
  log(`  tagged ${tagged} supplier(s) with component types`);

  // ---- 2. portal credentials ------------------------------------------------

  // Hashed once rather than per supplier: bcrypt at cost 10 is deliberately
  // slow, and five identical hashes is five times the wait for no benefit in
  // seed data whose password is public anyway.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  let credentialed = 0;
  for (const supplier of suppliers) {
    // Inactive suppliers get no login, exactly as `invitePortal` refuses them:
    // deactivating a supplier is how the purchasing team ends a relationship,
    // and it has to close the door as well.
    if (!supplier.isActive || !supplier.email) continue;
    if (supplier.passwordHash) continue; // already has a login

    await Supplier.updateOne(
      { _id: supplier._id },
      { passwordHash, portalInviteAt: new Date() },
    );
    credentialed += 1;
  }
  log(`  gave ${credentialed} supplier(s) portal access (password: ${DEMO_PASSWORD})`);

  // ---- 3. the requests ------------------------------------------------------

  const fresh = await Supplier.find({}).select('_id code name email').lean();
  const suppliersByCode = new Map(fresh.filter((s) => s.code).map((s) => [s.code, s]));

  // Continue the sequence rather than restarting it, so a second run does not
  // collide on `rfqNumber`'s unique index — the rule `seed:quotes` follows.
  const year = new Date().getFullYear();
  const prefix = `RFQ-${year}-`;
  const last = await Rfq.findOne({ rfqNumber: new RegExp(`^${prefix}`) })
    .sort({ rfqNumber: -1 })
    .select('rfqNumber')
    .lean();
  const startAt = last ? Number(last.rfqNumber.slice(prefix.length)) + 1 : 1;

  const built = buildRfqs({ products, suppliersByCode, year, startAt });
  if (!built.length) {
    throw new Error(
      'No request could be built — the catalogue has none of the component types the plans cover.',
    );
  }

  const inserted = await Rfq.insertMany(built.map((row) => row.doc));
  log(`  added ${inserted.length} requests (${inserted[0].rfqNumber} … ${inserted.at(-1).rfqNumber})`);

  // ---- the award, through the real service ---------------------------------

  let awardedNumber = null;
  const awardPlan = built.find((row) => row.plan.status === 'awarded');
  if (awardPlan) {
    const doc = inserted.find((row) => row.rfqNumber === awardPlan.doc.rfqNumber);
    const winner = doc.invites.find(
      (invite) => String(invite.supplier) === String(suppliersByCode.get(awardPlan.plan.awardTo)?._id),
    );

    if (winner) {
      /**
       * Awarded by calling the service, not by writing `status: 'awarded'`.
       *
       * This is what makes the demo honest: the purchase order that appears on
       * `/admin/purchase-orders` came out of the same function an operator's
       * click calls, carrying the winner's quoted unit costs, with the losers
       * marked `lost` and the supplier's spend totals recomputed. A
       * hand-written awarded document would look identical on screen and prove
       * nothing about the path.
       *
       * It also sends mail — to `.example` addresses that cannot receive it, so
       * every send fails and is logged. That is harmless and correct: the
       * mailer never throws (see `services/mailer.js`), and the alternative is
       * seed data that bypasses the notification half of the flow.
       */
      const result = await rfqService.awardRfq(doc._id, { inviteId: winner._id }, null);
      awardedNumber = result.purchaseOrder.poNumber;
      log(`  awarded ${doc.rfqNumber} to ${winner.supplierName} — raised ${awardedNumber}`);
    }
  }

  // Cancelled is a stored decision, so it is written as one. Unlike the award
  // it raises nothing and touches no other collection.
  const cancelPlan = built.find((row) => row.plan.status === 'cancelled');
  if (cancelPlan) {
    await Rfq.updateOne(
      { rfqNumber: cancelPlan.doc.rfqNumber },
      { status: 'cancelled' },
    );
  }

  return {
    tagged,
    credentialed,
    requests: inserted.length,
    purchaseOrder: awardedNumber,
  };
}

async function run() {
  await connectDb();

  console.log('Seeding supplier process-flow demo data…');
  const result = await seedRfqs();

  const counts = await Rfq.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  console.log(
    `  by status: ${counts.map((row) => `${row._id} ${row.count}`).join(' · ')}`,
  );
  console.log(`  total requests in database: ${await Rfq.countDocuments({})}`);
  console.log('');
  console.log('Supplier portal: http://localhost:5173/supplier');

  const logins = await Supplier.find({ isActive: true, passwordHash: { $exists: true } })
    .select('name email')
    .lean();
  for (const supplier of logins) {
    console.log(`  ${supplier.email}  —  ${supplier.name}`);
  }
  console.log(`  password for all of them: ${DEMO_PASSWORD}`);

  await disconnectDb();
}

// Only run when invoked directly, so `run.js` can import `seedRfqs` without
// the CLI wrapper firing — the pattern `expense-categories.js` uses.
if (process.argv[1] && process.argv[1].endsWith('rfqs.js')) {
  run().catch(async (error) => {
    console.error(`Seeding requests for quote failed: ${error.message}`);
    await disconnectDb().catch(() => {});
    process.exit(1);
  });
}

export { seedRfqs, DEMO_PASSWORD };
