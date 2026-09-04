import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';

import Panel from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import TicketForm from '@/components/admin/TicketForm';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import { useAdminTickets, useAdminMutations } from '@/hooks/useAdmin';
import { toast } from '@/store/toastStore';

/**
 * Taking a ticket in, on its own screen rather than in a modal.
 *
 * **Why a route and not a dialog.** Intake is not a short form: a device block
 * alone carries four identifiers, three free-text fields and an eight-row
 * condition grid, and a ticket can hold several. At that size a modal is a
 * scrolling box floating over a list nobody is reading, it cannot be linked to
 * or refreshed, and it cannot be opened in a second tab — which is exactly what
 * somebody does when they are copying details off a device in one hand.
 *
 * A route also means "back" behaves: cancelling returns to the list, and the
 * URL says what is on screen. Same reasoning as `AdminCustomerEditPage`.
 */
const NEW_PAGE = { ...ADMIN_ROUTES['/admin/tickets/new'], icon: adminIcon('ClipboardList') };

export function AdminTicketFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const editing = Boolean(id);

  const { createTicket, updateTicket } = useAdminMutations();

  /**
   * The ticket being edited, and the technicians it can be assigned to.
   *
   * Both come from the list endpoint: it already returns `technicians`, and
   * there is no single-ticket GET. Fetching the list to find one row is
   * wasteful in principle and free in practice at this size — the alternative
   * is a new endpoint whose only caller is this screen.
   */
  const { data, isLoading } = useAdminTickets({ status: 'all', limit: 200 });
  const technicians = data?.technicians ?? [];
  const ticket = editing ? data?.tickets?.find((row) => row.id === id) : undefined;

  useSetRecordLabel(ticket?.ticketNumber);

  /**
   * Seeded from the query string when the ticket was raised from a customer
   * profile. A ticket stores its customer as free text — a repair walks in and
   * the counter must not need an account first — so the name, phone and email
   * travel in the link rather than an id this screen would have to resolve.
   */
  const seed = {
    client: searchParams.get('client') ?? undefined,
    name: searchParams.get('name') ?? undefined,
    phone: searchParams.get('phone') ?? undefined,
    email: searchParams.get('email') ?? undefined,
  };

  const page = editing
    ? {
        ...ADMIN_ROUTES['/admin/tickets/:id'],
        icon: adminIcon('ClipboardList'),
        title: ticket ? `Edit ${ticket.ticketNumber}` : 'Edit ticket',
      }
    : NEW_PAGE;

  if (editing && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (editing && !ticket) {
    return (
      <>
        <PageHeader icon={page.icon} title="Ticket not found" />
        <p className="text-sm text-ink-500">
          It may have been deleted.{' '}
          <Link to="/admin/tickets" className="font-semibold text-brand underline">
            Back to tickets
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <Link
        to="/admin/tickets"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        Back to tickets
      </Link>

      <PageHeader icon={page.icon} title={page.title} description={page.description} />

      <Panel>
        <TicketForm
          ticket={ticket}
          seed={seed.name ? seed : undefined}
          technicians={technicians}
          isPending={editing ? updateTicket.isPending : createTicket.isPending}
          error={(editing ? updateTicket : createTicket).error?.message}
          onCancel={() => navigate('/admin/tickets')}
          onSubmit={(values) => {
            const payload = {
              ...values,
              estimateDollars: Number(values.estimateDollars) || 0,
              // Links the ticket to the account it was raised from, so that
              // customer's profile can count its own open jobs.
              ...(seed.client && !editing ? { user: seed.client } : {}),
            };

            const mutation = editing ? updateTicket : createTicket;
            mutation.mutate(editing ? { id, ...payload } : payload, {
              onSuccess: () => {
                toast.ok(
                  editing ? 'Ticket saved' : 'Ticket opened',
                  editing ? undefined : 'It is now on the repair board.',
                );
                navigate('/admin/tickets');
              },
            });
          }}
        />
      </Panel>
    </>
  );
}

export default AdminTicketFormPage;
