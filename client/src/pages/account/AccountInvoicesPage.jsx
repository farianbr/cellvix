import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download, FileText, Search } from 'lucide-react';
import cn from '@/lib/cn';
import { apiUrl } from '@/lib/api';
import { money, moneyCompact, date, relativeDays } from '@/lib/format';
import Panel, { StatTile, PanelEmpty } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import SelectMenu from '@/components/ui/SelectMenu';
import Skeleton from '@/components/ui/Skeleton';
import { InvoiceStatusBadge } from '@/components/account/OrderStatusBadge';
import { useInvoices } from '@/hooks/useAccount';

const FILTERS = [
  { value: 'all', label: 'All invoices' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

/** The printable copy — the same document that was emailed when the order was placed. */
function InvoiceDocumentLink({ number, className }) {
  return (
    <a
      href={apiUrl(`/invoices/${number}/document`)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand-50',
        className,
      )}
    >
      <Download className="size-3.5" strokeWidth={2} aria-hidden="true" />
      PDF
      <span className="sr-only"> for invoice {number}</span>
    </a>
  );
}

export function AccountInvoicesPage() {
  const { data, isLoading } = useInvoices();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();

    return data.invoices.filter((invoice) => {
      if (filter !== 'all' && invoice.status !== filter) return false;
      if (!needle) return true;
      // Invoice number, the order it bills, or the amount as it is printed —
      // "2,110" finds the invoice a buyer is holding a statement line for.
      return (
        invoice.number.toLowerCase().includes(needle) ||
        invoice.orderNumber?.toLowerCase().includes(needle) ||
        money(invoice.amount).toLowerCase().includes(needle)
      );
    });
  }, [data, filter, query]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
      {/* Two up on a phone — three stacked tiles pushed the invoice list itself
          below the fold on every screen under 640px. "Billed to date" spans the
          row because it is the one figure the other two are read against. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Billed to date"
          value={moneyCompact(totals.billed)}
          hint={`${totals.count} ${totals.count === 1 ? 'invoice' : 'invoices'}`}
          icon={FileText}
        />
        <StatTile
          label="Outstanding"
          value={moneyCompact(totals.outstanding)}
          hint="Not yet settled"
        />
        <StatTile
          label="Overdue"
          value={moneyCompact(totals.overdue)}
          hint={totals.overdue > 0 ? 'Past the due date' : 'Nothing past due'}
          tone={totals.overdue > 0 ? 'danger' : 'ok'}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Panel title="Invoices & statements" description={`${filtered.length} of ${data.invoices.length} shown`} flush>
        <div className="flex flex-wrap gap-2.5 border-b border-line p-4 sm:px-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Invoice number, order number or amount…"
            icon={Search}
            aria-label="Search invoices"
            containerClassName="min-w-[200px] flex-1"
          />
          <SelectMenu
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            srLabel="Filter invoices"
            size="md"
            className="w-[150px]"
          />
        </div>

        {filtered.length === 0 ? (
          <PanelEmpty
            icon={FileText}
            title={data.invoices.length ? 'Nothing in this view' : 'No invoices yet'}
            body={
              data.invoices.length
                ? 'Try a different invoice or order number, or switch the filter.'
                : 'An invoice is generated and emailed to you the moment an order is placed.'
            }
          />
        ) : (
          <>
            {/* ---- table from lg ---------------------------------------- */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line">
                    {['Invoice', 'Order', 'Issued', 'Due', 'Amount', 'Balance', 'Status', ''].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="eyebrow px-4 py-2.5 text-ink-400 first:pl-5"
                        >
                          {heading || <span className="sr-only">Document</span>}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-line">
                  {filtered.map((invoice) => (
                    <tr key={invoice.number} className="transition-colors hover:bg-surface-2">
                      <td className="py-3 pl-5 pr-4">
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

                      <td className="px-4 py-3 text-[12.5px] text-ink-500">
                        {date(invoice.issuedAt)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[12.5px]',
                            invoice.status === 'overdue'
                              ? 'font-medium text-danger'
                              : 'text-ink-500',
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
                        <InvoiceDocumentLink number={invoice.number} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- list below lg -----------------------------------------
                Same rows the credit statement uses. The table was a 640px-wide
                horizontal scroller on a phone: eight columns of which the two
                that matter — amount and status — started off-screen. */}
            <ul className="divide-y divide-line lg:hidden">
              {filtered.map((invoice) => (
                <li key={invoice.number} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12.5px] font-medium text-ink-900">
                          {invoice.number}
                        </span>
                        <InvoiceStatusBadge status={invoice.status} size="sm" />
                      </div>

                      <p className="mt-1 text-[12px] text-ink-500">
                        Issued {date(invoice.issuedAt)} · due {date(invoice.dueDate)}
                        {invoice.status !== 'paid' && (
                          <span
                            className={cn(
                              'ml-1',
                              invoice.status === 'overdue' ? 'text-danger' : 'text-ink-400',
                            )}
                          >
                            ({relativeDays(invoice.dueDate)})
                          </span>
                        )}
                      </p>

                      {invoice.orderNumber && (
                        <Link
                          to={`/account/orders/${invoice.orderNumber}`}
                          className="mt-1 inline-block font-mono text-[12px] text-brand hover:underline"
                        >
                          {invoice.orderNumber}
                        </Link>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tnum font-display text-[13.5px] font-bold text-ink-900">
                        {money(invoice.amount)}
                      </p>
                      {invoice.balance > 0 && (
                        <p className="tnum text-[11.5px] text-warn">
                          {money(invoice.balance)} due
                        </p>
                      )}
                      <InvoiceDocumentLink number={invoice.number} className="-mr-2 mt-1" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

export default AccountInvoicesPage;
