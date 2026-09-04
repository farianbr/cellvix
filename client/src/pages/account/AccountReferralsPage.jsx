import { useState } from 'react';
import { Check, Copy, Gift, Link2, TrendingUp, Users } from 'lucide-react';
import cn from '@/lib/cn';
import { money, moneyCompact, date } from '@/lib/format';
import Panel, { CollapsiblePanel, StatTile, PanelEmpty } from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { useReferrals } from '@/hooks/useAccount';

/**
 * Refer & earn — the buyer's side of §6.13.
 *
 * Two things a referrer needs and one they do not. They need their code and
 * their link, big enough to read out down a phone line; and they need to see
 * what has been earned, so the arrangement is visibly real rather than a
 * promise.
 *
 * What they are deliberately **not** shown is what the accounts they referred
 * spent. Commission is a percentage of it, so it could be inferred — but
 * inferring it takes intent, and putting another business's trading volume on
 * a screen does not. The table shows who joined, whether they are trading, and
 * what the referrer earned.
 *
 * Every figure arrives computed from the ledger (`referralService.referralsFor`).
 * Nothing here multiplies a rate by an amount: the rate that was in force when
 * a commission was earned is snapshotted on the row, and recomputing it in the
 * browser would silently restate history the day the rate changes.
 */

function CopyRow({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused — an insecure origin, a locked-down
      // browser. The value is on screen and selectable either way, so this
      // fails quietly rather than throwing an error at something cosmetic.
    }
  }

  return (
    <div>
      <p className="eyebrow mb-1.5 text-ink-400">{label}</p>
      <div className="flex items-center gap-2">
        <code
          className={cn(
            'min-w-0 flex-1 truncate rounded-md border border-line bg-surface-2 px-3 py-2.5 text-ink-900',
            mono
              ? 'font-mono text-lg font-bold tracking-wide'
              : 'font-mono text-sm',
          )}
        >
          {value}
        </code>
        <Button
          size="sm"
          variant={copied ? 'brandSoft' : 'outline'}
          icon={copied ? Check : Copy}
          onClick={copy}
          className="shrink-0"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

export function AccountReferralsPage() {
  const { data, isLoading } = useReferrals();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { code, percent, accounts, totals, history } = data;
  const link = code ? `${window.location.origin}/?ref=${encodeURIComponent(code)}` : null;

  return (
    <div className="space-y-4">
      {/* ---- the code ---------------------------------------------------- */}
      <Panel
        title="Your referral code"
        description={`Earn ${percent}% of what every account you refer pays, as store credit.`}
      >
        {code ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CopyRow label="Code" value={code} />
              <CopyRow label="Share link" value={link} mono={false} />
            </div>

            <ol className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
              {[
                {
                  icon: Link2,
                  title: 'Share your code',
                  body: 'They enter it when they register, or arrive on your link.',
                },
                {
                  icon: Users,
                  title: 'They open an account',
                  body: 'Once approved, they order the way any wholesale account does.',
                },
                {
                  icon: Gift,
                  title: 'You earn store credit',
                  body: `${percent}% of every invoice they pay, credited automatically.`,
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                    <step.icon className="size-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-ink-500">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <PanelEmpty
            icon={Gift}
            title="Your code is on the way"
            body="Referral codes are issued once an account is approved. Yours will appear here."
          />
        )}
      </Panel>

      {/* ---- what it has earned ------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Earned"
          value={moneyCompact(totals.earned)}
          hint={totals.reversed > 0 ? `${money(totals.reversed)} reversed` : 'Added to store credit'}
          tone={totals.earned > 0 ? 'ok' : 'neutral'}
          icon={TrendingUp}
        />
        <StatTile
          label="Accounts referred"
          value={String(totals.referred)}
          hint={`${totals.active} trading`}
          icon={Users}
        />
        <StatTile
          label="Current rate"
          value={`${percent}%`}
          hint="Of every invoice they pay"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* ---- who ---------------------------------------------------------- */}
      <Panel title="Accounts you referred" flush>
        {accounts.length === 0 ? (
          <PanelEmpty
            icon={Users}
            title="No referrals yet"
            body="Share your code above. You will see every account that joins on it here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-36 flex-1">
                  <p className="truncate text-md font-semibold text-ink-900">
                    {account.businessName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Joined {date(account.joinedAt)}
                    {account.lastEarnedAt && ` · last earned ${date(account.lastEarnedAt)}`}
                  </p>
                </div>

                {/* "Trading" rather than their account status: whether they are
                    approved is Cellvix's business with them, not the
                    referrer's. What the referrer needs to know is whether this
                    referral can earn yet. */}
                <Badge tone={account.active ? 'ok' : 'neutral'} size="sm">
                  {account.active ? 'Trading' : 'Not yet trading'}
                </Badge>

                <p className="tnum w-20 text-right text-md font-semibold text-ink-900">
                  {account.commissionEarned > 0 ? money(account.commissionEarned) : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ---- how it added up ----------------------------------------------
          Collapsed: the tiles above already state what has been earned, and
          this is the working behind that number — reference a buyer opens when
          a figure surprises them, not something they need on arrival. */}
      {history.length > 0 && (
        <CollapsiblePanel
          title="Commission history"
          description="Each payment your referrals made, and what it earned you."
          summary={
            <span className="tnum">
              {history.length} {history.length === 1 ? 'entry' : 'entries'}
            </span>
          }
          flush
        >
          <ul className="divide-y divide-line">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink-900">
                    {row.reversal ? 'Reversed' : 'Earned'}
                    {row.fromName ? ` · ${row.fromName}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {date(row.at)}
                    {/* The rate as it stood when this was earned, not today's —
                        which is why it is stored on the row rather than
                        recomputed. */}
                    {row.percent != null && ` · ${row.percent}%`}
                  </p>
                </div>
                <p
                  className={cn(
                    'tnum shrink-0 font-semibold',
                    row.reversal ? 'text-ink-400' : 'text-ok',
                  )}
                >
                  {row.reversal ? '−' : '+'}
                  {money(Math.abs(row.amount))}
                </p>
              </li>
            ))}
          </ul>
        </CollapsiblePanel>
      )}
    </div>
  );
}

export default AccountReferralsPage;
