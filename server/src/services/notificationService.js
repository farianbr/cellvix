import Notification from '../models/Notification.js';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Role from '../models/Role.js';

/**
 * The notification bell (ERP rework §7.3, §6.15, phase 12c).
 *
 * §7.3 names eight sources. They are answered two different ways, for the
 * reason set out at length in `models/Notification.js`: four are **events** and
 * are stored, four are **standing conditions** and are derived from the live
 * records every time the bell is opened. A stored "invoice overdue" row is a
 * lie the moment the invoice is paid, and keeping it honest would need a delete
 * hook on every payment, receipt and stock movement.
 *
 * The two halves meet in `list()`, sorted into one stream. The client is not
 * told which is which — it does not need to know, and a UI that distinguished
 * them would be exposing a storage detail as a feature.
 *
 * **Role filtering is server-side and is the point** (§7.3: a warehouse role
 * sees stock and PO alerts, not overdue invoices). Every row — stored or
 * derived — carries the permission area that gates it, and a caller who does
 * not hold `view` on that area never receives it. It is the same rule
 * `searchService` follows and for the same reason: a notification leaks the
 * existence, the name and usually the money of a record before anybody clicks.
 */

/**
 * How many derived rows each standing condition may contribute.
 *
 * Uncapped, a catalogue import with 400 unstocked parts would push every real
 * alert off the bell and make the feature useless on exactly the day it
 * mattered. The count in the header is the true total; this caps only the rows.
 */
const PER_CONDITION = 10;

/** How many stored events the dropdown carries. */
const EVENT_LIMIT = 40;

/** The permission area gating each event type (§7.6's areas, not invented ones). */
const TYPE_AREA = {
  new_registration: 'clients',
  new_order: 'sales',
  quote_accepted: 'sales',
  new_rma: 'sales',
};

// ---- writing ----------------------------------------------------------------

/**
 * Writes one event notification. Never throws, never rejects.
 *
 * Callers are paths that have already committed — an order is placed and paid
 * by the time this runs. `auditService.record()` swallows its failures for the
 * same reason, and it is worth restating: a bell write that lost a race must
 * never turn a successful order into a reported failure, because the retry
 * that follows is a second order.
 */
export async function emit({ type, severity = 'info', title, detail = '', entity, href = '' }) {
  try {
    const area = TYPE_AREA[type];
    // An unknown type has no area, and a row with no area is one no role filter
    // can reason about — it would either leak to everyone or reach nobody.
    // Refusing it here keeps that decision from being made by accident.
    if (!area) {
      console.error('[notify] unknown notification type', type);
      return;
    }

    await Notification.create({
      type,
      severity,
      title,
      detail,
      entity: { kind: entity.kind, id: String(entity.id ?? ''), label: entity.label ?? '' },
      href,
      area,
    });
  } catch (error) {
    console.error('[notify] failed to emit', type, error?.message);
  }
}

// ---- role filtering ---------------------------------------------------------

/**
 * Which permission areas this caller may receive notifications from.
 *
 * An admin gets everything. A staff account resolves its role **per request**,
 * the same as `requirePermission` and `searchService`: a role edited in one tab
 * has to bite on the next request in another, and a cached map is how somebody
 * keeps access they were just denied.
 */
async function allowedAreas(user) {
  if (user?.role === 'admin') return new Set(['clients', 'sales', 'purchase']);
  if (user?.role !== 'staff' || !user.staffRole) return new Set();

  const role = await Role.findById(user.staffRole);
  if (!role) return new Set();

  return new Set(['clients', 'sales', 'purchase'].filter((area) => role.allows(area, 'view')));
}

// ---- the derived four -------------------------------------------------------

/**
 * Standing conditions, read from the live records.
 *
 * Each returns rows in the same shape a stored one serialises to, with a
 * synthetic `id` prefixed by its condition so the client can key a list without
 * colliding with a real `ObjectId`. They are **always unread**: there is no
 * per-admin read state to keep, because the row stops existing the moment the
 * condition clears, which is the honest behaviour — an operator who dismissed
 * "out of stock" and still has an empty shelf has not solved anything.
 */
