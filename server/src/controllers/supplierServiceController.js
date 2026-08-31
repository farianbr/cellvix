const { asyncHandler } = require('../utils/ApiError.js');
const service = require('../services/supplierServiceService.js');
const auditService = require('../services/auditService.js');

/**
 * Bought-in services and supplier subscriptions.
 *
 * Recording a charge writes real money into the P&L, so it is audited with the
 * expense number it produced — that is the row somebody follows when they ask
 * where a figure on the expense report came from.
 */

const list = asyncHandler(async (req, res) => {
  res.json(await service.listServices(req.query));
});

const get = asyncHandler(async (req, res) => {
  res.json(await service.getService(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { service: row } = await service.createService(req.body, req.user._id);

  await auditService.record({
    req,
    action: 'supplier_service.create',
    entity: { kind: 'supplierService', id: row.id, label: row.name },
    after: { supplier: row.supplierName, amount: row.amount, billing: row.billing },
    description: `Added ${row.name} from ${row.supplierName}.`,
  });

  res.status(201).json({ service: row });
});

const update = asyncHandler(async (req, res) => {
  const { service: row } = await service.updateService(req.params.id, req.body);

  await auditService.record({
    req,
    action: 'supplier_service.update',
    entity: { kind: 'supplierService', id: row.id, label: row.name },
    after: { amount: row.amount, billing: row.billing, supplier: row.supplierName },
    description: `Edited ${row.name}.`,
  });

  res.json({ service: row });
});

const recordCharge = asyncHandler(async (req, res) => {
  const result = await service.recordCharge(req.params.id, req.body, req.user._id);

  await auditService.record({
    req,
    action: 'supplier_service.charge',
    entity: { kind: 'supplierService', id: result.service.id, label: result.service.name },
    after: {
      // The expense number is the point of this row: it is what somebody
      // follows back from a figure on the expense report.
      expense: result.expense.number,
      amount: result.expense.amount,
      nextRenewalAt: result.service.nextRenewalAt,
    },
    description: `Recorded a charge for ${result.service.name} as ${result.expense.number}.`,
  });

  res.status(201).json(result);
});

const setCancelled = asyncHandler(async (req, res) => {
  const cancelled = req.body?.cancelled !== false;
  const { service: row } = await service.setCancelled(req.params.id, cancelled);

  await auditService.record({
    req,
    action: 'supplier_service.cancel',
    entity: { kind: 'supplierService', id: row.id, label: row.name },
    after: { cancelled: row.cancelled, cancelledAt: row.cancelledAt },
    description: `${cancelled ? 'Cancelled' : 'Reactivated'} ${row.name}.`,
  });

  res.json({ service: row });
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteService(req.params.id);

  await auditService.record({
    req,
    action: 'supplier_service.delete',
    entity: { kind: 'supplierService', id: req.params.id, label: String(req.params.id) },
    description: 'Deleted a supplier service or plan.',
  });

  res.json(result);
});

exports.list = list;
exports.get = get;
exports.create = create;
exports.update = update;
exports.recordCharge = recordCharge;
exports.setCancelled = setCancelled;
exports.remove = remove;
