import { asyncHandler } from '../utils/ApiError.js';
import invoiceStatusService from '../services/invoiceStatusService.js';
import auditService from '../services/auditService.js';

/**
 * Time-lapse invoice messages (§6.15 category 2, phase 11d).
 *
 * **Switching a rule on is the audited event that matters.** It is the moment
 * the system starts emailing customers on its own, and "who turned this on" is
 * the question somebody asks after the first complaint.
 */

const list = asyncHandler(async (req, res) => {
  res.json(await invoiceStatusService.list());
});

const create = asyncHandler(async (req, res) => {
  const result = await invoiceStatusService.create(req.body);

  await auditService.record({
    req,
    action: 'invoice_rule.create',
    entity: { kind: 'invoiceStatusRule', id: result.rule.id, label: result.rule.label },
    after: {
      trigger: result.rule.trigger,
      delayDays: result.rule.delayDays,
      channel: result.rule.channel,
      isActive: result.rule.isActive,
    },
    description: `Created the invoice message “${result.rule.label}”.`,
  });

  res.status(201).json(result);
});

const update = asyncHandler(async (req, res) => {
  const before = (await invoiceStatusService.list()).rules.find((r) => r.id === req.params.id);
  const result = await invoiceStatusService.update(req.params.id, req.body);

  await auditService.recordChange({
    req,
    action: 'invoice_rule.update',
    entity: { kind: 'invoiceStatusRule', id: req.params.id, label: result.rule.label },
    before: before
      ? {
          label: before.label,
          trigger: before.trigger,
          delayDays: before.delayDays,
          channel: before.channel,
          isActive: before.isActive,
        }
      : null,
    after: {
      label: result.rule.label,
      trigger: result.rule.trigger,
      delayDays: result.rule.delayDays,
      channel: result.rule.channel,
      isActive: result.rule.isActive,
    },
    description: `Updated the invoice message “${result.rule.label}”.`,
  });

  res.json(result);
});

const remove = asyncHandler(async (req, res) => {
  const result = await invoiceStatusService.remove(req.params.id);

  await auditService.record({
    req,
    action: 'invoice_rule.delete',
    entity: { kind: 'invoiceStatusRule', id: req.params.id, label: result.label },
    description: `Deleted the invoice message “${result.label}”.`,
  });

  res.json(result);
});

/**
 * Runs the active rules now.
 *
 * `?dryRun=true` reports what would be sent without sending or recording — the
 * safe way to try this against a live database, and what an operator wants
 * before switching a rule on. A dry run is not audited, because it changes
 * nothing.
 */
const run = asyncHandler(async (req, res) => {
  const dryRun = req.query.dryRun === 'true';
  const result = await invoiceStatusService.run({ dryRun });

  if (!dryRun) {
    const sent = result.results.reduce((sum, row) => sum + row.sent, 0);
    await auditService.record({
      req,
      action: 'invoice_rule.run',
      entity: { kind: 'invoiceStatusRule', id: 'all', label: 'Invoice messages' },
      after: { sent, rules: result.results.length },
      description: `Ran the invoice messages — ${sent} sent.`,
    });
  }

  res.json(result);
});

export { list, create, update, remove, run };
