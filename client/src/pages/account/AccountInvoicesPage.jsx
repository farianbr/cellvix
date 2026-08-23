import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download, FileText } from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, relativeDays } from '@/lib/format';
import Panel, { StatTile, PanelEmpty } from '@/components/ui/Panel';
import Select from '@/components/ui/Select';
import Skeleton from '@/components/ui/Skeleton';
import { InvoiceStatusBadge } from '@/components/account/OrderStatusBadge';
import { useInvoices } from '@/hooks/useAccount';

const FILTERS = [
  { value: 'all', label: 'All invoices' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

export function AccountInvoicesPage() {
  const { data, isLoading } = useInvoices();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.invoices;
    return data.invoices.filter((invoice) => invoice.status === filter);
  }, [data, filter]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { totals } = data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Billed to date"
          value={money(totals.billed)}
          hint={`${totals.count} ${totals.count === 1 ? 'invoice' : 'invoices'}`}
          icon={FileText}
        />
        <StatTile label="Outstanding" value={money(totals.outstanding)} hint="Not yet settled" />
        <StatTile
          label="Overdue"
          value={money(totals.overdue)}
          hint={totals.overdue > 0 ? 'Past the due date' : 'Nothing past due'}
          tone={totals.overdue > 0 ? 'danger' : 'ok'}
        />
      </div>

      <Panel
        title="Invoices & statements"
        action={
          <Select
            options={FILTERS}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter invoices"
            size="sm"
            containerClassName="w-auto"
            className="w-[150px]"
          />
        }
        flush
      >
        {filtered.length === 0 ? (
          <PanelEmpty
            icon={FileText}
            title={data.invoices.length ? 'Nothing in this view' : 'No invoices yet'}
            body={
              data.invoices.length
                ? 'Switch the filter to see your other invoices.'
                : 'Invoices are generated automatically when you place an order.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Invoice', 'Order', 'Issued', 'Due', 'Amount', 'Balance', 'Status', ''].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="eyebrow px-4 py-2.5 text-ink-400 first:pl-4 sm:first:pl-5"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {filtered.map((invoice) => (
                  <tr key={invoice.number} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3 sm:pl-5">
                      <span className="font-mono text-[12.5px] font-medium text-ink-900">
                        {invoice.number}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {invoice.orderNumber ? (
                        <Link
                          to={`/account/orders/${invoice.orderNumber}`}
                          className="font-mono text-[12.5px] text-brand hover:underline"
                        >
                          {invoice.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-[12.5px] text-ink-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[12.5px] text-ink-500">{date(invoice.issuedAt)}</td>

                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[12.5px]',
                          invoice.status === 'overdue' ? 'font-medium text-danger' : 'text-ink-500',
                        )}
                      >
                        {date(invoice.dueDate)}
                      </span>
                      {invoice.status !== 'paid' && (
                        <span className="block text-[11px] text-ink-400">
                          {relativeDays(invoice.dueDate)}
                        </span>
                      )}
                    </td>

                    <td className="tnum px-4 py-3 text-[13px] font-medium text-ink-900">
                      {money(invoice.amount)}
                    </td>

                    <td
                      className={cn(
                        'tnum px-4 py-3 text-[13px] font-medium',
                        invoice.balance > 0 ? 'text-ink-900' : 'text-ink-300',
                      )}
                    >
                      {invoice.balance > 0 ? money(invoice.balance) : '—'}
                    </td>

                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} size="sm" />
                    </td>

                    <td className="px-4 py-3 text-right">
                      {/* PDF generation is not wired yet — see PROGRESS.md gaps. */}
                      <button
                        type="button"
                        disabled
                        title="PDF download lands with the admin phase"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-ink-300"
                      >
                        <Download className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default AccountInvoicesPage;
