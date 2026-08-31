import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  Ban,
  Building2,
  Eye,
  Pencil,
  Plus,
  UserCheck,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { PROVINCES } from '@shared/schemas/checkout';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import SelectMenu from '@/components/ui/SelectMenu';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/admin/PageHeader';
import BulkBar from '@/components/admin/BulkBar';
import { STATUS_TONES } from '@/components/admin/ClientDetail';
import { TERMS } from '@/components/admin/ApproveClientForm';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminUsers, useAdminMutations } from '@/hooks/useAdmin';
import useCreateParam from '@/hooks/useCreateParam';
import downloadExport from '@/lib/exportDownload';

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

/** Tier badge tones. Mirrors the profile's `TierPanel` so one account reads the same on both. */
const TIER_TONE = { standard: 'neutral', silver: 'info', gold: 'warn', platinum: 'brand' };

/** Rows per page. Matches the Tickets list, so the control reads the same everywhere. */
const PER_PAGE_OPTIONS = [25, 50, 100].map((n) => ({ value: String(n), label: `${n} per page` }));

const CREATE_STATUS = [
  { value: 'approved', label: 'Approved — can see prices and order' },
  { value: 'pending', label: 'Pending — awaiting approval' },
];

/**
 * Opening a client account from this side of the panel (§7.2).
 *
 * It defaults to **approved**, because the admin filling this in *is* the
 * approval — asking them to create a pending account and then approve it a
 * moment later is a step that decides nothing. Pending stays available for an
 * account entered ahead of its paperwork.
 *
 * Credit terms sit beside the status for the same reason `ApproveClientForm`
 * carries them: deciding to trade with a business and deciding what credit to
 * extend it is one decision.
 */
function ClientForm({ onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, watch, control } = useForm({
    defaultValues: {
      businessName: '',
      contactName: '',
      email: '',
      phone: '',
      password: '',
      businessType: '',
      taxId: '',
      status: 'approved',
      terms: 'prepaid',
      creditLimitDollars: '0.00',
      address: { line1: '', line2: '', city: '', region: 'ON', postal: '' },
    },
  });

  const terms = watch('terms');
  const status = watch('status');

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          businessName: values.businessName,
          contactName: values.contactName,
          email: values.email,
          phone: values.phone,
          password: values.password,
          businessType: values.businessType || undefined,
          taxId: values.taxId || undefined,
          status: values.status,
          terms: values.terms,
          creditLimit: Math.round(Number(values.creditLimitDollars || 0) * 100) || 0,
          // An address is optional on the schema, but a half-typed one is not:
          // sent at all, it has to be complete, so an empty street line means
          // no address rather than a partial one the server has to reject.
          address: values.address.line1 ? values.address : undefined,
        }),
      )}
      className="space-y-4"
    >
      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Business name" {...register('businessName')} />
        <Input label="Contact name" {...register('contactName')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Email" type="email" {...register('email')} />
        <Input label="Phone" type="tel" {...register('phone')} />
      </div>

      <Input
        label="Password"
        type="password"
        hint="At least 8 characters, with a letter and a number. Pass it on to the client."
        {...register('password')}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Business type" placeholder="Repair shop" {...register('businessType')} />
        <Input label="Tax ID" {...register('taxId')} />
      </div>

      <fieldset className="rounded-[11px] border border-line p-3.5">
        <legend className="eyebrow px-1 text-ink-400">Address</legend>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Street" {...register('address.line1')} />
            <Input label="Unit / suite" {...register('address.line2')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="City" {...register('address.city')} />
            <SelectField
              control={control}
              name="address.region"
              label="Province"
              options={PROVINCES}
            />
            <Input label="Postal code" placeholder="A1A 1A1" {...register('address.postal')} />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField control={control} name="status" label="Status" options={CREATE_STATUS} />
        <SelectField control={control} name="terms" label="Payment terms" options={TERMS} />
        <Input
          label="Credit limit"
          inputMode="numeric"
          suffix="CAD"
          disabled={terms === 'prepaid'}
          {...register('creditLimitDollars')}
        />
      </div>

      <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-500">
        {status === 'approved'
          ? 'This account can sign in, see trade pricing and order straight away.'
          : 'This account can sign in and browse, but sees no prices and cannot order until it is approved.'}{' '}
        Marketing consent is left off — an account opened here has not asked for
        anything, so there is no implied consent to record.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Create customer
        </Button>
      </div>
    </form>
  );
}

