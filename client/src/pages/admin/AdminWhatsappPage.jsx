import { messageSchema } from '@shared/schemas/admin';
import ChannelScreen from '@/components/admin/marketing/ChannelScreen';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';

/**
 * WhatsApp (§6.13 · §6b U4 — UI-only sending).
 *
 * Identical in shape to SMS by design — same `MessageLog`, different `channel`
 * — so the two screens are one component with a different provider behind them.
 * Sending waits on WhatsApp Business API keys.
 */
const ADMIN_PAGE = {
  ...ADMIN_ROUTES['/admin/marketing/whatsapp'],
  icon: adminIcon('MessageCircle'),
};

export function AdminWhatsappPage() {
  return (
    <ChannelScreen
      channel="whatsapp"
      page={ADMIN_PAGE}
      schema={messageSchema}
      submitLabel="Send WhatsApp"
      bodyLabel="Message"
      bodyPlaceholder="Hi — the parts you asked about are back in stock."
    />
  );
}

export default AdminWhatsappPage;
