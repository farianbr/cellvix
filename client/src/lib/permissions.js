import { PERMISSION_LEVELS } from '@shared/schemas/admin';

/**
 * Client-side permission reads (ERP rework §7.6).
 *
 * **This is a courtesy, never the control.** Every one of these answers shapes
 * the UI — a hidden nav group, a disabled button — and none of them protects
 * anything. `requirePermission` on the server decides for real on every
 * request, so a viewer who edits this in their console gets a screen full of
 * 403s rather than access.
 */

/**
 * Does this session clear `level` on `area`?
 *
 * A missing map answers **no**: an admin arrives with every area at full, and
 * a staff member with no role has no map at all — which is exactly the account
 * that should be seeing nothing.
 */
export function can(permissions, area, level = 'view') {
  const held = permissions?.[area];
  if (!held) return false;
  return PERMISSION_LEVELS.indexOf(held) >= PERMISSION_LEVELS.indexOf(level);
}

/** Convenience for the common "may this session change things here" question. */
export function canEdit(permissions, area) {
  return can(permissions, area, 'full');
}

/**
 * Filters the sidebar tree to what this session may see.
 *
 * A group with no reachable area is dropped whole rather than rendered empty —
 * an expandable section that opens onto nothing reads as a bug.
 *
 * **The dashboard is never filtered.** `home` is a nav area, not a permission
 * area — it is deliberately absent from `PERMISSION_AREAS`, because the
 * dashboard is the panel's front door and every staff account lands on it.
 * Treating it as a permission would have `can()` look up a key no role map ever
 * carries, answer "no" under the closed-by-default rule, and hide Home from
 * everyone including an administrator. The screen behind it is safe by
 * construction: `GET /admin/stats` returns counts, never records, which is why
 * it is the one staff route left unpermissioned on purpose.
 */
const UNFILTERED_AREAS = new Set(['home']);

export function visibleNav(nav, permissions) {
  return nav.filter(
    (group) =>
      !group.area || UNFILTERED_AREAS.has(group.area) || can(permissions, group.area, 'view'),
  );
}

export default can;