export function AdminCustomersPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Opened directly by `+ Create` (§7.2), which arrives with `?new=1`.
  const [creating, setCreating] = useCreateParam();
  const [selected, setSelected] = useState([]);
  const { createUser, setUserStatus } = useAdminMutations();

  const status = searchParams.get('status') ?? 'all';
  const perPage = searchParams.get('perPage') ?? '25';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));

  const { data, isLoading } = useAdminUsers({ q: query || undefined, status });
  const users = data?.users ?? [];
  const counts = data?.counts ?? {};

  /**
   * Paging is done here rather than on the server, because `listUsers` already
   * answers with the whole filtered set (capped at 200) and every figure on this
   * screen is summed from it. Asking the server for one page would mean the KPI
   * row silently described only the page in view — a "Total customers" tile that
   * changes when you turn the page is worse than no tile.
   *
   * If the account list ever outgrows that cap, this moves server-side and the
   * tiles have to get their own aggregate rather than summing rows.
   */
  const size = Number(perPage);
  const totalPages = Math.max(1, Math.ceil(users.length / size));
  // A filter change can strand the URL on page 4 of a 2-page set; clamping on
  // read shows the last page rather than an empty table.
  const currentPage = Math.min(page, totalPages);
  const pageUsers = users.slice((currentPage - 1) * size, currentPage * size);

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    // Any change but the page itself returns to page 1: staying on page 3 of a
    // set that now has one page shows nothing.
    if (key !== 'page') params.delete('page');
    setSearchParams(params, { replace: true });
  }

  function setStatus(next) {
    setSelected([]);
    setParam('status', next);
  }

  /**
   * Bulk suspend / reinstate.
   *
   * **A pending account is never swept into `approved` by this.** Approval sets
   * a credit limit and payment terms per business, and `setUserStatus` writes
   * neither — reinstating a batch that happened to include a pending
   * registration would put an unvetted account on the catalogue with a $0 limit
   * and no terms, which is the approval gate failing open. Those rows are left
   * alone and reported, rather than silently dropped.
   *
   * Sequential rather than `Promise.all`: these are audited writes, and firing
   * forty at once at a shared Atlas instance is how a bulk action becomes a
   * partial one for reasons nobody can reconstruct afterwards.
   */
  async function runBulkStatus(next) {
    const rows = users.filter((user) => selected.includes(user.id));
    const eligible =
      next === 'approved' ? rows.filter((user) => user.status !== 'pending') : rows;
    const skipped = rows.length - eligible.length;

    for (const user of eligible) {
      await setUserStatus.mutateAsync({ id: user.id, status: next }).catch(() => {});
    }

    setSelected([]);

    if (skipped > 0) {
      window.alert(
        `${eligible.length} updated. ${skipped} pending ${skipped === 1 ? 'account was' : 'accounts were'} left alone — ` +
          'approving sets a credit limit and terms, so it is done one account at a time from the approvals queue.',
      );
    }
  }

  const totalAccounts = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const outstanding = users.reduce((sum, user) => sum + user.balance, 0);
  // Late money, summed from the same per-account figure the Overdue column
  // shows — the tile and the column can never disagree about what is late.
  const overdue = users.reduce((sum, user) => sum + (user.overdue ?? 0), 0);
  const storeCredit = users.reduce((sum, user) => sum + (user.storeCredit ?? 0), 0);

  /**
   * The column set an operator actually reads a customer list for.
   *
   * Ordered as the eye scans: **who** they are, **what they cost us** (terms and
   * what is owed), **what they are worth** (lifetime value and invoice count),
   * **when we last heard from them**, then the actions. Money columns are
   * right-aligned so the digits line up down the page — the one thing that makes
   * a column of figures comparable at a glance.
   *
   * `priority` folds the tail away rather than dropping it (DataTable §4): at
   * tablet the value columns collapse into the expandable row, at mobile
   * everything but the customer and the actions does.
   */
  const columns = [
    {
      key: 'businessName',
      header: 'Customer',
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
      /**
       * The client asked for a "tag". The account model has no free-text tag
       * field, and inventing one that nothing writes would be a column of
       * dashes; `businessType` is the label the account already carries — the
       * trade it is in, set at registration or on the create form — and it is
       * what a tag on a customer would have said anyway.
       */
      key: 'businessType',
      header: 'Tag',
      priority: 3,
      sortValue: (user) => user.businessType ?? '',
      render: (user) => (
        <span className="flex flex-wrap items-center gap-1">
          {user.businessType ? (
            <Badge tone="neutral" size="sm">
              {user.businessType}
            </Badge>
          ) : (
            <span className="text-[12px] text-ink-300">—</span>
          )}
          {/* Standard is the default and every account has it, so showing it
              forty times would be a column of the same word. Only a tier
              somebody deliberately set is worth the ink. */}
          {user.tier && user.tier !== 'standard' && (
            <Badge tone={TIER_TONE[user.tier] ?? 'neutral'} size="sm">
              {user.tier}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'terms',
      header: 'Terms',
      priority: 2,
      sortValue: (user) => user.terms ?? '',
      render: (user) => (
        <>
          <span className="whitespace-nowrap text-[12.5px] font-medium text-ink-900">
            {user.terms === 'prepaid' ? 'Prepaid' : user.terms.replace('net', 'Net ')}
          </span>
          {user.creditLimit > 0 && (
            <span className="tnum block whitespace-nowrap text-[11px] text-ink-400">
              {money(user.creditLimit)} limit
            </span>
          )}
        </>
      ),
    },
    {
      /**
       * Renamed from "Outstanding" — and pointed at a different number.
       *
       * The old column showed `balance`, which is everything owed on the line
       * of credit; an invoice raised yesterday on Net 30 sits in it and is not
       * late. Calling that "Overdue" would have overstated arrears on every
       * account in good standing, so the column now shows the unpaid remainder
       * of invoices whose due date has passed, with what is merely owed as the
       * subtitle underneath.
       */
      key: 'overdue',
      header: 'Overdue',
      priority: 2,
      align: 'right',
      className: 'tnum',
      sortValue: (user) => user.overdue ?? 0,
      render: (user) =>
        user.overdue > 0 ? (
          <>
            <span className="text-[13px] font-semibold text-danger">{money(user.overdue)}</span>
            <span className="block whitespace-nowrap text-[11px] text-ink-400">
              {formatCount(user.overdueCount)}{' '}
              {user.overdueCount === 1 ? 'invoice' : 'invoices'} late
            </span>
          </>
        ) : user.balance > 0 ? (
          <>
            <span className="text-[13px] font-medium text-ink-900">{money(user.balance)}</span>
            <span className="block whitespace-nowrap text-[11px] text-ink-400">owed, on time</span>
          </>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
    {
      key: 'invoiceCount',
      header: 'Invoices',
      priority: 3,
      align: 'right',
      className: 'tnum',
      sortValue: (user) => user.invoiceCount ?? 0,
      render: (user) =>
        user.invoiceCount > 0 ? (
          <span className="text-[13px] text-ink-900">{formatCount(user.invoiceCount)}</span>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
    {
      // Invoiced, not ordered: an order can be cancelled or never invoiced, and
      // the invoice is the document the business is accountable for (§9.1).
      key: 'lifetimeValue',
      header: 'Lifetime value',
      priority: 2,
      align: 'right',
      className: 'tnum',
      sortValue: (user) => user.lifetimeValue ?? 0,
      render: (user) =>
        user.lifetimeValue > 0 ? (
          <span className="text-[13px] font-semibold text-ink-900">
            {money(user.lifetimeValue)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
    {
      key: 'lastOrderedAt',
      header: 'Last ordered',
      priority: 3,
      align: 'right',
      // Sorted on the timestamp, displayed as a date: sorting the rendered
      // string would order "Apr" before "Jan".
      sortValue: (user) => (user.lastOrderedAt ? new Date(user.lastOrderedAt).getTime() : 0),
      render: (user) =>
        user.lastOrderedAt ? (
          <span className="tnum whitespace-nowrap text-[12.5px] text-ink-700">
            {date(user.lastOrderedAt)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-300">Never</span>
        ),
    },
  ];

  /**
   * View and Edit behind the `···` menu, which is what `DataTable` already
   * renders in its own trailing column (§4).
   *
   * Two buttons sitting open in a cell cost a column of width on every row to
   * show the same two words forty times, and they are the widest thing in the
   * table on a screen where the figures matter more. The menu also puts these
   * actions where every other admin list already keeps them, so the gesture is
   * the same on Tickets, Orders and here.
   */
  const rowMenu = [
    {
      key: 'view',
      label: 'View',
      icon: Eye,
      onSelect: (user) => navigate(`/admin/clients/${user.id}`),
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: Pencil,
      onSelect: (user) => navigate(`/admin/clients/${user.id}/edit`),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <Button onClick={() => setCreating(true)} icon={Plus}>
            New customer
          </Button>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'total',
            label: 'Total customers',
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
            label: 'Overdue',
            value: money(overdue),
            // The tile shows what is late; the hint states what is merely owed,
            // so the two figures are never confused for each other.
            hint:
              overdue > 0
                ? `${money(outstanding)} owed in total`
                : `Nothing late · ${money(outstanding)} owed`,
            tone: overdue > 0 ? 'danger' : 'ok',
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
          // Rows-per-page counts as an active filter only when it is off the
          // default, so the badge means "you have changed something" rather
          // than being permanently lit.
          activeFilterCount={perPage === '25' ? 0 : 1}
          onClearFilters={() => setParam('perPage', '')}
          filters={
            <div>
              <p className="eyebrow mb-1.5 text-ink-400">Rows</p>
              <SelectMenu
                srLabel="Rows per page"
                value={perPage}
                onChange={(next) => setParam('perPage', next)}
                options={PER_PAGE_OPTIONS}
                align="left"
                className="w-full"
              />
            </div>
          }
          onExport={(format) => downloadExport('clients', format, { q: query || undefined, status })}
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
          <CountLine
            total={users.length}
            shown={pageUsers.length}
            noun={users.length === 1 ? 'customer' : 'customers'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={pageUsers}
          rowKey={(user) => user.id}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          rowMenu={rowMenu}
          // One canonical URL per account (invariant 15): the row opens the
          // profile route rather than a drawer that shows the same record at a
          // different address.
          onRowClick={(user) => navigate(`/admin/clients/${user.id}`)}
          loading={isLoading}
          empty={
            <PanelEmpty
              icon={Building2}
              title="No customers match"
              body="Try a different filter or search."
            />
          }
        />

        {totalPages > 1 && (
          <div className="border-t border-line p-3">
            <Pagination
              page={currentPage}
              pages={totalPages}
              onChange={(next) => setParam('page', String(next))}
            />
          </div>
        )}
      </Panel>

      {/* Bulk status, and deliberately nothing else.
          `setUserStatus` is the one account-wide action that is real here,
          reversible and already audited. Approving in bulk is not offered: it
          sets a credit limit and terms per account, which is a decision made one
          business at a time — a batch approve would either invent one limit for
          everybody or quietly approve on none. */}
      <BulkBar count={selected.length} noun="selected" onClear={() => setSelected([])}>
        <Button
          size="xs"
          variant="outline"
          icon={Ban}
          loading={setUserStatus.isPending}
          onClick={() => runBulkStatus('suspended')}
        >
          Suspend
        </Button>
        <Button
          size="xs"
          variant="outline"
          icon={UserCheck}
          loading={setUserStatus.isPending}
          onClick={() => runBulkStatus('approved')}
        >
          Reinstate
        </Button>
      </BulkBar>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New customer"
        size="lg"
        align="top"
      >
        {creating && (
          <ClientForm
            isPending={createUser.isPending}
            error={createUser.error?.message}
            onCancel={() => setCreating(false)}
            onSubmit={(values) =>
              createUser.mutate(values, {
                onSuccess: (payload) => {
                  setCreating(false);
                  // Straight to the profile: the next thing an operator does is
                  // set a store-credit balance or look at what they just typed.
                  if (payload?.user?.id) navigate(`/admin/clients/${payload.user.id}`);
                },
              })
            }
          />
        )}
      </Modal>

    </>
  );
}

export default AdminCustomersPage;
