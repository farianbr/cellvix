const mongoose = require('mongoose');

const { default: Role, PERMISSION_AREAS, PERMISSION_LEVELS } = require('../models/Role.js');
const { default: Outlet } = require('../models/Outlet.js');
const { default: User } = require('../models/User.js');
const { default: ApiError } = require('../utils/ApiError.js');
const { likeRegex } = require('../utils/regex.js');

/**
 * Outlets, roles and staff accounts (ERP rework §6.14, §6.15/3, §7.6 — phase 8).
 *
 * Three rules hold this file together:
 *
 *   1. **Power is never self-granted.** Only an admin reaches role editing and
 *      user creation, and no operation here can raise the caller's own access.
 *      A permission system whose subjects can edit it is decoration.
 *   2. **A role in use is never destroyed.** Deleting one would silently
 *      re-grant or revoke access for everyone holding it, so deletion is
 *      refused while a member remains — the same reasoning that makes a used
 *      `ExpenseCategory` deactivate rather than delete.
 *   3. **Exactly one default outlet exists, always.** It is where a stock
 *      movement lands when nothing names an outlet, so the field cannot be
 *      allowed to go empty or to hold two winners.
 */

const BUILT_IN_ROLES = [
  {
    name: 'Admin',
    slug: 'admin',
    isBuiltIn: true,
    isSystem: true,
    areas: PERMISSION_AREAS.reduce((out, area) => ({ ...out, [area]: 'full' }), {}),
  },
  {
    name: 'Account Manager',
    slug: 'account-manager',
    isBuiltIn: true,
    areas: {
      clients: 'full',
      sales: 'full',
      purchase: 'view',
      reports: 'full',
      marketing: 'full',
      outlet: 'view',
      settings: 'none',
    },
  },
  {
    name: 'Warehouse',
    slug: 'warehouse',
    isBuiltIn: true,
    areas: {
      clients: 'view',
      sales: 'view',
      purchase: 'full',
      reports: 'view',
      marketing: 'none',
      outlet: 'view',
      settings: 'none',
    },
  },
  {
    name: 'Front Desk',
    slug: 'front-desk',
    isBuiltIn: true,
    areas: {
      clients: 'full',
      sales: 'full',
      purchase: 'view',
      reports: 'none',
      marketing: 'none',
      outlet: 'view',
      settings: 'none',
    },
  },
];

// ---- setup ------------------------------------------------------------------

/**
 * Idempotent. Safe on a database with real accounts: built-ins are upserted by
 * slug and an operator's edits to a non-system role are left alone, because
 * re-running setup must never quietly reset permissions somebody tuned.
 */
async function ensureBuiltInRoles() {
  const created = [];
  for (const role of BUILT_IN_ROLES) {
    const existing = await Role.findOne({ slug: role.slug });
    if (existing) {
      // The system role is the one exception: its map is not the operator's to
      // drift, so it is held at full access on every boot.
      if (existing.isSystem) {
        existing.areas = role.areas;
        await existing.save();
      }
      continue;
    }
    created.push(await Role.create(role));
  }
  return created;
}

/**
 * One location today (§0.9), but the switcher and every `outlet` field need a
 * row to point at from day one.
 */
async function ensureDefaultOutlet() {
  const existing = await Outlet.findOne({ isDefault: true });
  if (existing) return existing;

  const any = await Outlet.findOne();
  if (any) {
    any.isDefault = true;
    await any.save();
    return any;
  }

  return Outlet.create({
    name: 'Cellvix Main',
    code: await nextOutletCode(),
    status: 'active',
    colorToken: 'brand',
    address: { city: 'Toronto', region: 'ON', country: 'Canada' },
    isDefault: true,
  });
}

// ---- outlets ----------------------------------------------------------------

/**
 * The zero-padded `#000001` form (§6.14). Assigned here rather than accepted
 * from the client: a code the form proposes is a code two operators can pick in
 * the same moment.
 */
async function nextOutletCode() {
  const last = await Outlet.findOne().sort({ code: -1 }).select('code').lean();
  const current = Number(String(last?.code ?? '#000000').replace(/\D/g, '')) || 0;
  return `#${String(current + 1).padStart(6, '0')}`;
}

