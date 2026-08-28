import { messageSchema } from '@shared/schemas/admin';
import ChannelScreen from '@/components/admin/marketing/ChannelScreen';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';

/**
 * SMS (§6.13 · §6b U3 — UI-only sending).
 *
 * The compose form and the history are real and permanent; the send is what
 * waits on Twilio credentials. A message written here is stored with
 * `queued_unconfigured` and the screen says so, so nothing is silently dropped
 * and nothing claims to have been delivered.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/marketing/sms'], icon: adminIcon('MessageSquare') };

export function AdminSmsPage() {
  return (
    <ChannelScreen
      channel="sms"
      page={ADMIN_PAGE}
      schema={messageSchema}
      submitLabel="Send SMS"
      bodyLabel="Message"
      bodyPlaceholder="Your order CVX-2026-00042 is ready for pickup."
    />
  );
}

export default AdminSmsPage;
