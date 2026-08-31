const { asyncHandler } = require('../utils/ApiError.js');
const service = require('../services/supplierReturnService.js');
const auditService = require('../services/auditService.js');

/**
 * Returns to a supplier. Audit hooks live here rather than in the service, for
 * the reason `adminController` states: the request is the only thing that knows
 * the actor and the IP, and every row is written **after** the operation
 * returned so the log never claims something that then failed.
 */

const list = asyncHandler(async (req, res) => {
  res.json(await service.listReturns(req.query));
});

const get = asyncHandler(async (req, res) => {
  res.json(await service.getReturn(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { supplierReturn } = await service.createReturn(req.body, req.user._id);

  await auditService.record({
    req,
    action: 'supplier_return.create',
    entity: {
      kind: 'supplierReturn',
      id: supplierReturn.id,
      label: supplierReturn.returnNumber,
    },
    after: {
      supplier: supplierReturn.supplierName,
      items: supplierReturn.itemCount,
      expectedCredit: supplierReturn.expectedCredit,
    },
    description: `Opened ${supplierReturn.returnNumber} against ${supplierReturn.supplierName}.`,
  });

  res.status(201).json({ supplierReturn });
});

const setStatus = asyncHandler(async (req, res) => {
  const { supplierReturn } = await service.setStatus(req.params.id, req.body, req.user._id);

  await auditService.record({
    req,
    action: 'supplier_return.status',
    entity: {
      kind: 'supplierReturn',
      id: supplierReturn.id,
      label: supplierReturn.returnNumber,
    },
    after: { status: supplierReturn.status },
    // Shipping is the rung that moves stock, so the description says so —
    // an audit row that reads the same for every transition is not much of one.
    description:
      supplierReturn.status === 'shipped'
        ? `Shipped ${supplierReturn.returnNumber} back to ${supplierReturn.supplierName}; stock adjusted.`
        : `Moved ${supplierReturn.returnNumber} to ${supplierReturn.status}.`,
  });

  res.json({ supplierReturn });
});

/** Money coming back from a supplier, so this is always audited. */
const recordCredit = asyncHandler(async (req, res) => {
  const amount = Math.round(Number(req.body.amountDollars) * 100);
  const { supplierReturn } = await service.recordCredit(
    req.params.id,
    { amount, reference: req.body.reference, note: req.body.note },
    req.user._id,
  );

  await auditService.record({
    req,
    action: 'supplier_return.credit',
    entity: {
      kind: 'supplierReturn',
      id: supplierReturn.id,
      label: supplierReturn.returnNumber,
    },
    after: {
      creditAmount: supplierReturn.creditAmount,
      expectedCredit: supplierReturn.expectedCredit,
      shortfall: supplierReturn.creditShortfall,
      reference: supplierReturn.creditReference ?? '',
    },
    description: `Recorded a credit on ${supplierReturn.returnNumber}.`,
  });

  res.json({ supplierReturn });
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteReturn(req.params.id);

  await auditService.record({
    req,
    action: 'supplier_return.delete',
    entity: { kind: 'supplierReturn', id: req.params.id, label: String(req.params.id) },
    description: 'Deleted a supplier return.',
  });

  res.json(result);
});

exports.list = list;
exports.get = get;
exports.create = create;
exports.setStatus = setStatus;
exports.recordCredit = recordCredit;
exports.remove = remove;