async function listOutlets({ search, status } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (search) {
    const rx = likeRegex(search);
    filter.$or = [{ name: rx }, { code: rx }, { manager: rx }, { 'address.city': rx }];
  }

  const outlets = await Outlet.find(filter).sort({ isDefault: -1, name: 1 }).lean();

  // The summary strip. Counted across every outlet, not the filtered set — a
  // total that moves when you type in the search box is not a total.
  const all = await Outlet.find().select('status').lean();
  const summary = {
    total: all.length,
    active: all.filter((o) => o.status === 'active').length,
    inactive: all.filter((o) => o.status === 'inactive').length,
    maintenance: all.filter((o) => o.status === 'maintenance').length,
  };

  const staffCounts = await User.aggregate([
    { $match: { role: 'staff', outlet: { $ne: null } } },
    { $group: { _id: '$outlet', count: { $sum: 1 } } },
  ]);
  const byOutlet = new Map(staffCounts.map((row) => [String(row._id), row.count]));

  return {
    outlets: outlets.map((o) => ({
      ...o,
      id: String(o._id),
      staffCount: byOutlet.get(String(o._id)) ?? 0,
    })),
    summary,
  };
}

async function getOutlet(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Outlet not found.');
  const outlet = await Outlet.findById(id).lean();
  if (!outlet) throw ApiError.notFound('Outlet not found.');

  const staff = await User.find({ outlet: id, role: 'staff' })
    .select('contactName email staffRole lockedAt')
    .populate('staffRole', 'name slug')
    .lean();

  return { ...outlet, id: String(outlet._id), staff };
}

async function createOutlet(payload) {
  const outlet = await Outlet.create({
    ...payload,
    code: await nextOutletCode(),
    // The first outlet ever created is the default by necessity — there is
    // nothing else for an unattributed movement to point at.
    isDefault: (await Outlet.countDocuments()) === 0,
  });
  return outlet.toPublic();
}

async function updateOutlet(id, payload) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Outlet not found.');
  const outlet = await Outlet.findById(id);
  if (!outlet) throw ApiError.notFound('Outlet not found.');

  // `code` and `isDefault` are not the form's to set: one is server-assigned,
  // the other has its own endpoint so the "exactly one" rule stays in one place.
  const { code, isDefault, ...editable } = payload;
  Object.assign(outlet, editable);
  await outlet.save();
  return outlet.toPublic();
}

/** Moves the default flag, keeping exactly one winner. */
async function setDefaultOutlet(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Outlet not found.');
  const outlet = await Outlet.findById(id);
  if (!outlet) throw ApiError.notFound('Outlet not found.');
  if (outlet.status !== 'active') {
    throw ApiError.badRequest('Only an active outlet can be the default.', 'OUTLET_NOT_ACTIVE');
  }

  await Outlet.updateMany({ _id: { $ne: id } }, { $set: { isDefault: false } });
  outlet.isDefault = true;
  await outlet.save();
  return outlet.toPublic();
}

/**
 * Refused while the outlet is the default or still has staff — the same
 * reasoning as a role in use. Reassign, then delete.
 */
async function deleteOutlet(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Outlet not found.');
  const outlet = await Outlet.findById(id);
  if (!outlet) throw ApiError.notFound('Outlet not found.');

  if (outlet.isDefault) {
    throw ApiError.badRequest(
      'The default outlet cannot be deleted. Make another outlet the default first.',
      'OUTLET_IS_DEFAULT',
    );
  }

  const staffCount = await User.countDocuments({ outlet: id });
  if (staffCount > 0) {
    throw ApiError.badRequest(
      `${staffCount} staff ${staffCount === 1 ? 'member is' : 'members are'} assigned to this outlet. Reassign them first.`,
      'OUTLET_HAS_STAFF',
    );
  }

  await outlet.deleteOne();
  return { deleted: true };
}

// ---- roles ------------------------------------------------------------------

