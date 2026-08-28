import { asyncHandler } from '../utils/ApiError.js';
import * as marketingService from '../services/marketingService.js';

/**
 * Marketing — calls, SMS, WhatsApp, email campaigns and consent (§6.13, phase 9).
 *
 * Thin, like every other controller here. Two things this layer adds and the
 * service cannot: the acting staff member, taken from the session so a message
 * can never claim to be from somebody else, and the channel, which comes from
 * the route rather than the body — a request must not be able to nominate the
 * channel it is sent on.
 */

// ---- messages ---------------------------------------------------------------

export const listMessages = asyncHandler(async (req, res) => {
  res.json(await marketingService.listMessages(req.query));
});

/**
 * One handler per channel, each closing over its own channel name.
 *
 * The alternative — reading `req.body.channel` — would let a caller compose on
 * the SMS screen and have it sent as email. The route knows which screen it
 * serves; the body does not get a vote.
 */
const composer = (channel) =>
  asyncHandler(async (req, res) => {
    res.status(201).json(await marketingService.sendMessage(channel, req.body, req.user));
  });

export const sendSms = composer('sms');
export const sendWhatsapp = composer('whatsapp');
export const sendEmail = composer('email');
export const logCall = composer('call');

// ---- templates --------------------------------------------------------------

export const listTemplates = asyncHandler(async (req, res) => {
  res.json(await marketingService.listTemplates(req.query));
});

export const createTemplate = asyncHandler(async (req, res) => {
  res.status(201).json(await marketingService.createTemplate(req.body, req.user));
});

export const updateTemplate = asyncHandler(async (req, res) => {
  res.json(await marketingService.updateTemplate(req.params.id, req.body));
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  res.json(await marketingService.deleteTemplate(req.params.id));
});

// ---- campaigns --------------------------------------------------------------

export const listCampaigns = asyncHandler(async (req, res) => {
  res.json(await marketingService.listCampaigns(req.query));
});

export const getCampaign = asyncHandler(async (req, res) => {
  res.json(await marketingService.getCampaign(req.params.id));
});

export const createCampaign = asyncHandler(async (req, res) => {
  res.status(201).json(await marketingService.createCampaign(req.body, req.user));
});

export const updateCampaign = asyncHandler(async (req, res) => {
  res.json(await marketingService.updateCampaign(req.params.id, req.body));
});

export const deleteCampaign = asyncHandler(async (req, res) => {
  res.json(await marketingService.deleteCampaign(req.params.id));
});

export const sendCampaign = asyncHandler(async (req, res) => {
  res.json(await marketingService.sendCampaign(req.params.id, req.user));
});

// ---- consent ----------------------------------------------------------------

export const listUnsubscribes = asyncHandler(async (req, res) => {
  res.json(await marketingService.listUnsubscribes(req.query));
});

export const resubscribe = asyncHandler(async (req, res) => {
  res.json(await marketingService.resubscribe(req.params.id));
});

/**
 * The public unsubscribe. No session, by design — see the service. The HMAC in
 * the link is what authorises it.
 */
export const unsubscribe = asyncHandler(async (req, res) => {
  res.json(await marketingService.unsubscribe(req.body.u, req.body.t));
});

// ---- overview ---------------------------------------------------------------

export const summary = asyncHandler(async (_req, res) => {
  res.json(await marketingService.summary());
});
