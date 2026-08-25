import { randomBytes } from 'node:crypto';
import { asyncHandler } from '../utils/ApiError.js';
import * as accountService from '../services/accountService.js';

export const summary = asyncHandler(async (req, res) => {
  res.json(await accountService.summary(req.user));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await accountService.updateProfile(req.user, req.body);
  res.json({ user: user.toPublic() });
});

export const addAddress = asyncHandler(async (req, res) => {
  const user = await accountService.addAddress(req.user, req.body);
  res.status(201).json({ user: user.toPublic() });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const user = await accountService.updateAddress(req.user, req.params.addressId, req.body);
  res.json({ user: user.toPublic() });
});

export const removeAddress = asyncHandler(async (req, res) => {
  const user = await accountService.removeAddress(req.user, req.params.addressId);
  res.json({ user: user.toPublic() });
});

export const addPaymentMethod = asyncHandler(async (req, res) => {
  const user = await accountService.addPaymentMethod(req.user, req.body);
  res.status(201).json({ user: user.toPublic() });
});

export const removePaymentMethod = asyncHandler(async (req, res) => {
  const user = await accountService.removePaymentMethod(req.user, req.params.methodId);
  res.json({ user: user.toPublic() });
});

export const changePassword = asyncHandler(async (req, res) => {
  await accountService.changePassword(req.user, req.body);
  res.status(204).end();
});

export const listInvoices = asyncHandler(async (req, res) => {
  res.json(await accountService.listInvoices(req.user._id));
});

export const getInvoice = asyncHandler(async (req, res) => {
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
export const invoiceDocument = asyncHandler(async (req, res) => {
  const nonce = randomBytes(16).toString('base64');
  const html = await accountService.invoiceDocument(req.user, req.params.number, { nonce });

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

export const storeCredit = asyncHandler(async (req, res) => {
  res.json(await accountService.storeCreditStatement(req.user._id));
});

export const creditActivity = asyncHandler(async (req, res) => {
  res.json(await accountService.lineOfCreditActivity(req.user));
});

export const rechargeStoreCredit = asyncHandler(async (req, res) => {
  res.status(201).json(await accountService.rechargeStoreCredit(req.user, req.body));
});
