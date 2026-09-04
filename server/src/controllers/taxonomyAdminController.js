import { asyncHandler } from '../utils/ApiError.js';
import taxonomyAdminService from '../services/taxonomyAdminService.js';
import auditService from '../services/auditService.js';

/**
 * The taxonomy editor (§6.15 — CellShoppe's *Device & Models*, phase 11d).
 *
 * Edits and deactivations are audited: the taxonomy decides what the storefront
 * can be filtered by, so "why did this brand disappear from the mega menu" needs
 * an answer. Structure — `kind`, `slug`, `parent` — is deliberately not editable
 * at all, so there is nothing to log for it.
 */

const list = asyncHandler(async (req, res) => {
  res.json(await taxonomyAdminService.list(req.query));
});

const get = asyncHandler(async (req, res) => {
  res.json(await taxonomyAdminService.get(req.params.id));
});

const update = asyncHandler(async (req, res) => {
  const before = await taxonomyAdminService.get(req.params.id).catch(() => null);
  const result = await taxonomyAdminService.update(req.params.id, req.body);

  await auditService.recordChange({
    req,
    action: 'taxonomy.update',
    entity: { kind: 'taxonomy', id: req.params.id, label: result.node.name },
    before: before
      ? {
          name: before.node.name,
          aliases: before.node.aliases,
          isActive: before.node.isActive,
          isFeatured: before.node.isFeatured,
        }
      : null,
    after: {
      name: result.node.name,
      aliases: result.node.aliases,
      isActive: result.node.isActive,
      isFeatured: result.node.isFeatured,
    },
    description: `Updated the taxonomy entry ${result.node.name}.`,
  });

  res.json(result);
});

const remove = asyncHandler(async (req, res) => {
  const before = await taxonomyAdminService.get(req.params.id).catch(() => null);
  const result = await taxonomyAdminService.remove(req.params.id);

  await auditService.record({
    req,
    action: 'taxonomy.delete',
    entity: { kind: 'taxonomy', id: req.params.id, label: result.name },
    before: before ? { name: before.node.name, kind: before.node.kind } : null,
    description: `Deleted the taxonomy entry ${result.name}.`,
  });

  res.json(result);
});

export { list, get, update, remove };
