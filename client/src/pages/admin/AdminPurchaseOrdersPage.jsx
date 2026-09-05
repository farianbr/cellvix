import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Plus,
  Send,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import KpiRow from '@/components/admin/KpiRow';
import FilterStrip from '@/components/admin/FilterStrip';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import Pagination from '@/components/ui/Pagination';
import useTablePage from '@/hooks/useTablePage';
import ProcessStrip from '@/components/admin/ProcessStrip';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';
import SelectMenu from '@/components/ui/SelectMenu';
import {
  useAdminPurchaseOrders,
  useAdminSuppliers,
  useAdminMutations,
} from '@/hooks/useAdmin';

/**
 * Purchase orders — stock on order, what has arrived and what is outstanding
 * (ERP rework §6.8).
 *
 * The `ProcessStrip` at the foot is a status display of the purchase automation
 * cycle, not a wizard the operator drives — which is exactly why it is a
 * separate component from `StepIndicator` and never a fork of it (invariant 10).
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/purchase-orders'], icon: adminIcon('ClipboardList') };

const PILLS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  partial: 'warn',
  received: 'ok',
  cancelled: 'danger',
};

/**
 * Which stage of the cycle a list is sitting at, for the strip beneath it.
 *
 * The list shows many orders at once, so the stage reflects where the filtered
 * set mostly is rather than pretending one order is being tracked — the detail
 * page is where a single order's real stage lives.
 */
function cycleStage(status) {
  if (status === 'draft') return 'po';
  if (status === 'sent') return 'sent';
  if (status === 'partial') return 'shipment';
  if (status === 'received') return 'received';
  return 'supplier';
}


