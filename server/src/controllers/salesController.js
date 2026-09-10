import { asyncHandler } from '../utils/ApiError.js';
import * as quoteService from '../services/quoteService.js';
import * as rmaService from '../services/rmaService.js';
import auditService from '../services/auditService.js';

/**
 * Quotes and RMAs (ERP rework §6.3, §6.6).
 *
 * Thin, like every controller here. Two rules live in the services and must not
 * be reachable around them: a quote's conversion re-prices against live
 * products, and an RMA refund moves money only through `storeCreditService`.
 */

// ---- quotes -----------------------------------------------------------------

const listQuotes = asyncHandler(async (req, res) => {
  res.json(await quoteService.listQuotes({ ...req.query, business: req.businessScope }));
});

const getQuote = asyncHandler(async (req, res) => {
  res.json(await quoteService.getQuote(req.params.id));
});

const createQuote = asyncHandler(async (req, res) => {
  res.status(201).json(await quoteService.createQuote(req.body, req.user._id));
});

const updateQuote = asyncHandler(async (req, res) => {
  res.json(await quoteService.updateQuote(req.params.id, req.body));
});

const setQuoteStatus = asyncHandler(async (req, res) => {
  res.json(await quoteService.setQuoteStatus(req.params.id, req.body));
});

/**
 * Accept → convert. Refuses with `QUOTE_PRICE_DRIFT` and the full comparison
 * when catalogue prices have moved and the admin has not acknowledged them.
 */
const convertQuote = asyncHandler(async (req, res) => {
  res.status(201).json(await quoteService.convertQuote(req.params.id, req.body, req.user._id));
});

/** The other destination: a repair estimate becomes the ticket that does it. */
const convertQuoteToTicket = asyncHandler(async (req, res) => {
  res
    .status(201)
    .json(await quoteService.convertQuoteToTicket(req.params.id, req.body, req.user));
});

const deleteQuote = asyncHandler(async (req, res) => {
  res.json(await quoteService.deleteQuote(req.params.id));
});

// ---- RMA --------------------------------------------------------------------

const listRmas = asyncHandler(async (req, res) => {
  res.json(await rmaService.listRmas({ ...req.query, business: req.businessScope }));
});

const getRma = asyncHandler(async (req, res) => {
  res.json(await rmaService.getRma(req.params.id));
});

const createRma = asyncHandler(async (req, res) => {
  res.status(201).json(await rmaService.createRma(req.body, req.user._id));
});

const setRmaStatus = asyncHandler(async (req, res) => {
  res.json(await rmaService.setRmaStatus(req.params.id, req.body));
});

const inspectRma = asyncHandler(async (req, res) => {
  res.json(await rmaService.inspectRma(req.params.id, req.body));
});

/**
 * Refund routes through `storeCreditService`; restock through the ledger.
 *
 * Named in §7.6 as money-moving, so it is always audited with actor and IP —
 * this is the one RMA step that both refunds a customer and returns stock.
 */
const resolveRma = asyncHandler(async (req, res) => {
  const result = await rmaService.resolveRma(req.params.id, req.body, req.user._id);
  const rma = result?.rma ?? result;

  await auditService.record({
    req,
    action: 'rma.resolve',
    entity: { kind: 'rma', id: req.params.id, label: rma?.rmaNumber ?? '' },
    after: {
      status: rma?.status ?? null,
      resolution: req.body?.resolution ?? '',
      amountDollars: req.body?.amountDollars ?? null,
      // Named by the service rather than taken from the request: an operator
      // who restocked nothing should see that they restocked nothing.
      restocked: result?.restocked ?? null,
    },
    description: `Resolved ${rma?.rmaNumber ?? req.params.id}.`,
  });

  res.json(result);
});

export { listQuotes, getQuote, createQuote, updateQuote, setQuoteStatus, convertQuote, convertQuoteToTicket, deleteQuote, listRmas, getRma, createRma, setRmaStatus, inspectRma, resolveRma };
