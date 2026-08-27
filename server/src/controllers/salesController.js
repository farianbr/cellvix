import { asyncHandler } from '../utils/ApiError.js';
import * as quoteService from '../services/quoteService.js';
import * as rmaService from '../services/rmaService.js';

/**
 * Quotes and RMAs (ERP rework §6.3, §6.6).
 *
 * Thin, like every controller here. Two rules live in the services and must not
 * be reachable around them: a quote's conversion re-prices against live
 * products, and an RMA refund moves money only through `storeCreditService`.
 */

// ---- quotes -----------------------------------------------------------------

export const listQuotes = asyncHandler(async (req, res) => {
  res.json(await quoteService.listQuotes(req.query));
});

export const getQuote = asyncHandler(async (req, res) => {
  res.json(await quoteService.getQuote(req.params.id));
});

export const createQuote = asyncHandler(async (req, res) => {
  res.status(201).json(await quoteService.createQuote(req.body, req.user._id));
});

export const updateQuote = asyncHandler(async (req, res) => {
  res.json(await quoteService.updateQuote(req.params.id, req.body));
});

export const setQuoteStatus = asyncHandler(async (req, res) => {
  res.json(await quoteService.setQuoteStatus(req.params.id, req.body));
});

/**
 * Accept → convert. Refuses with `QUOTE_PRICE_DRIFT` and the full comparison
 * when catalogue prices have moved and the admin has not acknowledged them.
 */
export const convertQuote = asyncHandler(async (req, res) => {
  res.status(201).json(await quoteService.convertQuote(req.params.id, req.body, req.user._id));
});

export const deleteQuote = asyncHandler(async (req, res) => {
  res.json(await quoteService.deleteQuote(req.params.id));
});

// ---- RMA --------------------------------------------------------------------

export const listRmas = asyncHandler(async (req, res) => {
  res.json(await rmaService.listRmas(req.query));
});

export const getRma = asyncHandler(async (req, res) => {
  res.json(await rmaService.getRma(req.params.id));
});

export const createRma = asyncHandler(async (req, res) => {
  res.status(201).json(await rmaService.createRma(req.body, req.user._id));
});

export const setRmaStatus = asyncHandler(async (req, res) => {
  res.json(await rmaService.setRmaStatus(req.params.id, req.body));
});

export const inspectRma = asyncHandler(async (req, res) => {
  res.json(await rmaService.inspectRma(req.params.id, req.body));
});

/** Refund routes through `storeCreditService`; restock through the ledger. */
export const resolveRma = asyncHandler(async (req, res) => {
  res.json(await rmaService.resolveRma(req.params.id, req.body, req.user._id));
});
