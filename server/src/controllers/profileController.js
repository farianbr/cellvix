const { asyncHandler } = require('../utils/ApiError.js');
const { default: Role, PERMISSION_AREAS } = require('../models/Role.js');
const { default: Outlet } = require('../models/Outlet.js');
const { default: AuditLog } = require('../models/AuditLog.js');

/**
 * My Profile (§6.15, phase 12) — the screen behind the top bar's user chip.
 *
 * Read-only. Editing a staff account already lives on Settings > Users, behind
 * an admin-only route, and a second edit path here would be a way around the
 * self-demotion and last-admin rules `accessService` enforces there.
 */
const me = asyncHandler(async (req, res) => {
  const user = req.user;

  const [role, outlet, recent] = await Promise.all([
    user.staffRole ? Role.findById(user.staffRole).lean() : null,
    user.outlet ? Outlet.findById(user.outlet).select('name code').lean() : null,
    // The actor's own recent activity, from the audit trail phase 11b built.
    // Scoped to this user by id, so it can never show somebody else's actions.
    AuditLog.find({ kind: 'activity', actor: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  res.json({
    profile: {
      id: user._id.toString(),
      name: user.contactName || user.businessName || user.email,
      email: user.email,
      phone: user.phone ?? '',
      accountType: user.role,
      roleName: user.role === 'admin' ? 'Administrator' : (role?.name ?? null),
      // An admin holds every area at full — the same shape the session sends,
      // so the screen has one thing to render rather than two.
      areas:
        user.role === 'admin'
          ? PERMISSION_AREAS.reduce((out, area) => ({ ...out, [area]: 'full' }), {})
          : PERMISSION_AREAS.reduce(
              (out, area) => ({ ...out, [area]: role?.areas?.[area] ?? 'none' }),
              {},
            ),
      outlet: outlet ? { name: outlet.name, code: outlet.code } : null,
      status: user.status,
      locked: Boolean(user.lockedAt),
      memberSince: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    },
    activity: recent.map((row) => ({
      id: row._id.toString(),
      action: row.action,
      description: row.description,
      entity: row.entity,
      createdAt: row.createdAt,
    })),
  });
});

// --- CommonJS exports -------------------------------------------------
exports.me = me;
