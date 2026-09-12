import { connectDb, disconnectDb } from '../config/db.js';
import { migrateAll } from '../db/migrate.js';

// Every model has to be registered before a migration can bind one to another
// connection — `modelsFor` reads schemas back off the compiled models.
import '../models/Business.js';

/**
 * `npm run migrate` — apply outstanding migrations to every database.
 *
 * `--dry-run` lists what would run and changes nothing, which is what to use
 * against a database holding real records before committing to anything.
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await connectDb();
  console.log(dryRun ? '\n  Migrations — dry run\n' : '\n  Migrations\n');

  const results = await migrateAll({ dryRun });

  const applied = results.reduce((sum, row) => sum + (row.applied?.length ?? 0), 0);
  console.log(
    dryRun
      ? `\n  ${results.length} database(s) checked.\n`
      : `\n  ${applied} migration(s) applied across ${results.length} database(s).\n`,
  );

  await disconnectDb();
}

main().catch(async (error) => {
  console.error(`\n  Migration failed: ${error.message}\n`);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
