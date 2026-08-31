const { default: AuditLog, diff } = require('../models/AuditLog.js');
const { likeRegex } = require('../utils/regex.js');

/**
 * The audit trail's read and write surface (§7.5, §6.15 category 6, phase 11b).
 *
 * **`record()` is the only way a row is written**, and it never throws. That is
 * the single most important thing in this file: an audit write is a side effect
 * of an operation that has already succeeded, and letting it fail the operation
 * would mean a refund that actually went through gets reported as an error —
 * and then retried. A missing log row is a gap in the record; a double refund
 * is money.
 *
 * **There is no update and no delete.** Not "not exposed yet" — the functions do
 * not exist. §6.15 says neither screen ever deletes from the UI, and a log the
 * logged party can prune is not evidence.
 */

/**
 * Pulls the actor out of a request.
 *
 * Denormalised onto the row: an audit entry must still read correctly after the
 * account is renamed or deleted, so it cannot depend on a join that can vanish.
 */
function actorFrom(req) {
  const user = req?.user;
  return {
    actor: user?._id ?? null,
    actorEmail: user?.email ?? '',
    actorName: user?.contactName ?? user?.businessName ?? '',
    actorRole: user?.role ?? '',
    ip: req?.ip ?? '',
    userAgent: (req?.get?.('user-agent') ?? '').slice(0, 300),
  };
}

/**
 * Writes one row. Never throws, never rejects.
 *
 * Callers are mutation paths that have already committed their change, so they
 * `await` this only to keep ordering tidy — the promise always resolves.
 */
async function record({
  req,
  kind = 'activity',
  action,
  entity,
  before = null,
  after = null,
  description = '',
}) {
  try {
    await AuditLog.create({
      kind,
      action,
      entity: { kind: entity.kind, id: String(entity.id ?? ''), label: entity.label ?? '' },
      before,
      after,
      description,
      ...actorFrom(req),
    });
  } catch (error) {
    // Logged to the console rather than to the collection that just failed.
    console.error('[audit] failed to record', action, error?.message);
  }
}

/**
 * Records a change, computing the diff, and skips the write when nothing moved.
 *
 * A save that altered nothing produces no row: a log full of "somebody opened
 * this and pressed save" is a log nobody scrolls, and the entries that matter
 * get buried in it.
 */
async function recordChange({ req, action, entity, before, after, fields, description }) {
  const changes = diff(before, after, { fields });
  if (!changes) return;

  await record({
    req,
    action,
    entity,
    before: changes.before,
    after: changes.after,
    description: description ?? `Updated ${Object.keys(changes.after).join(', ')}`,
  });
}

/**
 * A security-log row: sessions and accounts, not records.
 *
 * `subject` is the account the event is *about*, which is not always the actor.
 * A failed sign-in has no session, so `req.user` is empty — but the address
 * being tried is known, and stamping it lets the log answer "how many failures
 * against this account" rather than only "how many failures". It is written
 * onto the row directly rather than patched in afterwards: a follow-up update
 * matching on `kind` and `action` could pick up somebody else's row under
 * concurrent sign-ins, which is a worse answer than none.
 */
async function recordSecurity({ req, action, entity, description, subject = null }) {
  const base = actorFrom(req);

  try {
    await AuditLog.create({
      kind: 'security',
      action,
      entity: entity ?? { kind: 'session', id: '' },
      description,
      ...base,
      // The actor wins when there is one — an admin locking somebody out is the
      // actor, and the locked account is the entity. `subject` only fills the
      // gap left by an unauthenticated event.
      ...(base.actor || !subject
        ? {}
        : {
            actor: subject._id ?? null,
            actorEmail: subject.email ?? '',
            actorName: subject.contactName ?? subject.businessName ?? '',
            actorRole: subject.role ?? '',
          }),
    });
  } catch (error) {
    console.error('[audit] failed to record security event', action, error?.message);
  }
}

/**
 * One page of the log.
 *
 * Both screens read through here; `kind` is what separates them, and the route
 * — not the caller's query — decides it, because the security log is admin-only
 * and a client-supplied `kind` would be a way around that.
 */
async function list({ kind = 'activity', q, action, entity, page = 1, limit = 50 } = {}) {
  const filter = { kind };

  if (action) filter.action = action;
  if (entity) filter['entity.kind'] = entity;

  if (q) {
    const like = likeRegex(q);
    filter.$or = [
      { actorEmail: like },
      { actorName: like },
      { action: like },
      { description: like },
      { 'entity.id': like },
      { 'entity.label': like },
      { ip: like },
    ];
  }

  const perPage = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const current = Math.max(Number(page) || 1, 1);

  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    entries: rows.map((row) => ({
      id: row._id.toString(),
      kind: row.kind,
      action: row.action,
      actor: row.actor ? row.actor.toString() : null,
      actorEmail: row.actorEmail,
      actorName: row.actorName,
      actorRole: row.actorRole,
      entity: row.entity,
      before: row.before,
      after: row.after,
      description: row.description,
      ip: row.ip,
      createdAt: row.createdAt,
    })),
    total,
    page: current,
    pages: Math.max(Math.ceil(total / perPage), 1),
    // The action filter's options, from what is actually in the log rather than
    // from a constant that drifts as new actions are added.
    actions: await AuditLog.distinct('action', { kind }),
  };
}

exports.default = { record, recordChange, recordSecurity, actorFrom, list };

// --- CommonJS exports -------------------------------------------------
exports.actorFrom = actorFrom;
exports.record = record;
exports.recordChange = recordChange;
exports.recordSecurity = recordSecurity;
exports.list = list;
