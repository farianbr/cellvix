import User from '../models/User.js';
import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Quote from '../models/Quote.js';
import Rma from '../models/Rma.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Outlet from '../models/Outlet.js';
import Role from '../models/Role.js';
import { likeRegex } from '../utils/regex.js';

/**
 * Global search (ERP rework §7.1, phase 12).
 *
 * One endpoint behind the Ctrl+K palette, returning grouped hits across nine
 * record types.
 *
 * **Permission filtering is server-side and is the whole point.** §7.6 is blunt
 * that a hidden nav item is a courtesy and never the control — the same applies
 * here, and more sharply: a search result leaks the *existence and name* of a
 * record before anybody clicks it. A warehouse role searching a business name
 * must not learn that the business has three overdue invoices, so each group is
 * skipped entirely unless the caller holds `view` on the area that owns it.
 *
 * **Each group is capped and the query is anchored to indexed fields.** A
 * palette that runs nine unbounded regex scans on every keystroke is a
 * denial-of-service with a nice keyboard shortcut.
 */

/** Which permission area gates each group (§7.6's areas, not invented ones). */
const GROUP_AREA = {
  clients: 'clients',
  orders: 'sales',
  invoices: 'sales',
  quotes: 'sales',
  rmas: 'sales',
  products: 'purchase',
  suppliers: 'purchase',
  purchaseOrders: 'purchase',
  outlets: 'outlet',
};

const PER_GROUP = 5;

/**
 * What this caller may search.
 *
 * An admin gets everything. A staff account resolves its role **per request** —
 * the same reasoning `requirePermission` uses: a role edited in one tab has to
 * bite on the next request in another, and a cached map is how somebody keeps
 * access they were just denied.
 */
async function allowedGroups(user) {
  if (user?.role === 'admin') return new Set(Object.keys(GROUP_AREA));
  if (user?.role !== 'staff' || !user.staffRole) return new Set();

  const role = await Role.findById(user.staffRole);
  if (!role) return new Set();

  return new Set(
    Object.entries(GROUP_AREA)
      .filter(([, area]) => role.allows(area, 'view'))
      .map(([group]) => group),
  );
}

/**
 * Searches every group the caller may see.
 *
 * Returns `{ groups: [...] }` with empty groups omitted, so the palette renders
 * what matched rather than nine headings with one row under them.
 */
async function search(term, user) {
  const q = typeof term === 'string' ? term.trim() : '';
  // Two characters is the floor everywhere else in this codebase
  // (`searchProducts` uses the same), and a one-character regex matches most of
  // the catalogue.
  if (q.length < 2) return { groups: [], query: q };

  const allowed = await allowedGroups(user);
  if (allowed.size === 0) return { groups: [], query: q };

  const rx = likeRegex(q);
  const runners = [];

  if (allowed.has('clients')) {
    runners.push(
      User.find({ role: 'buyer', $or: [{ businessName: rx }, { email: rx }, { contactName: rx }] })
        .select('businessName contactName email status')
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'clients',
          label: 'Clients',
          icon: 'Users',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.businessName || row.contactName || row.email,
            detail: row.email,
            badge: row.status,
            to: `/admin/clients/${row._id}`,
          })),
        })),
    );
  }

  if (allowed.has('orders')) {
    runners.push(
      Order.find({ $or: [{ orderNumber: rx }, { 'shippingAddress.company': rx }] })
        .select('orderNumber status total createdAt')
        .sort({ createdAt: -1 })
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'orders',
          label: 'Orders',
          icon: 'Package',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.orderNumber,
            detail: row.status,
            to: `/admin/orders/${row.orderNumber}`,
          })),
        })),
    );
  }

  if (allowed.has('invoices')) {
    runners.push(
      Invoice.find({ number: rx })
        .select('number status amount')
        .sort({ issuedAt: -1 })
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'invoices',
          label: 'Invoices',
          icon: 'FileText',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.number,
            detail: row.status,
            to: `/admin/invoices/${row.number}`,
          })),
        })),
    );
  }

  if (allowed.has('quotes')) {
    runners.push(
      Quote.find({ quoteNumber: rx })
        .select('quoteNumber status')
        .sort({ createdAt: -1 })
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'quotes',
          label: 'Quotes',
          icon: 'FileSignature',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.quoteNumber,
            detail: row.status,
            to: `/admin/quotes/${row._id}`,
          })),
        })),
    );
  }

  if (allowed.has('rmas')) {
    runners.push(
      Rma.find({ rmaNumber: rx })
        .select('rmaNumber status')
        .sort({ createdAt: -1 })
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'rmas',
          label: 'RMAs',
          icon: 'RotateCcw',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.rmaNumber,
            detail: row.status,
            to: `/admin/rma/${row._id}`,
          })),
        })),
    );
  }

  if (allowed.has('products')) {
    runners.push(
      Product.find({ $or: [{ name: rx }, { sku: rx }, { searchTerms: rx }] })
        .select('name sku stock')
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'products',
          label: 'Inventory',
          icon: 'Boxes',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.name,
            detail: row.sku,
            to: `/admin/inventory/${row._id}`,
          })),
        })),
    );
  }

  if (allowed.has('suppliers')) {
    runners.push(
      Supplier.find({ $or: [{ name: rx }, { code: rx }, { email: rx }] })
        .select('name code')
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'suppliers',
          label: 'Suppliers',
          icon: 'Truck',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.name,
            detail: row.code,
            to: `/admin/suppliers/${row._id}`,
          })),
        })),
    );
  }

  if (allowed.has('purchaseOrders')) {
    runners.push(
      PurchaseOrder.find({ poNumber: rx })
        .select('poNumber status')
        .sort({ createdAt: -1 })
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'purchaseOrders',
          label: 'Purchase orders',
          icon: 'ClipboardList',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.poNumber,
            detail: row.status,
            to: `/admin/purchase-orders/${row._id}`,
          })),
        })),
    );
  }

  if (allowed.has('outlets')) {
    runners.push(
      Outlet.find({ $or: [{ name: rx }, { code: rx }] })
        .select('name code')
        .limit(PER_GROUP)
        .lean()
        .then((rows) => ({
          key: 'outlets',
          label: 'Outlets',
          icon: 'Store',
          hits: rows.map((row) => ({
            id: row._id.toString(),
            title: row.name,
            detail: row.code,
            to: `/admin/outlets/${row._id}`,
          })),
        })),
    );
  }

  const groups = await Promise.all(runners);

  return {
    query: q,
    // Empty groups are dropped rather than rendered as headings with nothing
    // under them.
    groups: groups.filter((group) => group.hits.length > 0),
  };
}

export default { search };

export { search };
