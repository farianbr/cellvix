import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Building2,
  LayoutGrid,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Rows3,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import Pagination from '@/components/ui/Pagination';
import useTablePage from '@/hooks/useTablePage';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminOutlets, useAdminMutations } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { canEdit } from '@/lib/permissions';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';

/**
 * Outlets — physical stores (§6.14).
 *
 * Cellvix runs one location today (§0.9), so this screen usually renders a
 * single card. It ships now anyway because `StockMovement` already carries an
 * `outlet`, and the switcher needs somewhere to point: adding the second store
 * later becomes data entry rather than a migration.
 *
 * **Each store carries a colour identity** so the operator builds muscle memory
 * across the list — drawn from the design system's tokens, never arbitrary hex
 * (§2b).
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/outlets'], icon: adminIcon('Store') };

/**
 * `Button` renders a real `<button>`, so anything that navigates is a styled
 * `<Link>` — the same shape `AdminClientProfilePage` uses. A button that
 * navigates is not reachable by middle-click or "open in new tab".
 */
const LINK_BTN =
  pressable +
  ' inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink-600 hover:border-line-strong hover:text-ink-900';
const LINK_ICON_BTN =
  pressable +
  ' inline-flex size-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-2 hover:text-ink-900';
const PRIMARY_LINK_BTN =
  pressable +
  ' inline-flex h-9 items-center gap-1.5 rounded-md bg-ink-900 px-3.5 text-sm font-medium text-white hover:bg-ink-800';

const STATUS_TONE = { active: 'ok', inactive: 'neutral', maintenance: 'warn' };
const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', maintenance: 'Maintenance' };

/** The card's top border and icon wash. Token names, matching §2b's vocabulary. */
const COLOR_BORDER = {
  brand: 'border-t-brand',
  info: 'border-t-info',
  success: 'border-t-ok',
  warn: 'border-t-warn',
  danger: 'border-t-danger',
  ink: 'border-t-ink-300',
};

const COLOR_WASH = {
  brand: 'bg-brand-50 text-brand',
  info: 'bg-info-50 text-info',
  success: 'bg-ok-50 text-ok',
  warn: 'bg-warn-50 text-warn',
  danger: 'bg-danger-50 text-danger',
  ink: 'bg-surface-2 text-ink-500',
};

function addressLine(address = {}) {
  return [address.street, address.city, address.region, address.postal]
    .filter(Boolean)
    .join(', ');
}