export function AdminPurchaseOrdersPage() {
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const status = searchParams.get('status') ?? 'all';
  const supplierId = searchParams.get('supplier') ?? '';

  const { data, isLoading } = useAdminPurchaseOrders({
    status,
    supplier: supplierId || undefined,
    q: query || undefined,
  });
  const { data: supplierData } = useAdminSuppliers({ status: 'active' });
  const { setPurchaseOrderStatus } = useAdminMutations();

  const orders = data?.orders ?? [];

  // The KPI tiles are summed from the whole filtered set; the table gets a
  // page of it. See `useTablePage` for why paging is client-side.
  const { pageRows: pagePos, page, totalPages, from, setPage } = useTablePage(orders);
  const counts = data?.counts ?? {};
  const totals = data?.totals ?? {};
  const suppliers = supplierData?.suppliers ?? [];

  const overdueCount = useMemo(
    () => orders.filter((order) => order.overdue).length,
    [orders],
  );

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  }

  const columns = [
    {
      key: 'poNumber',
      header: 'PO Number',
      priority: 1,
      render: (order) => (
        <span className="block whitespace-nowrap font-mono text-sm font-medium text-ink-900">
          {order.poNumber}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      priority: 1,
      className: 'max-w-[180px] truncate',
      sortValue: (order) => order.supplier.name,
      render: (order) => order.supplier.name,
    },
    {
      key: 'orderDate',
      header: 'Order date',
      priority: 3,
      render: (order) => <span className="text-sm text-ink-500">{date(order.orderDate)}</span>,
    },
    {
      key: 'expectedDate',
      header: 'Expected',
      priority: 2,
      render: (order) =>
        order.expectedDate ? (
          <span
            className={`inline-flex items-center gap-1 text-sm ${
              order.overdue ? 'font-medium text-danger' : 'text-ink-500'
            }`}
          >
            {order.overdue && (
              <AlertTriangle className="size-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            )}
            {date(order.expectedDate)}
          </span>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'itemCount',
      header: 'Items',
      priority: 3,
      align: 'right',
      className: 'tnum',
      render: (order) => (
        <>
          <span className="text-sm text-ink-900">{formatCount(order.itemCount)}</span>
          {order.qtyOutstanding > 0 && order.status !== 'draft' && (
            <span className="block text-2xs text-ink-400">
              {formatCount(order.qtyOutstanding)} due
            </span>
          )}
        </>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      priority: 1,
      align: 'right',
      className: 'tnum',
      render: (order) => (
        <>
          <span className="text-sm font-medium text-ink-900">{money(order.total)}</span>
          <span
            className={`block text-2xs ${
              order.payment.status === 'paid' ? 'text-ok' : 'text-ink-400'
            }`}
          >
            {order.payment.status === 'paid' ? 'paid' : 'unpaid'}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      render: (order) => (
        <Badge tone={STATUS_TONES[order.status]} size="sm">
          {order.status}
        </Badge>
      ),
    },
  ];

  const rowMenu = [
    {
      key: 'view',
      label: 'View order',
      icon: ClipboardList,
      onSelect: (order) => navigate(`/admin/purchase-orders/${order.id}`),
    },
    {
      key: 'send',
      label: 'Send to supplier',
      icon: Send,
      // Only a draft can be sent. The server refuses anything else regardless,
      // so this is a courtesy rather than the control (invariant 13).
      disabled: (order) => order.status !== 'draft',
      onSelect: (order) =>
        setPurchaseOrderStatus.mutate({ id: order.id, status: 'sent' }),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <>
            <Link
              to="/admin/suppliers"
              className={cn(pressable, 'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-display text-md font-semibold text-ink-700 hover:border-ink-300 hover:bg-surface-2')}
            >
              <Truck className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Suppliers
            </Link>
            {/* A page now, not a dialog — a PO with a dozen scanned lines and a
                running total is the wrong shape for a modal. */}
            <Link
              to="/admin/purchase-orders/create"
              className={cn(pressable, 'inline-flex h-11 select-none items-center justify-center gap-2 rounded-md bg-brand-gradient px-5 font-display text-md font-semibold text-white')}
            >
              <Plus className="size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              New PO
            </Link>
          </>
        }
      />

      <KpiRow
        tiles={[
          {
            key: 'draft',
            label: 'Draft',
            value: formatCount(counts.draft ?? 0),
            hint: 'Not yet sent to a supplier',
            tone: 'neutral',
            icon: ClipboardList,
          },
          {
            key: 'sent',
            label: 'Sent',
            value: formatCount(counts.sent ?? 0),
            hint: 'Awaiting delivery',
            tone: 'info',
            icon: Send,
          },
          {
            key: 'partial',
            label: 'Partial',
            value: formatCount(counts.partial ?? 0),
            hint: 'Some lines still short',
            tone: 'warn',
            icon: AlertTriangle,
          },
          {
            key: 'received',
            label: 'Received',
            value: formatCount(counts.received ?? 0),
            hint: 'Every line landed',
            tone: 'ok',
            icon: Truck,
          },
          {
            key: 'pending',
            label: 'Pending value',
            value: money(totals.pendingValue ?? 0),
            // A position, not a flow — committed and not yet landed, as of
            // today, whatever the filter says (§9).
            hint: 'Committed and not yet received, as of today',
            tone: 'brand',
            icon: Wallet,
          },
        ]}
      />

      <Panel flush className="mb-3">
        <FilterStrip
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="PO number or supplier…"
          pills={PILLS.map((pill) => ({
            ...pill,
            count: pill.value === 'overdue' ? overdueCount : counts[pill.value],
          }))}
          activePill={status}
          onPillChange={(next) => setParam('status', next)}
          activeFilterCount={supplierId ? 1 : 0}
          onClearFilters={() => setParam('supplier', '')}
          filters={
            <div>
              <p className="eyebrow mb-1.5 text-ink-400">Supplier</p>
              <SelectMenu
                srLabel="Filter by supplier"
                value={supplierId}
                onChange={(next) => setParam('supplier', next)}
                options={[
                  { value: '', label: 'All suppliers' },
                  ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
                ]}
                containerClassName="w-full"
              />
            </div>
          }
          onExport={(format) =>
            window.alert(
              `Export to ${format} arrives in phase 12. It will carry the current filters: ` +
                `status "${status}"${query ? `, search "${query}"` : ''}.`,
            )
          }
        />

        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={orders.length}
            shown={pagePos.length}
            from={from}
            noun={orders.length === 1 ? 'purchase order' : 'purchase orders'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={pagePos}
          rowKey={(order) => order.id}
          rowMenu={rowMenu}
          onRowClick={(order) => navigate(`/admin/purchase-orders/${order.id}`)}
          loading={isLoading}
          defaultSort={{ key: 'orderDate', direction: 'desc' }}
          empty={
            <PanelEmpty
              icon={ClipboardList}
              title="No purchase orders match"
              body={
                suppliers.length
                  ? 'Try a different filter, or raise a new order.'
                  : 'Add a supplier first — a purchase order needs somebody to buy from.'
              }
            />
          }
        />

        <Pagination
          page={page}
          pages={totalPages}
          onChange={setPage}
          hideWhenSingle
          className="border-t border-line px-3 py-3 sm:px-4"
        />

      </Panel>

      <ProcessStrip title="Life cycle of a purchase order" current={cycleStage(status)} />

    </>
  );
}

export default AdminPurchaseOrdersPage;
