

import { controlDb, dbFor } from './connections.js';
import { runInBusiness } from './context.js';

/**
 * Schema migrations, applied per database (SAAS_PLATFORM §4.1, the second
 * deferred item).
 *
 * **Database-per-business means every migration runs N times.** That is the
 * cost the split was accepted with, and this is what pays it: a migration is
 * written once, recorded independently in each database, and a business created
 * next year gets the whole history applied to its fresh database rather than
 * starting at a schema nobody has a record of reaching.
 *
 * **Each database records its own state.** Not a central ledger: a central one
 * would claim a migration had run for a business whose database was restored
 * from a backup taken before it, and the restore would then silently skip it.
 * The record living beside the data it describes is what makes a restore
 * self-consistent.
 *
 * **Migrations are append-only and never renumbered.** `id` is what a database
 * remembers, so changing one makes every database believe it has an unrun
 * migration and re-run work that is already done.
 */

/** Where each database records what it has already applied. */
const COLLECTION = 'migrations';

/**
 * The migrations, in order.
 *
 * `up` receives `{ connection, models }` and may use either — a schema-level
 * change usually wants the raw collection, and a data change usually wants the
 * model. Both are given rather than making every migration reach for the one it
 * was not handed.
 *
 * Deliberately empty at the flip. The split re-seeds rather than migrating
 * existing data (that was the ruling), so there is no backfill to run — and an
 * invented first migration would be a lie about what has happened to these
 * databases. Entries arrive as real schema changes do.
 */
const MIGRATIONS = [
  // {
  //   id: '0001-example',
  //   description: 'What this does and why.',
  //   async up({ connection, models }) { ... },
  // },
];

async function appliedIn(connection) {
  const rows = await connection.db.collection(COLLECTION).find({}).toArray();
  return new Set(rows.map((row) => row.id));
}

/**
 * Apply every outstanding migration to one database.
 *
 * **Recorded only after `up` resolves.** A migration that threw is not written
 * down, so the next run retries it — which is the right default, because the
 * alternative is a database silently stuck at a version nobody can reach.
 *
 * Each migration runs inside `runInBusiness` so anything it calls through the
 * service layer reads the database being migrated rather than the default one.
 */
async function migrateConnection(connection, { label, dryRun = false } = {}) {
  const done = await appliedIn(connection);
  const pending = MIGRATIONS.filter((migration) => !done.has(migration.id));

  if (!pending.length) {
    console.log(`  ${label}: up to date (${done.size} applied)`);
    return { label, applied: [], alreadyApplied: done.size };
  }

  if (dryRun) {
    console.log(`  ${label}: ${pending.length} pending — ${pending.map((m) => m.id).join(', ')}`);
    return { label, pending: pending.map((m) => m.id), dryRun: true };
  }

  const applied = [];
  for (const migration of pending) {
    const started = Date.now();
    await runInBusiness({ businessId: null, code: null, connection }, () =>
      migration.up({ connection, models: connection.models }),
    );

    await connection.db.collection(COLLECTION).insertOne({
      id: migration.id,
      description: migration.description ?? '',
      appliedAt: new Date(),
      ms: Date.now() - started,
    });

    applied.push(migration.id);
    console.log(`  ${label}: applied ${migration.id}`);
  }

  return { label, applied, alreadyApplied: done.size };
}

/**
 * Migrate the control plane and every business database.
 *
 * Businesses are read from the control plane, which is the only place that
 * knows they exist — so this cannot be driven from a list somebody maintains by
 * hand and forgets to update.
 *
 * **A deleted business is still migrated while its retention window is open.**
 * It can be restored, and restoring into a database three migrations behind
 * would hand somebody back a business that no longer works.
 */
async function migrateAll({ dryRun = false } = {}) {
  const results = [];

  results.push(await migrateConnection(controlDb(), { label: 'control', dryRun }));

  /**
   * Read the businesses straight off the control database's collection.
   *
   * `connection.model(name, schema)` throws `OverwriteModelError` when that
   * connection has already compiled the model — which it has, because the
   * registry bound it on the first control-plane read. Going to the raw
   * collection sidesteps the question entirely, and this needs two fields, not
   * a document with methods.
   */
  const businesses = await controlDb()
    .db.collection('businesses')
    .find({ $or: [{ deletedAt: null }, { purgeAfter: { $gt: new Date() } }] })
    .project({ name: 1, code: 1 })
    .toArray();

  for (const business of businesses) {
    results.push(
      await migrateConnection(dbFor(business.code), {
        label: `${business.name} (${business.code})`,
        dryRun,
      }),
    );
  }

  return results;
}

export { COLLECTION, MIGRATIONS, migrateAll, migrateConnection };