function OutletCard({ outlet, editable, onDelete, onMakeDefault }) {
  const wash = COLOR_WASH[outlet.colorToken] ?? COLOR_WASH.ink;

  return (
    <article
      className={cn(
        'flex flex-col rounded-lg border border-line border-t-[3px] bg-surface p-4',
        COLOR_BORDER[outlet.colorToken] ?? COLOR_BORDER.ink,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', wash)}>
          <Building2 className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-medium text-ink-900">{outlet.name}</h3>
            {/* The spec's YOU'RE HERE chip. With one outlet it always shows;
                with several it is the one an unattributed movement lands in. */}
            {outlet.isDefault && (
              <Badge tone="brand" size="sm">
                You&rsquo;re here
              </Badge>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-ink-400">{outlet.code}</p>
        </div>

        <Badge tone={STATUS_TONE[outlet.status] ?? 'neutral'} size="sm">
          {STATUS_LABEL[outlet.status] ?? outlet.status}
        </Badge>
      </div>

      <dl className="mt-4 flex flex-col gap-1.5 text-sm text-ink-500">
        {addressLine(outlet.address) && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <dd className="min-w-0">{addressLine(outlet.address)}</dd>
          </div>
        )}
        {outlet.phone && (
          <div className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <dd>{outlet.phone}</dd>
          </div>
        )}
        {outlet.email && (
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <dd className="truncate">{outlet.email}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <UserRound className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <dd>
            {outlet.manager || 'No manager set'}
            <span className="text-ink-400">
              {' · '}
              {outlet.staffCount} {outlet.staffCount === 1 ? 'staff member' : 'staff'}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Link to={`/admin/outlets/${outlet.id}`} className={LINK_BTN}>
          View details
        </Link>
        {editable && (
          <>
            <Link
              to={`/admin/outlets/${outlet.id}/edit`}
              className={LINK_ICON_BTN}
              aria-label={`Edit ${outlet.name}`}
            >
              <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
            </Link>
            {!outlet.isDefault && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMakeDefault(outlet)}
                  aria-label={`Make ${outlet.name} the default outlet`}
                >
                  <Star className="size-4" strokeWidth={2} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => onDelete(outlet)}
                  aria-label={`Delete ${outlet.name}`}
                >
                  <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function AdminOutletsPage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('cards');
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { permissions } = useAuth();
  const editable = canEdit(permissions, 'outlet');

  const { data, isLoading } = useAdminOutlets(search ? { search } : undefined);
  const { deleteOutlet, setDefaultOutlet } = useAdminMutations();

  const outlets = data?.outlets ?? [];

  // A page of rows for the table; counts and tiles still read the full set.
  const { pageRows: pageOutlets, page, totalPages, from, setPage } = useTablePage(outlets);
  const summary = data?.summary ?? {};

  const tiles = useMemo(
    () => [
      { label: 'Total', value: summary.total ?? 0, tone: 'brand', icon: Building2 },
      { label: 'Active', value: summary.active ?? 0, tone: 'ok' },
      { label: 'Inactive', value: summary.inactive ?? 0, tone: 'neutral' },
      { label: 'Maintenance', value: summary.maintenance ?? 0, tone: 'warn' },
    ],
    [summary],
  );

  const columns = [
    {
      key: 'name',
      header: 'Outlet',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={cn('size-2.5 shrink-0 rounded-full', {
              'bg-brand': row.colorToken === 'brand',
              'bg-info': row.colorToken === 'info',
              'bg-ok': row.colorToken === 'success',
              'bg-warn': row.colorToken === 'warn',
              'bg-danger': row.colorToken === 'danger',
              'bg-ink-300': row.colorToken === 'ink',
            })}
            aria-hidden="true"
          />
          <span className="font-medium text-ink-900">{row.name}</span>
          {row.isDefault && (
            <Badge tone="brand" size="sm">
              Default
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: 'city', header: 'City', render: (row) => row.address?.city ?? '—' },
    { key: 'manager', header: 'Manager', render: (row) => row.manager || '—' },
    { key: 'staffCount', header: 'Staff', align: 'right', render: (row) => row.staffCount },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} size="sm">
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
  ];

  async function confirmDelete() {
    setError(null);
    try {
      await deleteOutlet.mutateAsync(confirming.id);
      setConfirming(null);
    } catch (err) {
      // The server refuses a default outlet or one with staff still on it.
      // Surfacing the real sentence beats a generic failure — it names the
      // thing the operator has to do first.
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description="Each shop has its own colour identity, so you build muscle memory across the list."
        badge={
          <Badge tone="ok" size="sm">
            Live
          </Badge>
        }
        action={
          editable && (
            <Link to="/admin/outlets/add" className={PRIMARY_LINK_BTN}>
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Add outlet
            </Link>
          )
        }
      />

      <KpiRow tiles={tiles} />

      <Panel
        flush
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search outlets"
              className="w-full sm:w-56"
              aria-label="Search outlets"
            />
            {/* Cards read better for one or two stores; the table wins the
                moment there are enough to scan down a column. */}
            <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="View">
              {[
                { key: 'cards', label: 'Cards', icon: LayoutGrid },
                { key: 'table', label: 'Table', icon: Rows3 },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setView(option.key)}
                  aria-pressed={view === option.key}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm',
                    view === option.key
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-500 hover:bg-surface-2',
                  )}
                >
                  <option.icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {view === 'table' ? (
          <>
            <div className="border-b border-line px-3 py-2 sm:px-4">
              <CountLine
                total={outlets.length}
                shown={pageOutlets.length}
                from={from}
                noun={outlets.length === 1 ? 'outlet' : 'outlets'}
              />
            </div>

            <DataTable
              columns={columns}
              rows={pageOutlets}
              loading={isLoading}
              onRowClick={(row) => navigate(`/admin/outlets/${row.id}`)}
              empty={<PanelEmpty icon={Building2} title="No outlets" body="Add your first store." />}
            />

            <Pagination
              page={page}
              pages={totalPages}
              onChange={setPage}
              hideWhenSingle
              className="border-t border-line px-3 py-3 sm:px-4"
            />
          </>
        ) : isLoading ? (
          <div className="p-4 text-sm text-ink-500">Loading outlets…</div>
        ) : outlets.length === 0 ? (
          <PanelEmpty
            icon={Building2}
            title="No outlets"
            body="Add your first store to start assigning staff."
            action={
              editable && (
                <Link to="/admin/outlets/add" className={PRIMARY_LINK_BTN}>
                  Add outlet
                </Link>
              )
            }
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {outlets.map((outlet) => (
              <OutletCard
                key={outlet.id}
                outlet={outlet}
                editable={editable}
                onDelete={setConfirming}
                onMakeDefault={(row) => setDefaultOutlet.mutate(row.id)}
              />
            ))}
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={confirmDelete}
        title={`Delete ${confirming?.name ?? 'outlet'}?`}
        body="This removes the outlet permanently. Staff assigned to it must be moved first."
        confirmLabel="Delete outlet"
        loading={deleteOutlet.isPending}
        error={error}
      />
    </>
  );
}

export default AdminOutletsPage;
