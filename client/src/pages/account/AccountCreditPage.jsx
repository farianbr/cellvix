import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Plus,
  Wallet,
  WalletCards,
} from 'lucide-react';
import cn from '@/lib/cn';
import { money, date } from '@/lib/format';
import Panel, { StatTile } from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { InvoiceStatusBadge } from '@/components/account/OrderStatusBadge';
import {
  useAccountMutations,
  useAccountSummary,
  useInvoices,
  useStoreCredit,
} from '@/hooks/useAccount';

const TERMS_COPY = {
  prepaid: 'Payment is taken at checkout. No credit is extended on this account.',
  net15: 'Invoices are due 15 days after they are issued.',
  net30: 'Invoices are due 30 days after they are issued.',
  net60: 'Invoices are due 60 days after they are issued.',
};

/**
 * How each kind of movement reads on the statement. The buyer does not care
 * what the type is called in the database — they care whether money arrived and
 * why.
 */
const MOVEMENTS = {
  refund: { label: 'Refund', icon: ArrowDownLeft },
  recharge: { label: 'Top-up', icon: Plus },
  grant: { label: 'Added by Cellvix', icon: ArrowDownLeft },
  adjustment: { label: 'Adjustment', icon: ArrowUpRight },
  redemption: { label: 'Applied to order', icon: ArrowUpRight },
};

const TOP_UPS = [250, 500, 1000];

/** Prepay and hold the money as store credit. */
function RechargeForm({ onDone }) {
  const { rechargeStoreCredit } = useAccountMutations();
  const [amount, setAmount] = useState('500');

  const dollars = Number(amount);
  const invalid = !Number.isFinite(dollars) || dollars < 25 || dollars > 25_000;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid) return;
        rechargeStoreCredit.mutate(
          { amountDollars: dollars },
          { onSuccess: () => onDone?.() },
        );
      }}
      className="rounded-[14px] border border-line bg-surface-2 p-4"
    >
      <p className="font-display text-[13.5px] font-bold text-ink-900">Add funds</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
        Prepay now and the balance comes off your next order automatically. Minimum $25.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TOP_UPS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAmount(String(value))}
            className={cn(
              'tnum h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
              Number(amount) === value
                ? 'border-brand bg-brand-50 text-brand-700'
                : 'border-line bg-surface text-ink-500 hover:border-line-strong',
            )}
          >
            {money(value * 100)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input
          label="Amount"
          inputMode="decimal"
          suffix="CAD"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          containerClassName="max-w-[180px]"
        />
        <Button type="submit" loading={rechargeStoreCredit.isPending} disabled={invalid}>
          Add funds
        </Button>
      </div>

      {rechargeStoreCredit.isError && (
        <p className="mt-2.5 text-[12.5px] text-danger">{rechargeStoreCredit.error.message}</p>
      )}
      {rechargeStoreCredit.isSuccess && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-ok">
          <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          {rechargeStoreCredit.data.message}
        </p>
      )}
    </form>
  );
}

/**
 * The credit page carries two different things, and keeping them apart is the
 * whole point of the layout:
 *
 *   - **store credit** — money this account already holds with Cellvix, from a
 *     refund, a top-up or an allocation. It spends itself at checkout.
 *   - **line of credit** — what Cellvix lends the business, drawn against and
 *     repaid on terms.
 *
 * They were one "credit" number before, which meant a refund and a credit limit
 * looked like the same thing on the dashboard. They are not.
 */
