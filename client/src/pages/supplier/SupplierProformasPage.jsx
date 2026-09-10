import { useNavigate } from 'react-router';
import { FileText } from 'lucide-react';
import { money, date } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import { apiUrl } from '@/lib/api';
import { useSupplierOrders } from '@/hooks/useSupplierPortal';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';

/**
 * Every proforma invoice this supplier has issued.
 *
 * **Derived from the orders payload, not its own endpoint.** A proforma lives
 * on the bid that raised it, so a second endpoint would be a second read of the
 * same documents and a second place for the sealed-bid rule to be got wrong.
 * The list is the orders this supplier can see, filtered to the ones carrying a
 * proforma.
 *
 * Each row links to the rendered document — the same sheet the purchasing desk
 * sees, from `proformaDocument.js`, so there is one piece of paper rather than
 * two that can disagree.
 */
export function SupplierProformasPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useSupplierOrders();

  const rows = (data?.orders ?? [])
    .filter((order) => order.myBid.proforma)
    .map((order) => ({
      id: order.id,
      poNumber: order.poNumber,
      title: order.title,
      state: order.state,
      ...order.myBid.proforma,
    }));

  const columns = [
    {
      key: 'number',
      header: 'Reference',
      priority: 1,
      sortValue: (row) => row.number ?? '',
      render: (row) => (
        <>
          <span className="block whitespace-nowrap font-mono text-sm font-medium text-ink-900">
            {row.number || `rev ${row.revision}`}
          </span>
          <span className="block truncate text-xs text-ink-400">
            against {row.poNumber}
            {row.title ? ` · ${row.title}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'revision',
      header: 'Revision',
      priority: 3,
      align: 'right',
      className: 'tnum',
      sortValue: (row) => row.revision ?? 1,
      render: (row) => (
        <span className="text-sm text-ink-500">
          {row.revision}
          {/* A superseded revision is the interesting case: it says a price was
              negotiated away, which is the one thing the history is for. */}
          {row.history?.length > 0 && (
            <span className="block text-2xs text-ink-400">
              {row.history.length} superseded
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      priority: 1,
      align: 'right',
      className: 'tnum',
      sortValue: (row) => row.total ?? 0,
      render: (row) => (
        <span className="text-sm font-semibold text-ink-900">{money(row.total)}</span>
      ),
    },
    {
      key: 'issuedAt',
      header: 'Issued',
      priority: 2,
      sortValue: (row) => (row.issuedAt ? new Date(row.issuedAt).getTime() : 0),
      render: (row) => <span className="text-sm text-ink-500">{date(row.issuedAt)}</span>,
    },
    {
      key: 'accepted',
      header: 'Status',
      priority: 1,
      sortValue: (row) => (row.acceptedAt ? 1 : 0),
      render: (row) =>
        row.acceptedAt ? (
          <Badge tone="ok" size="sm">
            accepted
          </Badge>
        ) : (
          <Badge tone="info" size="sm">
            with the buyer
          </Badge>
        ),
    },
    {
      key: 'document',
      header: '',
      priority: 2,
      align: 'right',
      render: (row) => (
        <a
          href={apiUrl(`/supplier-portal/orders/${row.id}/proforma`)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            pressable,
            'inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-brand hover:underline',
          )}
        >
          <FileText className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          View
        </a>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={FileText}
        title="Proforma invoices"
        description="The formal offers you have issued, and whether they were accepted."
      />

      <Panel flush>
        <div className="border-b border-line px-3 py-2 sm:px-4">
          <CountLine
            total={rows.length}
            noun={rows.length === 1 ? 'proforma' : 'proformas'}
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/supplier/orders/${row.id}`)}
          loading={isLoading}
          defaultSort={{ key: 'issuedAt', direction: 'desc' }}
          empty={
            <PanelEmpty
              icon={FileText}
              title="No proforma invoices yet"
              body="Once you have priced an order you can issue a proforma against it, and it appears here."
            />
          }
        />
      </Panel>
    </>
  );
}

export default SupplierProformasPage;
