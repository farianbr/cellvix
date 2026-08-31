import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Building2,
  Check,
  Clock,
  Globe,
  Mail,
  Phone,
  UserCheck,
  X,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import ApproveClientForm from '@/components/admin/ApproveClientForm';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminUsers, useAdminMutations } from '@/hooks/useAdmin';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

function RejectForm({ user, onSubmit, onCancel, isPending }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values.reason))} className="space-y-4">
      <p className="text-[13.5px] text-ink-500">
        Rejecting <span className="font-medium text-ink-900">{user.businessName}</span>. The reason
        is stored on the account and goes into the notification email.
      </p>

      <Input
        label="Reason"
        placeholder="Could not verify the business registration."
        error={errors.reason?.message}
        data-autofocus
        {...register('reason', {
          required: 'Give a reason — it goes in the notification email.',
          minLength: { value: 3, message: 'Give a reason.' },
        })}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={isPending}>
          Reject account
        </Button>
      </div>
    </form>
  );
}

const STATUS_TONES = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'danger',
  suspended: 'neutral',
};

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/approvals'], icon: adminIcon('ShieldCheck') };

export function AdminApprovalsPage() {
  const [status, setStatus] = useState('pending');
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const { data, isLoading } = useAdminUsers({ status });
  const { approveUser, rejectUser, setUserStatus } = useAdminMutations();

  const users = data?.users ?? [];
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <Panel
        title="Registrations"
        description="Approve a business to unlock trade pricing and ordering."
        flush
      >
        <div
          role="tablist"
          aria-label="Account status"
          className="flex gap-1 overflow-x-auto border-b border-line p-3 sm:px-5"
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={status === tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-[9px] px-3 py-1.5 font-display text-[13px] font-semibold transition-colors',
                status === tab.value
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-500 hover:bg-surface-2 hover:text-ink-900',
              )}
            >
              {tab.label}
              {counts[tab.value] > 0 && (
                <span className="tnum text-[11.5px] font-medium opacity-70">
                  {formatCount(counts[tab.value])}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 sm:p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <PanelEmpty
            icon={UserCheck}
            title={`No ${status} accounts`}
            body={
              status === 'pending'
                ? 'Every registered business has been reviewed.'
                : 'Nothing in this view.'
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <li key={user.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-400"
                    aria-hidden="true"
                  >
                    <Building2 className="size-4.5" strokeWidth={1.75} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-[14.5px] font-bold text-ink-900">
                        {user.businessName}
                      </p>
                      <Badge tone={STATUS_TONES[user.status]} size="sm">
                        {user.status}
                      </Badge>
                      {user.businessType && (
                        <span className="text-[12px] text-ink-400">{user.businessType}</span>
                      )}
                    </div>

                    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-500">
                      <li className="flex items-center gap-1.5">
                        <UserCheck className="size-3.5 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                        {user.contactName}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Mail className="size-3.5 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                        {user.email}
                      </li>
                      {user.phone && (
                        <li className="flex items-center gap-1.5">
                          <Phone className="size-3.5 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                          {user.phone}
                        </li>
                      )}
                      {user.website && (
                        <li className="flex items-center gap-1.5">
                          <Globe className="size-3.5 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                          {user.website}
                        </li>
                      )}
                    </ul>

                    <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-400">
                      <Clock className="size-3" strokeWidth={1.75} aria-hidden="true" />
                      Registered {date(user.createdAt)}
                      {user.taxId && ` · Tax ID ${user.taxId}`}
                      {user.status === 'approved' &&
                        ` · ${money(user.creditLimit)} limit, ${user.terms.replace('net', 'Net ')}`}
                    </p>

                    {user.rejectionReason && (
                      <p className="mt-2 rounded-[9px] bg-danger-50 px-3 py-2 text-[12.5px] text-danger">
                        Rejected: {user.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {user.status === 'pending' && (
                      <>
                        <Button size="sm" icon={Check} onClick={() => setApproving(user)}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={X}
                          onClick={() => setRejecting(user)}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {user.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={setUserStatus.isPending}
                        onClick={() => setUserStatus.mutate({ id: user.id, status: 'suspended' })}
                      >
                        Suspend
                      </Button>
                    )}

                    {(user.status === 'rejected' || user.status === 'suspended') && (
                      <Button size="sm" variant="outline" onClick={() => setApproving(user)}>
                        Reinstate
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        title="Approve business account"
        size="md"
        align="top"
      >
        {approving && (
          <ApproveClientForm
            user={approving}
            isPending={approveUser.isPending}
            error={approveUser.error?.message}
            onCancel={() => setApproving(null)}
            onSubmit={(body) =>
              approveUser.mutate(
                { id: approving.id, ...body },
                { onSuccess: () => setApproving(null) },
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject business account"
        size="sm"
      >
        {rejecting && (
          <RejectForm
            user={rejecting}
            isPending={rejectUser.isPending}
            onCancel={() => setRejecting(null)}
            onSubmit={(reason) =>
              rejectUser.mutate({ id: rejecting.id, reason }, { onSuccess: () => setRejecting(null) })
            }
          />
        )}
      </Modal>
    </>
  );
}

export default AdminApprovalsPage;