export function AccountCreditPage() {
  const { data: summary, isLoading } = useAccountSummary();
  const { data: invoiceData } = useInvoices();
  const { data: creditData, isLoading: creditLoading } = useStoreCredit();

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-56" />
      </div>
    );
  }

  const { credit } = summary;
  const tone = credit.utilisation >= 85 ? 'danger' : credit.utilisation >= 60 ? 'warn' : 'ok';
  const storeCredit = creditData?.balance ?? summary.storeCredit ?? 0;
  const movements = creditData?.transactions ?? [];

  const ledger = invoiceData?.invoices ?? [];

  return (
    <div className="space-y-4">
      {/* ---- store credit -------------------------------------------------- */}
      <Panel
        title="Store credit"
        description="Money you hold with Cellvix. It comes off your next order automatically."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-6">
          <div className="rounded-[14px] bg-brand-gradient p-5 text-white">
            <span className="flex size-10 items-center justify-center rounded-[11px] bg-white/15">
              <WalletCards className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="tnum mt-4 font-display text-[34px] font-bold leading-none">
              {money(storeCredit)}
            </p>
            <p className="mt-2 text-[12.5px] text-white/75">Available to spend</p>

            {creditData && (creditData.added > 0 || creditData.spent > 0) && (
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-white/20 pt-3 text-[12px]">
                <div>
                  <dt className="text-white/65">Added</dt>
                  <dd className="tnum mt-0.5 font-medium">{money(creditData.added)}</dd>
                </div>
                <div>
                  <dt className="text-white/65">Used</dt>
                  <dd className="tnum mt-0.5 font-medium">{money(creditData.spent)}</dd>
                </div>
              </dl>
            )}
          </div>

          <RechargeForm />
        </div>

        {/* ---- movements ---------------------------------------------------- */}
        <div className="mt-5">
          <p className="eyebrow mb-2.5 text-ink-400">Credit activity</p>

          {creditLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <p className="rounded-[12px] bg-surface-2 px-4 py-6 text-center text-[13px] text-ink-400">
              No store credit on this account yet. Refunds, top-ups and anything your rep allocates
              will show here.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line">
              {movements.map((row) => {
                const meta = MOVEMENTS[row.type] ?? MOVEMENTS.adjustment;
                const Icon = meta.icon;
                const added = row.amount > 0;

                return (
                  <li key={row.id} className="flex items-center gap-3 bg-surface px-4 py-3">
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        added ? 'bg-ok-50 text-ok' : 'bg-surface-3 text-ink-500',
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" strokeWidth={2} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink-900">{meta.label}</p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-500">
                        {row.note}
                        {row.orderNumber ? ` · ${row.orderNumber}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          'tnum font-display text-[13.5px] font-bold',
                          added ? 'text-ok' : 'text-ink-900',
                        )}
                      >
                        {added ? '+' : '−'}
                        {money(Math.abs(row.amount))}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-400">{date(row.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>

      {/* ---- line of credit ------------------------------------------------ */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Credit limit" value={money(credit.limit)} icon={Wallet} />
        <StatTile
          label="Current balance"
          value={money(credit.balance)}
          hint="Drawn against your limit"
          tone={tone === 'ok' ? 'neutral' : tone}
        />
        <StatTile
          label="Available"
          value={money(credit.available)}
          hint={`${credit.utilisation}% of limit used`}
          tone={credit.available > 0 ? 'ok' : 'danger'}
        />
      </div>

      <Panel
        title="Line of credit"
        description="What Cellvix extends to this account, and how much of it is drawn."
      >
        <div
          className="h-3 overflow-hidden rounded-full bg-surface-3"
          role="meter"
          aria-valuenow={credit.utilisation}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Credit used"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              tone === 'danger' ? 'bg-danger' : tone === 'warn' ? 'bg-warn' : 'bg-brand-gradient',
            )}
            style={{ width: `${Math.max(2, credit.utilisation)}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
          <span className="tnum text-ink-500">
            {money(credit.balance)} used of {money(credit.limit)}
          </span>
          <span className="tnum font-medium text-ink-900">{money(credit.available)} available</span>
        </div>

        <div className="mt-5 rounded-[11px] bg-surface-2 px-4 py-3">
          <p className="eyebrow mb-1 text-ink-400">
            Payment terms · {credit.terms.replace('net', 'Net ')}
          </p>
          <p className="text-[13px] leading-relaxed text-ink-500">
            {TERMS_COPY[credit.terms] ?? TERMS_COPY.prepaid} To request a different limit or terms,
            contact your account representative.
          </p>
        </div>
      </Panel>

      <Panel
        title="Statement"
        description="Every invoice on this account, newest first."
        action={
          <Link
            to="/account/invoices"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:text-brand-700"
          >
            Full invoice view
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        }
        flush
      >
        {ledger.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-400">
            No activity on this account yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {ledger.map((invoice) => (
              <li key={invoice.number} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12.5px] font-medium text-ink-900">
                    {invoice.number}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-500">
                    Issued {date(invoice.issuedAt)} · due {date(invoice.dueDate)}
                  </p>
                </div>

                <InvoiceStatusBadge status={invoice.status} size="sm" />

                <div className="w-24 shrink-0 text-right">
                  <p className="tnum font-display text-[13.5px] font-bold text-ink-900">
                    {money(invoice.amount)}
                  </p>
                  {invoice.balance > 0 && (
                    <p className="tnum text-[11.5px] text-warn">{money(invoice.balance)} due</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default AccountCreditPage;
