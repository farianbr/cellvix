import { useForm } from 'react-hook-form';
import { Wallet, WalletCards } from 'lucide-react';
import cn from '@/lib/cn';
import { money, date } from '@/lib/format';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import Button from '@/components/ui/Button';
import { useAdminMutations, useAdminStoreCredit } from '@/hooks/useAdmin';

/**
 * The pieces that make up one client account: the credit-and-terms form and the
 * store-credit panel.
 *
 * They live here rather than inside the profile page so the two money surfaces
 * stay together and stay apart — the form edits what Cellvix will **lend**, the
 * panel posts what the business already **holds**, and the Instructions require
 * those never be merged into one card.
 */

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
export function StoreCreditPanel({ id, balance }) {
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

/**
 * Credit and terms: what Cellvix will **lend** this business.
 *
 * Deliberately separate from the store-credit panel — that one posts money the
 * business already **holds**. Mixing them into one card is what makes staff
 * grant a $2,000 limit when they meant a $200 refund.
 */
export function CreditForm({ id, user }) {
  const { setCredit, setUserStatus } = useAdminMutations();

  // `values` (not `defaultValues`) because the account arrives after first
  // render — defaults would snapshot an empty user and the form would show
  // a zero credit limit for an account that has one.
  const { register, handleSubmit, control } = useForm({
    values: {
      creditLimitDollars: user ? (user.creditLimit / 100).toFixed(0) : '',
      terms: user?.terms ?? 'prepaid',
    },
  });

  return (
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
        <h3 className="font-display text-[13.5px] font-bold">Credit &amp; terms</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Credit limit"
          inputMode="numeric"
          suffix="CAD"
          {...register('creditLimitDollars')}
        />
        <SelectField control={control} name="terms" label="Terms" options={TERMS} />
      </div>

      <p className="tnum mt-2.5 text-[12.5px] text-ink-500">
        Currently drawn: <span className="font-medium text-ink-900">{money(user.balance)}</span> of{' '}
        {money(user.creditLimit)}
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
  );
}

export { TERMS, STATUS_TONES };
