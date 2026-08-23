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

export const storeCredit = asyncHandler(async (req, res) => {
  res.json(await accountService.storeCreditStatement(req.user._id));
});

export const rechargeStoreCredit = asyncHandler(async (req, res) => {
  res.status(201).json(await accountService.rechargeStoreCredit(req.user, req.body));
});