async function listRoles() {
  const roles = await Role.find().sort({ isSystem: -1, isBuiltIn: -1, name: 1 });

  const counts = await User.aggregate([
    { $match: { role: 'staff', staffRole: { $ne: null } } },
    { $group: { _id: '$staffRole', count: { $sum: 1 } } },
  ]);
  const byRole = new Map(counts.map((row) => [String(row._id), row.count]));

  // Admins hold no Role row — they bypass the system — so the system role's
  // member count is the admin headcount, which is what the screen means by it.
  const adminCount = await User.countDocuments({ role: 'admin' });

  return roles.map((role) => ({
    ...role.toPublic(),
    memberCount: role.isSystem ? adminCount : (byRole.get(String(role._id)) ?? 0),
  }));
}

function normaliseAreas(input = {}) {
  const areas = {};
  for (const area of PERMISSION_AREAS) {
    const level = input[area];
    // An unrecognised level closes the area rather than opening it. A typo in a
    // payload must never be the reason somebody gains access.
    areas[area] = PERMISSION_LEVELS.includes(level) ? level : 'none';
  }
  return areas;
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function createRole({ name, areas }) {
  const slug = slugify(name);
  if (!slug) throw ApiError.badRequest('Enter a role name.');

  const clash = await Role.findOne({ slug });
  if (clash) throw ApiError.badRequest('A role with that name already exists.', 'ROLE_EXISTS');

  const role = await Role.create({ name: name.trim(), slug, areas: normaliseAreas(areas) });
  return role.toPublic();
}

async function updateRole(id, { name, areas }) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Role not found.');
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found.');

  // The Admin role always wins and is never editable (§7.6). Enforced here and
  // not only in the UI, because "not editable" that only hides a button is a
  // suggestion.
  if (role.isSystem) {
    throw ApiError.badRequest('The Admin role cannot be edited.', 'ROLE_IS_SYSTEM');
  }

  if (name && name.trim() !== role.name) {
    const slug = slugify(name);
    const clash = await Role.findOne({ slug, _id: { $ne: id } });
    if (clash) throw ApiError.badRequest('A role with that name already exists.', 'ROLE_EXISTS');
    role.name = name.trim();
    role.slug = slug;
  }

  if (areas) role.areas = normaliseAreas(areas);

  await role.save();
  return role.toPublic();
}

async function deleteRole(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Role not found.');
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found.');

  if (role.isSystem) {
    throw ApiError.badRequest('The Admin role cannot be deleted.', 'ROLE_IS_SYSTEM');
  }
  if (role.isBuiltIn) {
    throw ApiError.badRequest(
      'Built-in roles cannot be deleted. Edit its access instead.',
      'ROLE_IS_BUILT_IN',
    );
  }

  const members = await User.countDocuments({ staffRole: id });
  if (members > 0) {
    throw ApiError.badRequest(
      `${members} staff ${members === 1 ? 'member holds' : 'members hold'} this role. Reassign them first.`,
      'ROLE_IN_USE',
    );
  }

  await role.deleteOne();
  return { deleted: true };
}

// ---- staff users ------------------------------------------------------------

function staffRow(user) {
  return {
    id: String(user._id),
    name: user.contactName || user.businessName,
    email: user.email,
    phone: user.phone,
    accountType: user.role,
    role: user.staffRole ? { id: String(user.staffRole._id), name: user.staffRole.name } : null,
    outlet: user.outlet ? { id: String(user.outlet._id), name: user.outlet.name } : null,
    locked: Boolean(user.lockedAt),
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  };
}

/**
 * The Users screen (§6.15/3). Cellvix people only — buyers have their own
 * screen under Clients, and mixing the two populations in one table is how an
 * operator ends up granting a customer a staff role.
 */
