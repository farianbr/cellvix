import { randomBytes } from 'node:crypto';
import { asyncHandler } from '../utils/ApiError.js';
import * as adminService from '../services/adminService.js';
import * as auditService from '../services/auditService.js';
import User from '../models/User.js';

/**
 * **Audit hooks live in the controller, not the service** (§7.5, phase 11b).
 *
 * The request is the only thing that knows the actor and the IP, and a service
 * reaching for `req` is the pattern this codebase already refuses elsewhere
 * (see `authService.register`, which takes `{ ip }` rather than the request).
 * Controllers here are thin wrappers, so this is also where a mutation is
 * unambiguously "done" — every row is written **after** the operation returned,
 * never before, so the log never claims something that then failed.
 *
 * `record` never throws, so none of these need a `try`.
 */

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

  await auditService.record({
    req,
    action: 'user.approve',
    entity: { kind: 'user', id: req.params.id, label: user.businessName ?? user.email },
    after: { status: user.status, creditLimit: user.creditLimit, terms: user.terms },
    description: `Approved ${user.businessName ?? user.email} with a ${user.terms} limit.`,
  });

  res.json({ user });
});

export const rejectUser = asyncHandler(async (req, res) => {
  const user = await adminService.rejectUser(req.params.id, req.body);

  await auditService.record({
    req,
    action: 'user.reject',
    entity: { kind: 'user', id: req.params.id, label: user.businessName ?? user.email },
    after: { status: user.status, reason: req.body?.reason ?? '' },
    description: `Rejected ${user.businessName ?? user.email}.`,
  });

  res.json({ user });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await adminService.setUserStatus(req.params.id, req.body);

  // Suspending an account is a security event as well as an administrative
  // one — it is how somebody's access is taken away — so it lands in the
  // security log rather than only in the activity feed.
  const kind = req.body?.status === 'suspended' ? 'security' : 'activity';

  await auditService.record({
    req,
    kind,
    action: 'user.status',
    entity: { kind: 'user', id: req.params.id, label: user.businessName ?? user.email },
    after: { status: user.status },
    description: `Set ${user.businessName ?? user.email} to ${user.status}.`,
  });

  res.json({ user });
});

/**
 * The **line of credit** — what Cellvix lends. Not store credit, which moves
 * only through `storeCreditService` and is logged separately below.
 */
export const setCredit = asyncHandler(async (req, res) => {
  // A lean read of the two fields rather than `getUser`, which also fetches ten
  // orders and ten invoices this does not need.
  const before = await User.findById(req.params.id).select('creditLimit terms').lean();
  const user = await adminService.setCredit(req.params.id, req.body);

  await auditService.record({
    req,
    action: 'user.credit_limit',
    entity: { kind: 'user', id: req.params.id, label: user.businessName ?? user.email },
    before: { creditLimit: before?.creditLimit ?? null, terms: before?.terms ?? null },
    after: { creditLimit: user.creditLimit, terms: user.terms },
    description: `Set the line of credit for ${user.businessName ?? user.email}.`,
  });

  res.json({ user });
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

export const getOrder = asyncHandler(async (req, res) => {
  res.json(await adminService.getOrder(req.params.orderNumber));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  res.json({ order: await adminService.updateOrderStatus(req.params.orderNumber, req.body) });
});

/**
 * **Store credit** — what the business already holds, moved through the one
 * service allowed to move it. §7.6 names this as money-moving and therefore
 * always audited with actor and IP.
 */
export const allocateStoreCredit = asyncHandler(async (req, res) => {
  const result = await adminService.allocateStoreCredit(req.params.id, req.body, req.user._id);

  await auditService.record({
    req,
    action: 'store_credit.allocate',
    entity: { kind: 'storeCredit', id: req.params.id, label: result?.entry?.type ?? '' },
    after: {
      // Cents, from the ledger entry itself rather than the dollars posted —
      // this is what actually moved.
      amount: result?.entry?.amount ?? null,
      type: result?.entry?.type ?? null,
      note: req.body?.note ?? '',
      // The resulting balance, so the row answers "what did this leave them
      // with" without a second lookup against a value that has since moved.
      balanceAfter: result?.balance ?? null,
    },
    description: `Store credit ${(result?.entry?.amount ?? 0) >= 0 ? 'added to' : 'deducted from'} account ${req.params.id}.`,
  });

  res.status(201).json(result);
});

export const storeCreditStatement = asyncHandler(async (req, res) => {
  res.json(await adminService.storeCreditStatement(req.params.id));
});

export const refundOrder = asyncHandler(async (req, res) => {
  const result = await adminService.refundOrder(req.params.orderNumber, req.body, req.user._id);

  await auditService.record({
    req,
    action: 'order.refund',
    entity: { kind: 'order', id: req.params.orderNumber, label: req.params.orderNumber },
    after: {
      amount: result?.entry?.amount ?? null,
      note: req.body?.note ?? '',
      balanceAfter: result?.balance ?? null,
      // Named by the service: a partial refund is normal, and the row should
      // say how much of the order has now been returned in total.
      refundedTotal: result?.refundedTotal ?? null,
    },
    description: `Refunded ${req.params.orderNumber} to store credit.`,
  });

  res.status(201).json(result);
});

// ---- invoices ---------------------------------------------------------------

export const listInvoices = asyncHandler(async (req, res) => {
  res.json(await adminService.listInvoices(req.query));
});

export const getInvoice = asyncHandler(async (req, res) => {
  res.json(await adminService.getInvoice(req.params.number));
});

export const recordInvoicePayment = asyncHandler(async (req, res) => {
  const result = await adminService.recordPayment(req.params.number, req.body);
  const invoice = result?.invoice ?? result;

  await auditService.record({
    req,
    action: 'invoice.payment',
    entity: { kind: 'invoice', id: req.params.number, label: req.params.number },
    after: {
      amountDollars: req.body?.amountDollars ?? null,
      method: req.body?.method ?? '',
      reference: req.body?.reference ?? '',
      // Recomputed server-side from the payment rows, so this is the invoice's
      // real position rather than what the caller believed it would be.
      amountPaid: invoice?.amountPaid ?? null,
      status: invoice?.status ?? null,
    },
    description: `Recorded a payment against ${req.params.number}.`,
  });

  res.status(201).json(result);
});

export const voidInvoice = asyncHandler(async (req, res) => {
  const result = await adminService.voidInvoice(req.params.number, req.body);
  const invoice = result?.invoice ?? result;

  await auditService.record({
    req,
    action: 'invoice.void',
    entity: { kind: 'invoice', id: req.params.number, label: req.params.number },
    after: { status: invoice?.status ?? 'void', reason: req.body?.reason ?? '' },
    description: `Voided ${req.params.number}${req.body?.reason ? ` — ${req.body.reason}` : ''}.`,
  });

  res.json(result);
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
