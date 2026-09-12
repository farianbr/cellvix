import { db } from '../db/models.js';
import '../models/Settings.js';

/**
 * How long a part is covered for, and whether a given line still is.
 *
 * **This is the only place warranty length is decided.** Before it, the grade
 * table in Settings was editable and displayed and read by nothing — the RMA
 * screens never consulted it, so a shop could set NEW to 365 days and the
 * system would accept a return on day 900 without comment. Membership tiers
 * added a second input to the same question, and two callers each doing their
 * own arithmetic is how a warranty quoted to a customer stops matching the one
 * an RMA is judged against.
 *
 * ## The rule
 *
 *   cover = warrantyByGrade[grade] + warrantyBonusByTier[tier]
 *
 * measured in whole days from **delivery**, not from the order date: a part
 * that spent three weeks in transit has not spent three weeks of its warranty.
 *
 * The tier contribution is a **bonus, never a replacement**. An absolute figure
 * per tier would let a Gold customer's 90-day tier warranty shorten the 365
 * days a NEW part already carries, which is the opposite of what a tier is for.
 * Adding can only improve cover, so the two tables cannot contradict.
 *
 * ## What it deliberately does not do
 *
 * It does not block anything. `isCovered` is an *answer*, surfaced to the
 * operator raising an RMA; it never refuses the return. An out-of-warranty
 * return is a normal commercial act — a goodwill replacement, a part that
 * failed for a reason the warranty does not cover but the relationship does —
 * and a system that made it impossible would be telling the shop how to run
 * itself. The decision stays with the person, who now has the fact.
 */

/** A grade with no row in the table has no warranty rather than an unbounded one. */
function gradeDays(settings, grade) {
  const table = settings?.financial?.warrantyByGrade ?? {};
  const value = table instanceof Map ? table.get(grade) : table[grade];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

/** An unknown tier contributes nothing, exactly as `standard` does. */
function tierBonusDays(settings, tier) {
  const table = settings?.financial?.warrantyBonusByTier ?? {};
  const value = table instanceof Map ? table.get(tier) : table[tier];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

/**
 * When an order was delivered.
 *
 * Read from the timeline rather than a dedicated field, because that is where
 * the status ladder actually records it. An order that has not been delivered
 * yet has no warranty clock running at all — `null` says so, and the caller
 * reports "not started" rather than quietly measuring from the order date and
 * expiring somebody's cover early.
 */
function deliveredAt(order) {
  const entry = (order?.timeline ?? []).find((row) => row.status === 'delivered');
  return entry?.at ? new Date(entry.at) : null;
}

/** Whole days between two dates, floored — a part is in warranty for all of day 90. */
function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Warranty for one sold line.
 *
 * `grade` comes from the order line, snapshotted at sale, so a later catalogue
 * re-grade cannot retroactively change what a customer was sold. `tier` is the
 * customer's tier **now**, which is the generous reading: somebody promoted to
 * Gold gets the longer cover on what they already own.
 */
function coverFor({ settings, grade, tier, order, at = new Date() }) {
  const base = gradeDays(settings, grade);
  /**
   * A bonus applies to cover that exists; it does not create it.
   *
   * A grade with no row in the table carries no warranty, and a Gold customer
   * buying such a part would otherwise come out with ninety days of cover that
   * the product itself was never sold with — the tier would be inventing a
   * warranty rather than extending one.
   */
  const bonus = base > 0 ? tierBonusDays(settings, tier) : 0;
  const totalDays = base + bonus;

  const start = deliveredAt(order);

  if (!start) {
    return {
      grade: grade ?? null,
      tier: tier ?? 'standard',
      baseDays: base,
      bonusDays: bonus,
      totalDays,
      startedAt: null,
      expiresAt: null,
      daysRemaining: null,
      // Not delivered is not the same as not covered, and the UI has to be able
      // to say which — see the module comment.
      status: 'not_started',
      isCovered: true,
    };
  }

  const expiresAt = new Date(start.getTime() + totalDays * 86_400_000);
  const elapsed = daysBetween(start, at);
  const remaining = totalDays - elapsed;

  return {
    grade: grade ?? null,
    tier: tier ?? 'standard',
    baseDays: base,
    bonusDays: bonus,
    totalDays,
    startedAt: start,
    expiresAt,
    daysRemaining: remaining,
    status: remaining >= 0 ? 'covered' : 'expired',
    isCovered: remaining >= 0,
  };
}

/**
 * Warranty for every line on an order, for one customer's tier.
 *
 * Loads settings once. Callers that already hold a settings document pass it
 * in; the RMA screens do not, so the default fetch keeps them simple.
 */
async function coverForOrder(order, tier, { settings, at } = {}) {
  const resolved = settings ?? (await db().Settings.load());

  return (order?.items ?? []).map((item) => ({
    sku: item.sku,
    name: item.name,
    ...coverFor({ settings: resolved, grade: item.grade, tier, order, at }),
  }));
}

export { coverFor, coverForOrder, deliveredAt };