async function derivedFor(areas, now) {
  const jobs = [];

  if (areas.has('sales')) {
    jobs.push(
      // Overdue is derived here rather than read from `status`, matching the
      // rule phase 4 settled: an invoice is overdue because its due date passed
      // and it is not paid, not because a nightly job got around to stamping
      // it. Reading the stored status would under-report by up to a day.
      Invoice.find({
        status: { $in: ['unpaid', 'partial'] },
        dueDate: { $lt: now },
      })
        .sort({ dueDate: 1 })
        .limit(PER_CONDITION)
        .lean()
        .then((rows) =>
          rows.map((invoice) => {
            const days = Math.max(
              Math.floor((now - new Date(invoice.dueDate)) / 86_400_000),
              1,
            );
            const owed = (invoice.total ?? 0) - (invoice.amountPaid ?? 0);
            return {
              id: `invoice_overdue:${invoice._id}`,
              type: 'invoice_overdue',
              severity: 'danger',
              title: `Invoice ${invoice.number} is overdue`,
              detail: `${formatMoney(owed)} outstanding · ${days} day${days === 1 ? '' : 's'} past due`,
              entity: { kind: 'invoice', id: invoice.number, label: invoice.number },
              href: `/admin/invoices/${invoice.number}`,
              area: 'sales',
              read: false,
              createdAt: invoice.dueDate,
            };
          }),
        ),
    );
  }

  if (areas.has('purchase')) {
    jobs.push(
      // Out of stock and low stock are one query, split after: `$expr` against
      // `minStock` cannot use an index, so running it twice would double the
      // cost of opening the bell for no benefit.
      Product.find({
        isActive: true,
        $or: [{ stock: { $lte: 0 } }, { $expr: { $lte: ['$stock', '$minStock'] } }],
      })
        .sort({ stock: 1 })
        .limit(PER_CONDITION * 2)
        .lean()
        .then((rows) =>
          rows
            // A product with no reorder point set is not "always low" — zero
            // means no point set, per the model. Out of stock still counts.
            .filter((product) => product.stock <= 0 || product.minStock > 0)
            .map((product) => {
              const out = product.stock <= 0;
              return {
                id: `${out ? 'out_of_stock' : 'low_stock'}:${product._id}`,
                type: out ? 'out_of_stock' : 'low_stock',
                severity: out ? 'danger' : 'warn',
                title: out ? `${product.name} is out of stock` : `${product.name} is low on stock`,
                detail: out
                  ? `${product.sku} · no units on hand`
                  : `${product.sku} · ${product.stock} left, reorder at ${product.minStock}`,
                entity: { kind: 'product', id: product._id.toString(), label: product.name },
                href: `/admin/inventory/${product._id}`,
                area: 'purchase',
                read: false,
                // These conditions have no moment of onset the records record,
                // so the row is dated to now. Sorting a standing condition by a
                // stock field's `updatedAt` would rank a shelf that emptied
                // months ago below one restocked yesterday.
                createdAt: now,
              };
            })
            .slice(0, PER_CONDITION * 2),
        ),
      PurchaseOrder.find({
        status: { $in: ['sent', 'partial'] },
        expectedDate: { $lt: now },
      })
        .sort({ expectedDate: 1 })
        .limit(PER_CONDITION)
        .populate('supplier', 'name')
        .lean()
        .then((rows) =>
          rows.map((po) => {
            const days = Math.max(Math.floor((now - new Date(po.expectedDate)) / 86_400_000), 1);
            return {
              id: `po_overdue:${po._id}`,
              type: 'po_overdue',
              severity: 'warn',
              title: `${po.poNumber} has not arrived`,
              detail: `${po.supplier?.name ?? 'Supplier'} · expected ${days} day${days === 1 ? '' : 's'} ago`,
              entity: { kind: 'purchaseOrder', id: po._id.toString(), label: po.poNumber },
              href: `/admin/purchase-orders/${po._id}`,
              area: 'purchase',
              read: false,
              createdAt: po.expectedDate,
            };
          }),
        ),
    );
  }

  const results = await Promise.all(jobs);
  return results.flat();
}

