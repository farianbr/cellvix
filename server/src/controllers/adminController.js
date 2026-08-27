import { randomBytes } from 'node:crypto';
import { asyncHandler } from '../utils/ApiError.js';
import * as adminService from '../services/adminService.js';

// `from` and `to` are inclusive `YYYY-MM-DD` days; the service owns end-of-day
// and the default window, so both halves cannot disagree about what a range is.
export const stats = asyncHandler(async (req, res) => {
  res.json(await adminService.stats({ from: req.query.from, to: req.query.to }));
});

// ---- customers --------------------------------------------------------------

export const listUsers = asyncHandler(async (req, res) => {
  res.json(await adminService.listUsers(req.query));
});

export const getUser = asyncHandler(async (req, res) => {
  res.json(await adminService.getUser(req.params.id));
});

export const approveUser = asyncHandler(async (req, res) => {
  const user = await adminService.approveUser(req.params.id, req.user._id, req.body);
  res.json({ user });
});

export const rejectUser = asyncHandler(async (req, res) => {
  res.json({ user: await adminService.rejectUser(req.params.id, req.body) });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  res.json({ user: await adminService.setUserStatus(req.params.id, req.body) });
});

export const setCredit = asyncHandler(async (req, res) => {
  res.json({ user: await adminService.setCredit(req.params.id, req.body) });
});

// ---- products ---------------------------------------------------------------

export const listProducts = asyncHandler(async (req, res) => {
  res.json(await adminService.listProducts(req.query));
});

export const createProduct = asyncHandler(async (req, res) => {
  res.status(201).json({ product: await adminService.createProduct(req.body) });
});

export const updateProduct = asyncHandler(async (req, res) => {
  res.json({ product: await adminService.updateProduct(req.params.id, req.body) });
});

export const toggleProduct = asyncHandler(async (req, res) => {
  res.json({ product: await adminService.deactivateProduct(req.params.id) });
});

// ---- orders -----------------------------------------------------------------

export const listOrders = asyncHandler(async (req, res) => {
  res.json(await adminService.listOrders(req.query));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  res.json({ order: await adminService.updateOrderStatus(req.params.orderNumber, req.body) });
});

export const allocateStoreCredit = asyncHandler(async (req, res) => {
  res.status(201).json(await adminService.allocateStoreCredit(req.params.id, req.body, req.user._id));
});

export const storeCreditStatement = asyncHandler(async (req, res) => {
  res.json(await adminService.storeCreditStatement(req.params.id));
});

export const refundOrder = asyncHandler(async (req, res) => {
  res.status(201).json(await adminService.refundOrder(req.params.orderNumber, req.body, req.user._id));
});

// ---- invoices ---------------------------------------------------------------

export const listInvoices = asyncHandler(async (req, res) => {
  res.json(await adminService.listInvoices(req.query));
});

export const getInvoice = asyncHandler(async (req, res) => {
  res.json(await adminService.getInvoice(req.params.number));
});

export const recordInvoicePayment = asyncHandler(async (req, res) => {
  res.status(201).json(await adminService.recordPayment(req.params.number, req.body));
});

export const voidInvoice = asyncHandler(async (req, res) => {
  res.json(await adminService.voidInvoice(req.params.number, req.body));
});

// ---- client profile ---------------------------------------------------------

export const userActivity = asyncHandler(async (req, res) => {
  res.json(await adminService.userActivity(req.params.id));
});

// ---- bulk -------------------------------------------------------------------

// Partial by design: the response names what moved and what did not, and the
// UI shows the skips rather than reporting a clean success.
export const bulkUpdateOrderStatus = asyncHandler(async (req, res) => {
  res.json(await adminService.bulkUpdateOrderStatus(req.body));
});

/**
 * The invoice document, for an admin.
 *
 * Same per-response CSP as the buyer-facing route: Helmet's global policy
 * forbids inline script, the page needs exactly one line of it for the print
 * button, and loosening the policy app-wide to serve one document would be the
 * wrong trade. Nothing loads; the one nonced script may run.
 */
export const invoiceDocument = asyncHandler(async (req, res) => {
  const nonce = randomBytes(16).toString('base64');
  const html = await adminService.invoiceDocument(req.params.number, { nonce });

  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src data:",
      `script-src 'nonce-${nonce}'`,
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; '),
  );
  res.type('html').send(html);
});