async function listStaff({ search, role, status } = {}) {
  const filter = { role: { $in: ['admin', 'staff'] } };

  if (role && role !== 'all') {
    if (role === 'admin') filter.role = 'admin';
    else if (mongoose.isValidObjectId(role)) filter.staffRole = role;
  }
  if (status === 'locked') filter.lockedAt = { $ne: null };
  if (status === 'active') filter.lockedAt = null;

  if (search) {
    const rx = likeRegex(search);
    filter.$or = [{ contactName: rx }, { businessName: rx }, { email: rx }];
  }

  const users = await User.find(filter)
    .select('contactName businessName email phone role staffRole outlet lockedAt lastLoginAt createdAt')
    .populate('staffRole', 'name slug')
    .populate('outlet', 'name code')
    .sort({ createdAt: -1 })
    .lean();

  const all = await User.find({ role: { $in: ['admin', 'staff'] } })
    .select('role lockedAt')
    .lean();

  return {
    users: users.map(staffRow),
    summary: {
      total: all.length,
      active: all.filter((u) => !u.lockedAt).length,
      inactive: all.filter((u) => u.lockedAt).length,
      admins: all.filter((u) => u.role === 'admin').length,
      staff: all.filter((u) => u.role === 'staff').length,
      locked: all.filter((u) => u.lockedAt).length,
    },
  };
}

async function assertRoleAndOutlet({ accountType, staffRole, outlet }) {
  if (accountType === 'staff') {
    if (!staffRole || !mongoose.isValidObjectId(staffRole)) {
      throw ApiError.badRequest('Choose a role for this staff member.', 'STAFF_ROLE_REQUIRED');
    }
    const role = await Role.findById(staffRole);
    if (!role) throw ApiError.notFound('Role not found.');
    if (role.isSystem) {
      // Handing out the system role would be a second admin by the back door,
      // bypassing the deliberate `accountType: 'admin'` decision.
      throw ApiError.badRequest(
        'The Admin role cannot be assigned. Create an administrator account instead.',
        'ROLE_IS_SYSTEM',
      );
    }
  }

  if (outlet) {
    if (!mongoose.isValidObjectId(outlet)) throw ApiError.notFound('Outlet not found.');
    const found = await Outlet.findById(outlet);
    if (!found) throw ApiError.notFound('Outlet not found.');
  }
}

async function createStaff(payload) {
  const { name, email, password, phone, accountType = 'staff', staffRole, outlet } = payload;

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw ApiError.badRequest('That email already has an account.', 'EMAIL_IN_USE');

  await assertRoleAndOutlet({ accountType, staffRole, outlet });

  const user = new User({
    // A staff account is a person, not a business, but `businessName` is
    // required on the model — Cellvix is the business they belong to.
    businessName: 'Cellvix',
    contactName: name,
    email,
    phone,
    role: accountType,
    staffRole: accountType === 'staff' ? staffRole : null,
    outlet: outlet ?? null,
    // Staff bypass the buyer approval ladder entirely; `approved` here only
    // means "not sitting in the pending queue", which staff never enter.
    status: 'approved',
  });
  await user.setPassword(password);
  await user.save();

  if (outlet) await Outlet.updateOne({ _id: outlet }, { $addToSet: { staff: user._id } });

  return staffRow(
    await User.findById(user._id)
      .populate('staffRole', 'name slug')
      .populate('outlet', 'name code')
      .lean(),
  );
}

async function updateStaff(id, payload, actorId) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('User not found.');
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found.');
  if (user.role === 'buyer') {
    throw ApiError.badRequest('That is a customer account, not a staff account.', 'NOT_STAFF');
  }

  const { name, phone, accountType, staffRole, outlet, locked } = payload;

  // Nobody demotes or locks themselves. Both are how an operator removes their
  // own last admin account and locks everyone out of the panel.
  if (String(id) === String(actorId)) {
    if (accountType && accountType !== user.role) {
      throw ApiError.badRequest('You cannot change your own account type.', 'SELF_DEMOTION');
    }
    if (locked === true) {
      throw ApiError.badRequest('You cannot lock your own account.', 'SELF_LOCK');
    }
  }

  const nextType = accountType ?? user.role;

  // The last admin is load-bearing: demoting or locking it would leave a panel
  // nobody can administer and a role system nobody can edit.
  const losingAdmin =
    user.role === 'admin' && (nextType !== 'admin' || locked === true);
  if (losingAdmin) {
    const admins = await User.countDocuments({ role: 'admin', lockedAt: null });
    if (admins <= 1) {
      throw ApiError.badRequest(
        'This is the last active administrator. Promote another account first.',
        'LAST_ADMIN',
      );
    }
  }

  await assertRoleAndOutlet({ accountType: nextType, staffRole, outlet });

  const previousOutlet = user.outlet ? String(user.outlet) : null;

  if (name !== undefined) user.contactName = name;
  if (phone !== undefined) user.phone = phone;
  if (accountType !== undefined) user.role = accountType;
  if (staffRole !== undefined) user.staffRole = nextType === 'staff' ? staffRole : null;
  if (outlet !== undefined) user.outlet = outlet || null;
  if (locked !== undefined) user.lockedAt = locked ? new Date() : null;

  await user.save();

  // Keep `Outlet.staff` — the reverse index the outlet card reads — honest.
  const nextOutlet = user.outlet ? String(user.outlet) : null;
  if (previousOutlet !== nextOutlet) {
    if (previousOutlet) {
      await Outlet.updateOne({ _id: previousOutlet }, { $pull: { staff: user._id } });
    }
    if (nextOutlet) {
      await Outlet.updateOne({ _id: nextOutlet }, { $addToSet: { staff: user._id } });
    }
  }

  return staffRow(
    await User.findById(id)
      .populate('staffRole', 'name slug')
      .populate('outlet', 'name code')
      .lean(),
  );
}

