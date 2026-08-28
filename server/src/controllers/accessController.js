import { asyncHandler } from '../utils/ApiError.js';
import * as accessService from '../services/accessService.js';
import * as auditService from '../services/auditService.js';

/**
 * Outlets, roles and staff accounts (ERP rework §6.14, §6.15/3, §7.6).
 *
 * Thin, like every other controller here. The self-demotion, last-admin and
 * role-in-use rules live in the service so a second route cannot reach around
 * them — the actor's id is the only thing this layer adds, because only the
 * request knows who is asking.
 */

// ---- outlets ----------------------------------------------------------------

export const listOutlets = asyncHandler(async (req, res) => {
  res.json(await accessService.listOutlets(req.query));
});

export const getOutlet = asyncHandler(async (req, res) => {
  res.json(await accessService.getOutlet(req.params.id));
});

export const nextOutletCode = asyncHandler(async (_req, res) => {
  res.json({ code: await accessService.nextOutletCode() });
});

export const createOutlet = asyncHandler(async (req, res) => {
  res.status(201).json(await accessService.createOutlet(req.body));
});

export const updateOutlet = asyncHandler(async (req, res) => {
  res.json(await accessService.updateOutlet(req.params.id, req.body));
});

export const setDefaultOutlet = asyncHandler(async (req, res) => {
  res.json(await accessService.setDefaultOutlet(req.params.id));
});

export const deleteOutlet = asyncHandler(async (req, res) => {
  res.json(await accessService.deleteOutlet(req.params.id));
});

// ---- roles ------------------------------------------------------------------

export const listRoles = asyncHandler(async (_req, res) => {
  res.json({ roles: await accessService.listRoles() });
});

/**
 * Roles and staff are audited without exception, and both land in the
 * **security** log (§7.6).
 *
 * These are the routes that decide what everybody else can reach, so "who
 * granted this" is the question the log exists to answer. A permission change
 * that leaves no trace is indistinguishable from one that was never authorised.
 *
 * A role edit belongs beside the staff changes rather than in the activity feed:
 * it is the more powerful of the two, because it changes access for **everyone**
 * holding the role at once rather than for one named account. Splitting them
 * across two screens would mean reconstructing one escalation from two places.
 */
export const createRole = asyncHandler(async (req, res) => {
  const role = await accessService.createRole(req.body);

  await auditService.record({
    req,
    kind: 'security',
    action: 'role.create',
    entity: { kind: 'role', id: role.id ?? '', label: role.name },
    after: { name: role.name, areas: role.areas },
    description: `Created the role “${role.name}”.`,
  });

  res.status(201).json(role);
});

export const updateRole = asyncHandler(async (req, res) => {
  const before = await accessService.getRoleSnapshot(req.params.id);
  const role = await accessService.updateRole(req.params.id, req.body);

  await auditService.record({
    req,
    kind: 'security',
    action: 'role.update',
    entity: { kind: 'role', id: req.params.id, label: role.name },
    // Areas in full on both sides rather than a per-key diff: the useful
    // question about a permission change is "what does this role allow now",
    // and a row saying only `purchase: view → full` makes the reader go and
    // look up the other six.
    before: { name: before?.name ?? null, areas: before?.areas ?? null },
    after: { name: role.name, areas: role.areas },
    description: `Changed access for the role “${role.name}”.`,
  });

  res.json(role);
});

export const deleteRole = asyncHandler(async (req, res) => {
  const before = await accessService.getRoleSnapshot(req.params.id);
  const result = await accessService.deleteRole(req.params.id);

  await auditService.record({
    req,
    kind: 'security',
    action: 'role.delete',
    entity: { kind: 'role', id: req.params.id, label: before?.name ?? '' },
    before: { name: before?.name ?? null, areas: before?.areas ?? null },
    description: `Deleted the role “${before?.name ?? req.params.id}”.`,
  });

  res.json(result);
});

// ---- staff ------------------------------------------------------------------

export const listStaff = asyncHandler(async (req, res) => {
  res.json(await accessService.listStaff(req.query));
});

/**
 * Creating a staff account, changing its role and removing it are all **security
 * events**, not merely administrative ones: each changes who can sign in and
 * what they can reach once they do.
 */
export const createStaff = asyncHandler(async (req, res) => {
  const staff = await accessService.createStaff(req.body);

  await auditService.record({
    req,
    kind: 'security',
    action: 'staff.create',
    entity: { kind: 'staff', id: staff.id ?? '', label: staff.email },
    // No password anywhere near this: `diff`'s redaction covers the field name,
    // and the payload simply is not passed here.
    after: {
      email: staff.email,
      accountType: staff.accountType,
      role: staff.role?.name ?? null,
      outlet: staff.outlet?.name ?? null,
    },
    description: `Created the staff account ${staff.email}.`,
  });

  res.status(201).json(staff);
});

export const updateStaff = asyncHandler(async (req, res) => {
  const before = await accessService.getStaffSnapshot(req.params.id);
  const staff = await accessService.updateStaff(req.params.id, req.body, req.user._id);

  await auditService.record({
    req,
    kind: 'security',
    action: 'staff.update',
    entity: { kind: 'staff', id: req.params.id, label: staff.email },
    before,
    after: {
      email: staff.email,
      accountType: staff.accountType,
      role: staff.role?.name ?? null,
      outlet: staff.outlet?.name ?? null,
      locked: staff.locked,
    },
    description: `Updated the staff account ${staff.email}.`,
  });

  res.json(staff);
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const before = await accessService.getStaffSnapshot(req.params.id);
  const result = await accessService.deleteStaff(req.params.id, req.user._id);

  await auditService.record({
    req,
    kind: 'security',
    action: 'staff.delete',
    entity: { kind: 'staff', id: req.params.id, label: before?.email ?? '' },
    before,
    description: `Removed the staff account ${before?.email ?? req.params.id}.`,
  });

  res.json(result);
});
