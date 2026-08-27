import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Building2, UserCheck, Wallet, WalletCards } from 'lucide-react';
import { money, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { STATUS_TONES } from '@/components/admin/ClientDetail';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminUsers } from '@/hooks/useAdmin';

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/clients'], icon: adminIcon('Users') };

/**
 * Status pills. `?status=pending` is the Approvals view — the dashboard links
 * straight here, and the old `/admin/approvals` URL redirects to it — so the
 * filter lives in the URL rather than in local state.
 */
const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

export function AdminCustomersPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') ?? 'all';

  const { data, isLoading } = useAdminUsers({ q: query || undefined, status });
  const users = data?.users ?? [];
  const counts = data?.counts ?? {};

  function setStatus(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  }

  const totalAccounts = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const outstanding = users.reduce((sum, user) => sum + user.balance, 0);
  const storeCredit = users.reduce((sum, user) => sum + (user.storeCredit ?? 0), 0);

  const columns = [
    {
      key: 'businessName',
      header: 'Client',
      priority: 1,
      render: (user) => (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-ink-900">
              {user.businessName}
            </span>
            <Badge tone={STATUS_TONES[user.status]} size="sm">
              {user.status}
            </Badge>
          </span>
          <span className="block truncate text-[12px] text-ink-500">
            {user.contactName} · {user.email}
          </span>
        </>
      ),
    },
    {
      key: 'terms',
      header: 'Terms',
      priority: 3,
      render: (user) => (
        <span className="text-[12.5px] text-ink-500">{user.terms.replace('net', 'Net ')}</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      priority: 2,
      align: 'right',
      className: 'tnum',
      render: (user) => (
        <>
          <span className="text-[13px] font-medium text-ink-900">{money(user.balance)}</span>
          <span className="block text-[11px] text-ink-400">of {money(user.creditLimit)}</span>
        </>
      ),
    },
    {
      // Store credit is what the business already holds and is kept visually
      // apart from the line of credit above (Instructions: two instruments).
      key: 'storeCredit',
      header: 'Store credit',
      priority: 3,
      align: 'right',
      className: 'tnum',
      sortValue: (user) => user.storeCredit ?? 0,
      render: (user) =>
        user.storeCredit > 0 ? (
          <span className="text-[12.5px] font-medium text-ok">{money(user.storeCredit)}</span>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <KpiRow
        tiles={[
          {
            key: 'total',
            label: 'Total clients',
            value: formatCount(totalAccounts),
            hint: 'Business accounts registered',
            tone: 'brand',
            icon: Building2,
          },
          {
            key: 'pending',
            label: 'Pending',
            value: formatCount(counts.pending ?? 0),
            hint: 'Cannot see pricing or order',
            tone: (counts.pending ?? 0) > 0 ? 'warn' : 'ok',
            icon: UserCheck,
          },
          {
            key: 'balance',
            label: 'Outstanding',
            value: money(outstanding),
            hint: 'Owed on the line of credit',
            tone: outstanding > 0 ? 'danger' : 'ok',
            icon: Wallet,
          },
          {
            key: 'credit',
            label: 'Store credit',
            value: money(storeCredit),
            hint: 'Refunds and allocations not yet spent',
            tone: 'info',
            icon: WalletCards,
          },
        ]}
      />

      <Panel flush>
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Business name, contact or email…"
          pills={PILLS.map((pill) => ({
            ...pill,
            count: pill.value === 'all' ? totalAccounts : counts[pill.value],
          }))}
          activePill={status}
          onPillChange={setStatus}
          onExport={(format) =>
            window.alert(
              `Export to ${format} arrives in phase 12. It will carry the current filters: ` +
                `status "${status}"${query ? `, search "${query}"` : ''}.`,
            )
          }
          actions={
            // The approve/reject flow sets credit terms and an account rep in
            // one payload, and requires a reason to reject — none of which the
            // account drawer here does. It keeps its own screen until phase 4
            // folds it into the client profile properly (plan §6.2).
            (counts.pending ?? 0) > 0 && (
              <Link
                to="/admin/approvals"
                className="flex h-9 items-center gap-1.5 rounded-[8px] border border-warn/30 bg-warn-50 px-2.5 text-[13px] font-medium text-warn transition-colors hover:border-warn/50"
              >
                <UserCheck className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                Review {counts.pending}
              </Link>
            )
          }
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine total={users.length} noun={users.length === 1 ? 'client' : 'clients'} />
        </div>

        <DataTable
          columns={columns}
          rows={users}
          // One canonical URL per account (invariant 15): the row opens the
          // profile route rather than a drawer that shows the same record at a
          // different address.
          onRowClick={(user) => navigate(`/admin/clients/${user.id}`)}
          loading={isLoading}
          empty={
            <PanelEmpty
              icon={Building2}
              title="No clients match"
              body="Try a different filter or search."
            />
          }
        />
      </Panel>
    </>
  );
}

export default AdminCustomersPage;
