import AuditLogScreen from '@/components/admin/settings/AuditLogScreen';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';

/**
 * Activity Log (§6.15, category 6) — every admin mutation: who, what, when and
 * from where.
 *
 * Readable with `settings: view`. Its rows describe changes to records, which
 * the staff who made them can already see; the sign-in material that needs
 * protecting lives in the Security Log next door, which is admin-only.
 */
const ADMIN_PAGE = {
  ...ADMIN_ROUTES['/admin/settings/activity-log'],
  icon: adminIcon('ClipboardList'),
};

export function AdminActivityLogPage() {
  return <AuditLogScreen kind="activity" page={ADMIN_PAGE} />;
}

export default AdminActivityLogPage;
