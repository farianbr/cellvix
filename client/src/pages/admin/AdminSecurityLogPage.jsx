import { ShieldAlert } from 'lucide-react';

import AuditLogScreen from '@/components/admin/settings/AuditLogScreen';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';

/**
 * Security Log (§6.15, category 6) — sign-ins, failures, lockouts, and the
 * account changes that decide who can sign in at all.
 *
 * **Admin-only, and the banner says so** (§6.15). These rows name accounts and
 * addresses that failed to authenticate, which is precisely the material that
 * helps somebody who is guessing at them — so this is not a screen a
 * `settings: view` role should reach. The server refuses it regardless; the
 * banner is there so an administrator knows the audience is narrow before they
 * screen-share it.
 */
const ADMIN_PAGE = {
  ...ADMIN_ROUTES['/admin/settings/security-log'],
  icon: adminIcon('ShieldAlert'),
};

export function AdminSecurityLogPage() {
  return (
    <AuditLogScreen
      kind="security"
      page={ADMIN_PAGE}
      notice={
        <p className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-danger/20 bg-danger-50 px-3.5 py-3 text-[13px] leading-relaxed text-ink-700">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-danger"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>
            <strong className="font-semibold">Administrators only.</strong> These entries name
            accounts and addresses that failed to sign in. Treat them as sensitive — they are useful
            to somebody guessing at credentials.
          </span>
        </p>
      }
    />
  );
}

export default AdminSecurityLogPage;