async function deleteStaff(id, actorId) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('User not found.');
  if (String(id) === String(actorId)) {
    throw ApiError.badRequest('You cannot delete your own account.', 'SELF_DELETE');
  }

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found.');
  if (user.role === 'buyer') {
    throw ApiError.badRequest('That is a customer account, not a staff account.', 'NOT_STAFF');
  }

  if (user.role === 'admin') {
    const admins = await User.countDocuments({ role: 'admin', lockedAt: null });
    if (admins <= 1) {
      throw ApiError.badRequest(
        'This is the last active administrator. Promote another account first.',
        'LAST_ADMIN',
      );
    }
  }

  if (user.outlet) await Outlet.updateOne({ _id: user.outlet }, { $pull: { staff: user._id } });
  await user.deleteOne();
  return { deleted: true };
}

// ---- audit snapshots (phase 11b) --------------------------------------------

/**
 * The state of a role before it is changed, for the audit trail (§7.5).
 *
 * Read here rather than in the controller so the audit hook does not have to
 * import `Role` and reimplement `toPublic()` — the shape a log row records and
 * the shape the API returns must not be allowed to drift apart.
 *
 * Returns null for a missing or malformed id: this runs *before* the mutation
 * that would reject it, and it must not throw its own error ahead of the real
 * one the caller is about to produce.
 */
async function getRoleSnapshot(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const role = await Role.findById(id);
  return role ? role.toPublic() : null;
}

/** The same, for a staff account. Uses `staffRow` so it matches what the API returns. */
async function getStaffSnapshot(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const user = await User.findById(id)
    .populate('staffRole', 'name slug')
    .populate('outlet', 'name code')
    .lean();
  if (!user) return null;

  const row = staffRow(user);
  return {
    email: row.email,
    accountType: row.accountType,
    role: row.role?.name ?? null,
    outlet: row.outlet?.name ?? null,
    locked: row.locked,
  };
}

exports.default = {
  ensureBuiltInRoles,
  ensureDefaultOutlet,
  getRoleSnapshot,
  getStaffSnapshot,
  nextOutletCode,
  listOutlets,
  getOutlet,
  createOutlet,
  updateOutlet,
  setDefaultOutlet,
  deleteOutlet,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff,
};

// --- CommonJS exports -------------------------------------------------
exports.ensureBuiltInRoles = ensureBuiltInRoles;
exports.ensureDefaultOutlet = ensureDefaultOutlet;
exports.nextOutletCode = nextOutletCode;
exports.listOutlets = listOutlets;
exports.getOutlet = getOutlet;
exports.createOutlet = createOutlet;
exports.updateOutlet = updateOutlet;
exports.setDefaultOutlet = setDefaultOutlet;
exports.deleteOutlet = deleteOutlet;
exports.listRoles = listRoles;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
exports.listStaff = listStaff;
exports.createStaff = createStaff;
exports.updateStaff = updateStaff;
exports.deleteStaff = deleteStaff;
exports.getRoleSnapshot = getRoleSnapshot;
exports.getStaffSnapshot = getStaffSnapshot;