/** Cents to `$1,234.56`. Canadian conventions, same as everywhere else. */
function formatMoney(cents) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    (cents ?? 0) / 100,
  );
}

// ---- reading ----------------------------------------------------------------

/**
 * The bell's contents for one caller: stored events and derived conditions,
 * merged newest-first, with the unread count the badge shows.
 *
 * `unread` counts both halves. A derived row is always unread, so an operator
 * with three overdue invoices and nothing new still sees a badge — which is
 * right: the badge means "things want your attention", not "things arrived
 * since you last looked".
 */
export async function list(user) {
  const areas = await allowedAreas(user);
  if (areas.size === 0) return { entries: [], unread: 0, total: 0 };

  const now = new Date();
  const userId = user?._id;

  const [stored, derived] = await Promise.all([
    Notification.find({
      area: { $in: [...areas] },
      // Cleared is per-account, so this filters by *this* caller only — the row
      // stays in everybody else's bell.
      clearedBy: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .limit(EVENT_LIMIT)
      .lean(),
    derivedFor(areas, now),
  ]);

  const events = stored.map((row) => ({
    id: row._id.toString(),
    type: row.type,
    severity: row.severity,
    title: row.title,
    detail: row.detail,
    entity: row.entity,
    href: row.href,
    area: row.area,
    read: (row.readBy ?? []).some((id) => id.equals?.(userId) ?? String(id) === String(userId)),
    createdAt: row.createdAt,
  }));

  const entries = [...events, ...derived].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  return {
    entries,
    unread: entries.filter((entry) => !entry.read).length,
    total: entries.length,
  };
}

/**
 * Marks stored notifications read for this caller.
 *
 * `$addToSet` rather than `$push`: opening the bell twice must not grow the
 * array, and an idempotent write is the one that survives a double-click.
 *
 * Derived rows are skipped rather than refused — the client sends the ids it
 * sees, and it does not know which half they came from. Silently ignoring an
 * id with no stored row is right here, because "mark an unpayable invoice read"
 * is a request with no meaning rather than an error the operator can act on.
 */
export async function markRead(user, ids) {
  const filter = { readBy: { $ne: user._id } };

  if (Array.isArray(ids) && ids.length > 0) {
    const storedIds = ids.filter((id) => /^[a-f\d]{24}$/i.test(id));
    if (storedIds.length === 0) return { updated: 0 };
    filter._id = { $in: storedIds };
  } else {
    // No ids means "all of them" — but only within the areas this caller may
    // see. Without that clause a warehouse account marking its bell read would
    // silently clear rows it was never shown.
    const areas = await allowedAreas(user);
    if (areas.size === 0) return { updated: 0 };
    filter.area = { $in: [...areas] };
  }

  const result = await Notification.updateMany(filter, { $addToSet: { readBy: user._id } });
  return { updated: result.modifiedCount ?? 0 };
}

/**
 * `Clear All` (§6.15) — for this caller only.
 *
 * Dismissal is a `clearedBy` entry, never a delete. The same event is still
 * unread for every other admin, and one person tidying their own bell must not
 * erase somebody else's queue. It also marks them read, so a row restored by a
 * future "show cleared" view does not come back demanding attention.
 *
 * Derived rows are untouched by design: they are not stored, and an operator
 * who clears "out of stock" while the shelf is still empty has not solved
 * anything. The condition reappears on the next read, which is the honest
 * answer even though it is the less satisfying one.
 */
export async function clearAll(user) {
  const areas = await allowedAreas(user);
  if (areas.size === 0) return { cleared: 0 };

  const result = await Notification.updateMany(
    { area: { $in: [...areas] }, clearedBy: { $ne: user._id } },
    { $addToSet: { clearedBy: user._id, readBy: user._id } },
  );

  return { cleared: result.modifiedCount ?? 0 };
}

export default { emit, list, markRead, clearAll };
