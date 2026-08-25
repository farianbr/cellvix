import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Building2, Search, Wallet, WalletCards } from 'lucide-react';
import cn from '@/lib/cn';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { OrderStatusBadge, InvoiceStatusBadge } from '@/components/account/OrderStatusBadge';
import {
  useAdminUsers,
  useAdminUser,
  useAdminMutations,
  useAdminStoreCredit,
} from '@/hooks/useAdmin';

const TERMS = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'net15', label: 'Net 15' },
  { value: 'net30', label: 'Net 30' },
  { value: 'net60', label: 'Net 60' },
];

const STATUS_TONES = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'danger',
  suspended: 'neutral',
};

/**
 * Store credit on one account: allocate, correct, and read the ledger.
 *
 * Deliberately a separate panel from "Credit & terms" above it, because they are
 * different instruments — that form edits what Cellvix will LEND this business,
 * this one posts money the business HOLDS. Mixing them into one card is what
 * makes staff grant a $2,000 limit when they meant a $200 refund.
 */
function StoreCreditPanel({ id, balance }) {
  const { allocateStoreCredit } = useAdminMutations();
  const { data } = useAdminStoreCredit(id);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { amountDollars: '', note: '' },
  });

  const movements = data?.transactions ?? [];

  return (
    <div className="rounded-[11px] border border-line p-4">
      <div className="mb-3 flex items-center gap-2">
        <WalletCards className="size-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="font-display text-[13.5px] font-bold">Store credit</h3>
        <span className="tnum ml-auto font-display text-[15px] font-bold text-ink-900">
          {money(data?.balance ?? balance ?? 0)}
        </span>
      </div>

      <p className="mb-3 text-[12px] leading-relaxed text-ink-400">
        Money this account holds with Cellvix. It comes off their next order automatically. A
        negative amount is a correction.
      </p>

      <form
        onSubmit={handleSubmit((values) =>
          allocateStoreCredit.mutate(
            { id, amountDollars: Number(values.amountDollars), note: values.note },
            { onSuccess: () => reset({ amountDollars: '', note: '' }) },
          ),
        )}
      >
        <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Input
            label="Amount"
            inputMode="decimal"
            suffix="CAD"
            placeholder="50"
            {...register('amountDollars')}
          />
          <Input label="Reason" placeholder="Goodwill — late dispatch" {...register('note')} />
        </div>

        <Button type="submit" size="sm" className="mt-3" loading={allocateStoreCredit.isPending}>
          Post to account
        </Button>

        {allocateStoreCredit.isError && (
          <p className="mt-2 text-[12px] text-danger">{allocateStoreCredit.error.message}</p>
        )}
      </form>

      {movements.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line pt-1">
          {movements.slice(0, 6).map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink-900">{row.note}</span>
                <span className="block text-[11.5px] text-ink-400">
                  {row.type} · {date(row.createdAt)}
                  {row.orderNumber ? ` · ${row.orderNumber}` : ''}
                </span>
              </span>
              <span
                className={cn(
                  'tnum shrink-0 text-[12.5px] font-medium',
                  row.amount > 0 ? 'text-ok' : 'text-ink-700',
                )}
              >
                {row.amount > 0 ? '+' : '−'}
                {money(Math.abs(row.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Customer drawer: account facts, credit controls, recent orders and invoices. */
function CustomerDetail({ id, onClose }) {
  const { data, isLoading } = useAdminUser(id);
  const { setCredit, setUserStatus } = useAdminMutations();

  const user = data?.user;

  // `values` (not `defaultValues`) because the account arrives after first
  // render — defaults would snapshot an empty user and the form would show
  // a zero credit limit for an account that has one.
  const { register, handleSubmit, control } = useForm({
    values: {
      creditLimitDollars: user ? (user.creditLimit / 100).toFixed(0) : '',
      terms: user?.terms ?? 'prepaid',
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[11px] bg-surface-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-[15px] font-bold text-ink-900">{user.businessName}</p>
          <Badge tone={STATUS_TONES[user.status]} size="sm">
            {user.status}
          </Badge>
        </div>
        <p className="mt-1 text-[13px] text-ink-500">
          {user.contactName} · {user.email}
          {user.phone && ` · ${user.phone}`}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-400">
          Registered {date(user.createdAt)}
          {user.lastLoginAt && ` · last signed in ${date(user.lastLoginAt)}`}
          {user.taxId && ` · Tax ID ${user.taxId}`}
        </p>
      </div>

      {/* ---- credit ------------------------------------------------------- */}
      <form
        onSubmit={handleSubmit((values) =>
          setCredit.mutate({
            id,
            creditLimit: Math.round(Number(values.creditLimitDollars) * 100) || 0,
            terms: values.terms,
          }),
        )}
        className="rounded-[11px] border border-line p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="size-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          <h3 className="font-display text-[13.5px] font-bold">Credit & terms</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Credit limit" inputMode="numeric" suffix="CAD" {...register('creditLimitDollars')} />
          <SelectField control={control} name="terms" label="Terms" options={TERMS} />
        </div>

        <p className="tnum mt-2.5 text-[12.5px] text-ink-500">
          Currently drawn: <span className="font-medium text-ink-900">{money(user.balance)}</span>{' '}
          of {money(user.creditLimit)}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" size="sm" loading={setCredit.isPending}>
            Save credit
          </Button>

          {user.status === 'approved' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={setUserStatus.isPending}
              onClick={() => setUserStatus.mutate({ id, status: 'suspended' })}
            >
              Suspend account
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={setUserStatus.isPending}
              onClick={() => setUserStatus.mutate({ id, status: 'approved' })}
            >
              Reinstate account
            </Button>
          )}
        </div>
      </form>

      <StoreCreditPanel id={id} balance={user.storeCredit} />

      {/* ---- recent orders ------------------------------------------------- */}
      <div>
        <h3 className="eyebrow mb-2 text-ink-400">Recent orders</h3>
        {data.orders.length === 0 ? (
          <p className="rounded-[10px] bg-surface-2 px-3 py-4 text-center text-[12.5px] text-ink-400">
            No orders yet.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-[11px] border border-line">
            {data.orders.map((order) => (
              <li key={order.orderNumber} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex-1 truncate font-mono text-[12px] text-ink-900">
                  {order.orderNumber}
                </span>
                <span className="text-[11.5px] text-ink-400">{date(order.createdAt)}</span>
                <OrderStatusBadge status={order.status} size="sm" />
                <span className="tnum w-20 text-right text-[12.5px] font-medium text-ink-900">
                  {money(order.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- invoices ------------------------------------------------------ */}
      <div>
        <h3 className="eyebrow mb-2 text-ink-400">Invoices</h3>
        {data.invoices.length === 0 ? (
          <p className="rounded-[10px] bg-surface-2 px-3 py-4 text-center text-[12.5px] text-ink-400">
            No invoices yet.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-[11px] border border-line">
            {data.invoices.map((invoice) => (
              <li key={invoice.number} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex-1 truncate font-mono text-[12px] text-ink-900">
                  {invoice.number}
                </span>
                <span className="text-[11.5px] text-ink-400">due {date(invoice.dueDate)}</span>
                <InvoiceStatusBadge status={invoice.status} size="sm" />
                <span className="tnum w-20 text-right text-[12.5px] font-medium text-ink-900">
                  {money(invoice.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

export function AdminCustomersPage() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useAdminUsers({ q: query || undefined, status: 'all' });
  const users = data?.users ?? [];

  return (
    <>
      <Panel title="Customers" description={`${formatCount(users.length)} business accounts`} flush>
        <div className="border-b border-line p-4 sm:px-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Business name, contact or email…"
            icon={Search}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 sm:p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <PanelEmpty icon={Building2} title="No customers match" body="Try a different search." />
        ) : (
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => setSelected(user.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-400"
                    aria-hidden="true"
                  >
                    <Building2 className="size-4" strokeWidth={1.75} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-ink-900">
                        {user.businessName}
                      </p>
                      <Badge tone={STATUS_TONES[user.status]} size="sm">
                        {user.status}
                      </Badge>
                    </div>
                    <p className="truncate text-[12.5px] text-ink-500">
                      {user.contactName} · {user.email}
                    </p>
                  </div>

                  <div className="hidden w-32 shrink-0 text-right sm:block">
                    <p className="tnum text-[12.5px] font-medium text-ink-900">
                      {money(user.balance)}
                    </p>
                    <p className="tnum text-[11px] text-ink-400">
                      of {money(user.creditLimit)} · {user.terms.replace('net', 'Net ')}
                      {user.storeCredit > 0 && (
                        <> · {money(user.storeCredit)} store credit</>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Customer account"
        size="lg"
        align="top"
      >
        {selected && <CustomerDetail id={selected} onClose={() => setSelected(null)} />}
      </Modal>
    </>
  );
}

export default AdminCustomersPage;
