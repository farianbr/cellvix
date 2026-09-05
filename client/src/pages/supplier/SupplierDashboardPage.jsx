import { Link } from 'react-router';
import { ArrowRight, CheckCircle2, Clock, Inbox, Trophy } from 'lucide-react';
import { money, date, count as formatCount } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { useSupplierSession, useSupplierRfqs } from '@/hooks/useSupplierPortal';

/**
 * What a supplier sees when they sign in (§6.8a).
 *
 * **Requests needing a price come first**, and everything else is history. A
 * supplier opens this to answer something, not to browse; sorting by date and
 * making them scan for which of nine rows is still open would put the one piece
 * of work behind the eight that are done.
 *
 * Nothing on this screen mentions another supplier. The server's serializer
 * returns this supplier's own invite and nothing else — no rank, no "you were
 * $40 off" — because a sealed request that quietly reports the competition is a
 * live auction nobody agreed to run.
 */
const STATE_TONES = {
  open: 'brand',
  closed: 'neutral',
  won: 'ok',
  cancelled: 'danger',
};

const QUOTE_TONES = {
  invited: 'warn',
  viewed: 'warn',
  quoted: 'info',
  declined: 'neutral',
  won: 'ok',
  lost: 'neutral',
};

const QUOTE_LABELS = {
  invited: 'needs a price',
  viewed: 'needs a price',
  quoted: 'quoted',
  declined: 'you declined',
  won: 'you won',
  lost: 'not chosen',
};

function RfqCard({ rfq }) {
  const needsPrice = rfq.state === 'open' && ['invited', 'viewed'].includes(rfq.myQuote.status);

  return (
    <li>
      <Link
        to={`/supplier/rfq/${rfq.id}`}
        className={cn(
          pressable,
          'flex items-start gap-3 rounded-lg border bg-surface p-4',
          needsPrice ? 'border-brand/40' : 'border-line hover:border-line-strong',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-ink-900">{rfq.rfqNumber}</span>
            <Badge tone={QUOTE_TONES[rfq.myQuote.status]} size="sm">
              {QUOTE_LABELS[rfq.myQuote.status]}
            </Badge>
            {rfq.state === 'closed' && rfq.myQuote.status !== 'lost' && (
              <Badge tone={STATE_TONES.closed} size="sm">
                closed
              </Badge>
            )}
          </span>

          {rfq.title && (
            <span className="mt-0.5 block truncate text-sm text-ink-700">{rfq.title}</span>
          )}

          <span className="mt-1 block text-xs text-ink-400">
            {formatCount(rfq.items.length)} line{rfq.items.length === 1 ? '' : 's'}
            {rfq.closesAt && (
              <>
                {' · '}
                {rfq.closed ? 'closed' : 'closes'} {date(rfq.closesAt)}
              </>
            )}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          {rfq.myQuote.status === 'quoted' || rfq.myQuote.status === 'won' ? (
            <span className="tnum font-display text-md font-semibold text-ink-900">
              {money(rfq.myQuote.total)}
            </span>
          ) : null}
          <ArrowRight className="size-4 text-ink-300" strokeWidth={2} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export function SupplierDashboardPage() {
  const { supplier } = useSupplierSession();
  const { data, isLoading } = useSupplierRfqs();

  const rfqs = data?.rfqs ?? [];

  const needsPrice = rfqs.filter(
    (rfq) => rfq.state === 'open' && ['invited', 'viewed'].includes(rfq.myQuote.status),
  );
  const waiting = rfqs.filter((rfq) => rfq.state === 'open' && rfq.myQuote.status === 'quoted');
  const settled = rfqs.filter((rfq) => !needsPrice.includes(rfq) && !waiting.includes(rfq));

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-24 w-full" />
        <Skeleton className="mt-3 h-24 w-full" />
      </>
    );
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold leading-tight text-ink-900">
          {needsPrice.length
            ? `${formatCount(needsPrice.length)} request${needsPrice.length === 1 ? '' : 's'} waiting on your price`
            : 'Nothing needs a price right now'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Signed in as {supplier?.name}. We will email you when a new request goes out.
        </p>
      </div>

      {!rfqs.length ? (
        <Panel>
          <PanelEmpty
            icon={Inbox}
            title="No requests yet"
            body="When we ask you to price something, it appears here and you will get an email about it."
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {needsPrice.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2 flex items-center gap-1.5 text-ink-400">
                <Clock className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                Needs your price
              </h2>
              <ul className="space-y-2">
                {needsPrice.map((rfq) => (
                  <RfqCard key={rfq.id} rfq={rfq} />
                ))}
              </ul>
            </section>
          )}

          {waiting.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2 flex items-center gap-1.5 text-ink-400">
                <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                Quoted, waiting on us
              </h2>
              <ul className="space-y-2">
                {waiting.map((rfq) => (
                  <RfqCard key={rfq.id} rfq={rfq} />
                ))}
              </ul>
            </section>
          )}

          {settled.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2 flex items-center gap-1.5 text-ink-400">
                <Trophy className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                Decided
              </h2>
              <ul className="space-y-2">
                {settled.map((rfq) => (
                  <RfqCard key={rfq.id} rfq={rfq} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export default SupplierDashboardPage;
