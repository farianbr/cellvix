import { asyncHandler } from '../utils/ApiError.js';
import * as agreementService from '../services/agreementService.js';
import auditService from '../services/auditService.js';

/**
 * Supplier agreements - the admin half (authoring) and the portal half
 * (signing).
 *
 * Thin, like every other controller here. The one thing it adds is the request
 * metadata a signature needs: the IP and user agent are read from the request
 * rather than accepted in the body, because a client that could name its own
 * origin could name somebody else's.
 */

// ---- admin: authoring -------------------------------------------------------

const listTemplates = asyncHandler(async (req, res) => {
  res.json(await agreementService.listTemplates({ includeInactive: req.query.all === '1' }));
});

const getTemplate = asyncHandler(async (req, res) => {
  res.json(await agreementService.getTemplate(req.params.id));
});

const createTemplate = asyncHandler(async (req, res) => {
  const result = await agreementService.createTemplate(req.body, req.user._id);

  await auditService.record({
    req,
    action: 'agreement.create',
    entity: { kind: 'agreement', id: result.template.id, label: result.template.name },
    after: { clauses: result.template.clauses.length },
    description: `Created the agreement "${result.template.name}".`,
  });

  res.status(201).json(result);
});

/** Refused once anybody has signed - the service explains why. */
const updateTemplate = asyncHandler(async (req, res) => {
  const result = await agreementService.updateTemplate(req.params.id, req.body);

  await auditService.record({
    req,
    action: 'agreement.update',
    entity: { kind: 'agreement', id: req.params.id, label: result.template.name },
    after: { clauses: result.template.clauses.length },
    description: `Edited the agreement "${result.template.name}".`,
  });

  res.json(result);
});

/**
 * Publish the next version.
 *
 * Audited more loudly than an edit, because it moves every supplier onto new
 * wording and makes their existing signature stale - `suppliersMoved` is the
 * number an operator will want back when somebody asks why they were asked to
 * sign again.
 */
const publishRevision = asyncHandler(async (req, res) => {
  const result = await agreementService.publishRevision(req.params.id, req.body, req.user._id);

  await auditService.record({
    req,
    action: 'agreement.publish',
    entity: { kind: 'agreement', id: result.template.id, label: result.template.name },
    after: { version: result.template.version, suppliersMoved: result.suppliersMoved },
    description: `Published version ${result.template.version} of "${result.template.name}" - ${result.suppliersMoved} supplier${result.suppliersMoved === 1 ? '' : 's'} must sign again.`,
  });

  res.status(201).json(result);
});

/** One supplier's signed agreement, for their profile in the admin panel. */
const getForSupplier = asyncHandler(async (req, res) => {
  res.json(await agreementService.getAgreement(req.params.id));
});

// ---- the portal: signing ----------------------------------------------------

/** What this supplier still owes us, plus what they have already signed. */
const mine = asyncHandler(async (req, res) => {
  res.json(await agreementService.getAgreement(req.supplier._id));
});

/**
 * The supplier signs.
 *
 * Not audited through `auditService`: that log is the admin panel's, and the
 * actor here is a supplier session rather than a `User`. The signature record
 * carries its own timestamp, IP and user agent, which is the evidence this act
 * needs.
 */
const sign = asyncHandler(async (req, res) => {
  const result = await agreementService.sign(req.supplier._id, req.body, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json(result);
});

export {
  createTemplate,
  getForSupplier,
  getTemplate,
  listTemplates,
  mine,
  publishRevision,
  sign,
  updateTemplate,
};
