const { randomBytes } = require('node:crypto');
const { asyncHandler } = require('../utils/ApiError.js');
const { default: env } = require('../config/env.js');
const accountService = require('../services/accountService.js');

const summary = asyncHandler(async (req, res) => {
  res.json(await accountService.summary(req.user));
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await accountService.updateProfile(req.user, req.body);
  res.json({ user: user.toPublic() });
});

const addAddress = asyncHandler(async (req, res) => {
  const user = await accountService.addAddress(req.user, req.body);
  res.status(201).json({ user: user.toPublic() });
});

const updateAddress = asyncHandler(async (req, res) => {
  const user = await accountService.updateAddress(req.user, req.params.addressId, req.body);
  res.json({ user: user.toPublic() });
});

const removeAddress = asyncHandler(async (req, res) => {
  const user = await accountService.removeAddress(req.user, req.params.addressId);
  res.json({ user: user.toPublic() });
});

const addPaymentMethod = asyncHandler(async (req, res) => {
  const user = await accountService.addPaymentMethod(req.user, req.body);
  res.status(201).json({ user: user.toPublic() });
});

const removePaymentMethod = asyncHandler(async (req, res) => {
  const user = await accountService.removePaymentMethod(req.user, req.params.methodId);
  res.json({ user: user.toPublic() });
});

const changePassword = asyncHandler(async (req, res) => {
  await accountService.changePassword(req.user, req.body);
  res.status(204).end();
});

const listInvoices = asyncHandler(async (req, res) => {
  res.json(await accountService.listInvoices(req.user._id));
});

const getInvoice = asyncHandler(async (req, res) => {
  res.json({ invoice: await accountService.getInvoice(req.user._id, req.params.number) });
});

/**
 * The invoice as a printable page rather than JSON — the dashboard's PDF button
 * opens it and the browser's print dialog does the rest.
 *
 * Helmet's global CSP forbids inline script, and the page needs exactly one
 * line of it for the print button. Rather than loosening the policy for the
 * whole app, this response carries its own: nothing loads, and the one nonced
 * script may run.
 */
const invoiceDocument = asyncHandler(async (req, res) => {
  const nonce = randomBytes(16).toString('base64');
  const html = await accountService.invoiceDocument(req.user, req.params.number, {
    nonce,
    // The browser copy gets an origin too, so an unpaid document can link back
    // to the screen that pays it. It is a link and not a form on purpose: the
    // CSP below sets `form-action 'none'`, and loosening that to let an invoice
    // post somewhere would undo the point of giving this response its own
    // policy at all.
    //
    // `env.publicOrigin` rather than this request's own host: the document is
    // served by the API, and the link has to land on the storefront.
    origin: env.publicOrigin,
  });

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

const storeCredit = asyncHandler(async (req, res) => {
  res.json(await accountService.storeCreditStatement(req.user._id));
});

const creditActivity = asyncHandler(async (req, res) => {
  res.json(await accountService.lineOfCreditActivity(req.user));
});

const rechargeStoreCredit = asyncHandler(async (req, res) => {
  res.status(201).json(await accountService.rechargeStoreCredit(req.user, req.body));
});

const payInvoice = asyncHandler(async (req, res) => {
  res.status(201).json(await accountService.payInvoice(req.user, req.params.number, req.body));
});

const payOffCredit = asyncHandler(async (req, res) => {
  res.status(201).json(await accountService.payOffCredit(req.user, req.body));
});

const activity = asyncHandler(async (req, res) => {
  res.json(await accountService.activity(req.user._id));
});

const referrals = asyncHandler(async (req, res) => {
  res.json(await accountService.referrals(req.user));
});

// --- CommonJS exports -------------------------------------------------
exports.summary = summary;
exports.updateProfile = updateProfile;
exports.addAddress = addAddress;
exports.updateAddress = updateAddress;
exports.removeAddress = removeAddress;
exports.addPaymentMethod = addPaymentMethod;
exports.removePaymentMethod = removePaymentMethod;
exports.changePassword = changePassword;
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.invoiceDocument = invoiceDocument;
exports.storeCredit = storeCredit;
exports.creditActivity = creditActivity;
exports.rechargeStoreCredit = rechargeStoreCredit;
exports.payInvoice = payInvoice;
exports.payOffCredit = payOffCredit;
exports.activity = activity;
exports.referrals = referrals;
