import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import Panel from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import CustomerForm from '@/components/admin/CustomerForm';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';
import { useAdminUser, useAdminMutations } from '@/hooks/useAdmin';

const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/clients/:id/edit'], icon: adminIcon('Users') };

/**
 * Editing a customer on its own screen rather than in a modal over the list.
 *
 * **Why a route and not a dialog.** The form is two columns of a dozen fields;
 * at that size a modal is a scrolling box floating over a table nobody is
 * reading, and it cannot be linked to, refreshed or opened in a second tab —
 * which is exactly what somebody does when they are copying details across from
 * another system. A route also means "back" behaves: cancelling returns to the
 * profile the operator came from instead of dumping them at the top of the list.
 *
 * The form itself is `components/admin/CustomerForm` and is shared, so what may
 * be edited is decided in one place (§7.2's rule about a second, quieter path).
 */
export function AdminCustomerEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useAdminUser(id);
  const { updateUser, setContactConsent } = useAdminMutations();

  // Publishes the name to the shell's breadcrumb, so the trail reads
  // `⌂ > Sales > Customers > Northline > Edit` rather than `… > Edit` (§4b.6).
  // Before the loading return: a hook cannot be conditional.
  useSetRecordLabel(data?.user?.displayName);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { user } = data;
  const profile = `/admin/clients/${id}`;

  return (
    <>
      <Link
        to={profile}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden="true" />
        Back to {user.displayName}
      </Link>

      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <Panel>
        <CustomerForm
          user={user}
          isPending={updateUser.isPending}
          error={updateUser.error?.message}
          onCancel={() => navigate(profile)}
          // Straight back to the profile on success: the operator came here to
          // correct something and wants to see it corrected, not sit on a form
          // that now says what the record already says.
          /**
           * Two writes, because consent has its own endpoint: it stamps who
           * recorded the answer and when, which `updateUser` neither carries
           * nor should. `contactConsent` is only present when the ticks
           * actually changed, so an ordinary profile correction still sends
           * one request and leaves the consent date alone.
           *
           * Sequential rather than parallel, and the profile goes first: if
           * the consent write fails, the correction the operator came here to
           * make is already saved rather than lost with it.
           */
          onSubmit={async ({ contactConsent, ...values }) => {
            await updateUser.mutateAsync({ id, ...values });
            if (contactConsent) {
              await setContactConsent.mutateAsync({ id, ...contactConsent });
            }
            navigate(profile);
          }}
        />
      </Panel>
    </>
  );
}

export default AdminCustomerEditPage;
