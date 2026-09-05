import { asyncHandler } from '../utils/ApiError.js';
import rfqService from '../services/rfqService.js';
import auditService from '../services/auditService.js';

/**
 * Requests for quote — the admin half (supplier process flow, §6.8a).
 *
 * Thin, like every other controller here: `rfqService` owns the rules, so the
 * "one supplier never sees another's price" boundary and the award-raises-a-PO
 * path cannot be sidestepped by a second route reaching the model directly.
 */

const listRfqs = asyncHandler(async (req, res) => {
  res.json(await rfqService.listRfqs(req.query));
});

const getRfq = asyncHandler(async (req, res) => {
  res.json(await rfqService.getRfq(req.params.id));
});

/**
 * The supplier picker.
 *
 * Answers nothing when no component type is given — see the service. A GET
 * because it is a lookup: the clerk ticks component types and the list of
 * suppliers who carry them appears, with no request body involved.
 */
const suppliersForComponentTypes = asyncHandler(async (req, res) => {
  // `?componentTypes=battery,screen-assembly`, and a repeated
  // `?componentTypes=a&componentTypes=b` still arrives as an array — the same
  // two shapes `taxonomyController` normalises for `partType`.
  const raw = req.query.componentTypes ?? req.query.componentType;
  const types = Array.isArray(raw)
    ? raw.flatMap((value) => String(value).split(','))
    : String(raw ?? '').split(',');

  res.json(await rfqService.suppliersForComponentTypes(types));
});

const createRfq = asyncHandler(async (req, res) => {
  const result = await rfqService.createRfq(req.body, req.user._id);
  await auditService.record({
    req,
    action: 'rfq.create',
    entity: { kind: 'rfq', id: result.rfq.id, label: result.rfq.rfqNumber },
  });
  res.status(201).json(result);
});

const updateRfq = asyncHandler(async (req, res) => {
  res.json(await rfqService.updateRfq(req.params.id, req.body));
});

const sendRfq = asyncHandler(async (req, res) => {
  const result = await rfqService.sendRfq(req.params.id, req.body);
  await auditService.record({
    req,
    action: 'rfq.send',
    entity: { kind: 'rfq', id: result.rfq.id, label: result.rfq.rfqNumber },
    description: `Sent to ${result.sent.length} supplier(s)${result.failed.length ? `, ${result.failed.length} failed` : ''}.`,
  });
  res.json(result);
});

const inviteSupplier = asyncHandler(async (req, res) => {
  res.json(await rfqService.inviteSupplier(req.params.id, req.body.supplier));
});

/**
 * Accept a quote. Audited by name because it is the moment money is committed
 * to one supplier over the others, and "who chose this, and when" is the first
 * question anybody asks about a purchase later.
 */
const awardRfq = asyncHandler(async (req, res) => {
  const result = await rfqService.awardRfq(req.params.id, req.body, req.user._id);
  await auditService.record({
    req,
    action: 'rfq.award',
    entity: { kind: 'rfq', id: result.rfq.id, label: result.rfq.rfqNumber },
    description: `${result.rfq.rfqNumber} awarded — raised ${result.purchaseOrder.poNumber}.`,
  });
  res.json(result);
});

const cancelRfq = asyncHandler(async (req, res) => {
  res.json(await rfqService.cancelRfq(req.params.id, req.body));
});

export {
  awardRfq,
  cancelRfq,
  createRfq,
  getRfq,
  inviteSupplier,
  listRfqs,
  sendRfq,
  suppliersForComponentTypes,
  updateRfq,
};
