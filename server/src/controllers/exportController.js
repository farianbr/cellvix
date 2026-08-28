import { asyncHandler } from '../utils/ApiError.js';
import * as adminService from '../services/adminService.js';
import * as purchaseService from '../services/purchaseService.js';
import * as exportService from '../services/exportService.js';

/**
 * List exports (ERP rework §7.4, phase 12b).
 *
 * **Every export calls the same service function the screen called, with the
 * same query.** §7.4: "an export that ignores active filters is a bug, not a
 * shortcut." Re-querying with a second implementation would agree with the list
 * right up until one of them changed — so `req.query` goes through untouched
 * and the rows that come back are the rows that get formatted.
 *
 * That also means each export inherits its list's permission guard from the
 * route, rather than having a second, weaker one of its own.
 *
 * **Money is exported as a number, not `$1,234.56`.** A formatted string in a
 * spreadsheet cannot be summed, which defeats the point of exporting it.
 *
 * **One inherited limitation, stated rather than hidden.** `listUsers` and
 * `listOrders` cap at 200 rows and `listExpenses` at 300 — ceilings the screens
 * were built with, well above today's data. An export inherits them, so at that
 * volume it would return a truncated file that looks complete. Inventory has
 * already been given an explicit `all` flag because the catalogue is past its
 * cap; the other three need the same treatment before this business outgrows
 * them, and that is a change to those services rather than to this file.
 */

const { asMoney, asDate } = exportService;

/** Pulled off `?format=`; anything that is not xlsx is CSV. */
const formatOf = (req) => (req.query.format === 'xlsx' ? 'xlsx' : 'csv');

export const clients = asyncHandler(async (req, res) => {
  const { users } = await adminService.listUsers(req.query);

  exportService.send(res, {
    format: formatOf(req),
    filename: 'clients',
    sheetName: 'Clients',
    rows: users,
    columns: [
      { label: 'Business', get: (row) => row.businessName },
      { label: 'Contact', get: (row) => row.contactName },
      { label: 'Email', get: (row) => row.email },
      { label: 'Phone', get: (row) => row.phone },
      { label: 'Status', get: (row) => row.status },
      { label: 'Terms', get: (row) => row.terms },
      { label: 'Credit limit', get: (row) => asMoney(row.creditLimit) },
      { label: 'Balance', get: (row) => asMoney(row.balance) },
      { label: 'Store credit', get: (row) => asMoney(row.storeCredit) },
      { label: 'Joined', get: (row) => asDate(row.createdAt) },
    ],
  });
});

export const orders = asyncHandler(async (req, res) => {
  const { orders: rows } = await adminService.listOrders(req.query);

  exportService.send(res, {
    format: formatOf(req),
    filename: 'orders',
    sheetName: 'Orders',
    rows,
    columns: [
      { label: 'Order', get: (row) => row.orderNumber },
      { label: 'Business', get: (row) => row.businessName },
      { label: 'Status', get: (row) => row.status },
      { label: 'Placed', get: (row) => asDate(row.createdAt) },
      { label: 'Items', get: (row) => row.items?.length ?? 0 },
      { label: 'Subtotal', get: (row) => asMoney(row.subtotal) },
      { label: 'Discount', get: (row) => asMoney(row.discount) },
      { label: 'Shipping', get: (row) => asMoney(row.shipping) },
      { label: 'Tax', get: (row) => asMoney(row.tax) },
      { label: 'Total', get: (row) => asMoney(row.total) },
      { label: 'Store credit used', get: (row) => asMoney(row.storeCreditApplied) },
      { label: 'Refunded', get: (row) => asMoney(row.refundedTotal) },
      { label: 'PO number', get: (row) => row.poNumber },
    ],
  });
});

export const invoices = asyncHandler(async (req, res) => {
  const { invoices: rows } = await adminService.listInvoices(req.query);

  exportService.send(res, {
    format: formatOf(req),
    filename: 'invoices',
    sheetName: 'Invoices',
    rows,
    columns: [
      { label: 'Invoice', get: (row) => row.number },
      { label: 'Order', get: (row) => row.orderNumber },
      { label: 'Business', get: (row) => row.businessName },
      // The list derives `overdue` rather than storing it, and the export shows
      // what the screen shows — not the raw stored status.
      { label: 'Status', get: (row) => row.status },
      { label: 'Issued', get: (row) => asDate(row.issuedAt) },
      { label: 'Due', get: (row) => asDate(row.dueDate) },
      { label: 'Terms', get: (row) => row.terms },
      { label: 'Amount', get: (row) => asMoney(row.amount) },
      { label: 'Paid', get: (row) => asMoney(row.amountPaid) },
      { label: 'Balance', get: (row) => asMoney(row.balance) },
    ],
  });
});

export const inventory = asyncHandler(async (req, res) => {
  // The screen paginates at 40 and the service caps a page at 100; an export of
  // the first hundred of four hundred parts is not an export, it is a quiet
  // data loss. `all` lifts the cap — the filters themselves go through
  // untouched.
  const { products } = await adminService.listProducts({ ...req.query, all: true });

  exportService.send(res, {
    format: formatOf(req),
    filename: 'inventory',
    sheetName: 'Inventory',
    rows: products,
    columns: [
      { label: 'SKU', get: (row) => row.sku },
      { label: 'Name', get: (row) => row.name },
      { label: 'Brand', get: (row) => row.brandName },
      { label: 'Model', get: (row) => row.modelName },
      { label: 'Part type', get: (row) => row.partTypeLabel },
      { label: 'Grade', get: (row) => row.grade },
      { label: 'Price', get: (row) => asMoney(row.price) },
      // No cost column: `shapeProduct` does not carry `unitCost`, and widening
      // it to feed an export would put margin into a serializer that several
      // other screens read. The Inventory detail screen and the reports are
      // where cost lives.
      { label: 'Stock', get: (row) => row.stock },
      { label: 'Active', get: (row) => (row.isActive === false ? 'no' : 'yes') },
    ],
  });
});

export const expenses = asyncHandler(async (req, res) => {
  const { expenses: rows } = await purchaseService.listExpenses(req.query);

  exportService.send(res, {
    format: formatOf(req),
    filename: 'expenses',
    sheetName: 'Expenses',
    rows,
    columns: [
      { label: 'Date', get: (row) => asDate(row.date) },
      { label: 'Description', get: (row) => row.description },
      // `category` is the populated object, not an id — the name is what
      // belongs in a spreadsheet.
      { label: 'Category', get: (row) => row.category?.name ?? '' },
      { label: 'Payee', get: (row) => row.payee },
      { label: 'Method', get: (row) => row.method },
      { label: 'Status', get: (row) => row.status },
      { label: 'Amount', get: (row) => asMoney(row.amount) },
      { label: 'Tax', get: (row) => asMoney(row.tax) },
      { label: 'Reference', get: (row) => row.reference },
    ],
  });
});
