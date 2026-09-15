import { connectDb, disconnectDb } from '../config/db.js';
import { controlModels } from '../db/models.js';
import '../models/Business.js';
import { CELLVIX_OVERRIDES } from '../../../shared/schemas/features.js';

/**
 * Writes the registry's `CELLVIX_OVERRIDES` onto Cellvix's own business record.
 *
 * ## What went wrong
 *
 * `shared/schemas/features.js` has always declared that Cellvix runs
 * `sales.tickets`, `sales.quotes` and `scheduling.appointments` switched on and
 * `purchase.returns` switched off - service-shaped features a `product` business
 * would not get by default, which Cellvix has built and uses anyway. That is
 * exactly what a per-business override is for, and rule 4 of the registry is
 * explicit that introducing the feature layer must not change one pixel of the
 * running product.
 *
 * The stored record never received them. It carried only
 * `storefront.public` and `storefront.checkout`, so the registry and the
 * database disagreed about what Cellvix has. **Nothing noticed, because nothing
 * read the answer**: `requireFeature` guarded one route family, and the nav
 * filtered on a set that was never consulted for these keys.
 *
 * The moment the type-divergent routes were gated, the disagreement became
 * visible as a bug - `/admin/tickets` and `/admin/quotes` answering 404 on a
 * business whose staff use both screens daily.
 *
 * ## Why the fix is here and not in the resolver
 *
 * The resolver could special-case Cellvix and fall back to `CELLVIX_OVERRIDES`,
 * and it would work. It would also hardcode tenant #1 into the one piece of
 * code that is supposed to be tenant-agnostic, and it would leave the super
 * admin's feature grid - which reads the stored record - still showing the wrong
 * state. The database is the source of truth for what a business has; the
 * honest fix is to make the database say what has been true all along.
 *
 * ## Safety
 *
 * **Additive and idempotent.** A key already present on the record is left
 * exactly as it is, so an override a super admin set by hand is never reverted
 * by a later run - the registry describes where Cellvix *started*, not where a
 * staff member has since taken it. A second run reports nothing to do.
 */

/** The business this applies to. Cellvix is `#000001`, the first one created. */
const CELLVIX_CODE = '#000001';

async function backfillCellvixFeatures({ quiet = false, dryRun = false } = {}) {
  const log = (...args) => {
    if (!quiet) console.log(...args);
  };

  const Business = controlModels().Business;
  const business = await Business.findOne({ code: CELLVIX_CODE });

  if (!business) {
    log(`No business with code ${CELLVIX_CODE} - nothing to do.`);
    return { added: 0 };
  }

  log(`Business: ${business.name} (${business.code}, ${business.businessType})`);

  /**
   * `featureOverrides` is `Mixed` - a plain object, not a Map.
   *
   * Worth saying out loud because the resolver's signature talks about Maps and
   * `.lean()` on a Map field would also hand back an object: the two look alike
   * from the outside and are read completely differently. This is the schema's
   * actual type, so plain property access is correct here.
   */
  const current = { ...(business.featureOverrides ?? {}) };
  const added = [];
  const kept = [];

  for (const [key, enabled] of Object.entries(CELLVIX_OVERRIDES)) {
    // `in`, not a truthiness check: `purchase.returns` is legitimately `false`,
    // and treating a stored `false` as absent would rewrite it on every run.
    if (key in current) {
      kept.push(`${key}=${current[key]}`);
      continue;
    }
    added.push(`${key}=${enabled}`);
    if (!dryRun) current[key] = enabled;
  }

  for (const entry of kept) log(`  kept    ${entry}`);
  for (const entry of added) log(`  ${dryRun ? 'would add' : 'added'}   ${entry}`);

  if (added.length === 0) {
    log('\nNothing to do - the record already matches the registry.');
    return { added: 0, business: business._id };
  }

  if (!dryRun) {
    business.featureOverrides = current;
    // A `Mixed` path is not change-tracked: Mongoose cannot see inside it, so a
    // save without this writes nothing at all and reports success.
    business.markModified('featureOverrides');
    await business.save();
  }

  log(`\n${dryRun ? 'Would add' : 'Added'} ${added.length} override(s) to ${business.name}.`);
  return { added: added.length, business: business._id };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDb();
  try {
    await backfillCellvixFeatures({ dryRun });
  } finally {
    await disconnectDb();
  }
}

// Run only when invoked directly, so the function can also be imported.
if (process.argv[1]?.endsWith('backfill-cellvix-features.js')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { backfillCellvixFeatures };
export default backfillCellvixFeatures;
