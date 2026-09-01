import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import cn from '@/lib/cn';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import SelectMenu from '@/components/ui/SelectMenu';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import ActivityFeed from '@/components/account/ActivityFeed';
import { useActivityHistory } from '@/hooks/useAccount';

/**
 * The filterable kinds, matching `ACTIVITY_GROUPS` in
 * `server/src/services/activityService.js`. Grouped the way a buyer thinks
 * about them rather than the way they are stored — "Orders" means both placing
 * an order and every status step after it, because a filter for orders that
 * hid half the order events would be a worse filter than none.
 */
const KIND_FILTERS = [
  { value: 'all', label: 'All activity' },
  { value: 'order', label: 'Orders' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'payment', label: 'Payments' },
  { value: 'credit', label: 'Credit' },
];

const PER_PAGE = [
  { value: '20', label: '20 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

/**
 * The account's own history, in full.
 *
 * The dashboard already carries the last eight events, which answers "what
 * happened lately" and nothing else. This page answers the questions that
 * needed a phone call to the sales desk before it existed: when an invoice was
 * actually issued, whether a refund landed, which order drew against the limit
 * in March.
 *
 * **Filtering and paging are server-side.** The feed is a merge of three
 * collections assembled by `activityService`, so filtering a page's worth of
 * rows in the browser would filter whatever happened to be on that page rather
 * than the account's history — a kind filter would appear to lose events that
 * are simply on page 2. The server filters the whole window and then pages what
 * matched, so the counts and the pages agree.
 */
export function AccountActivityPage() {
  const [kind, setKind] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState('20');
  const [page, setPage] = useState(1);

  // Any filter change invalidates the current page number: page 4 of an
  // unfiltered feed is rarely page 4 of a filtered one, and the server clamps
  // an over-range page anyway, so landing the buyer back at the top is both
  // correct and what they expect from changing a filter.
  useEffect(() => {
    setPage(1);
  }, [kind, from, to, limit]);

  const { data, isLoading, isFetching } = useActivityHistory({
    kind,
    from: from || null,
    to: to || null,
    page,
    limit: Number(limit),
  });

  const events = data?.activity ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const unfiltered = data?.unfiltered ?? 0;
  const isFiltered = kind !== 'all' || Boolean(from) || Boolean(to);

  function resetFilters() {
    setKind('all');
    setFrom('');
    setTo('');
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    );
  }

  return (
    <Panel
      title="Activity"
      description={
        isFiltered ? `${total} of ${unfiltered} events` : `${total} ${total === 1 ? 'event' : 'events'}`
      }
      flush
    >
      {/* ---- filters ------------------------------------------------------
          A toolbar rather than a sidebar: four controls do not earn a column,
          and on a phone a filter sidebar becomes a sheet the buyer has to open
          before they can see it is only four controls. They wrap instead. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-line p-4 sm:px-5">
        <SelectMenu
          options={KIND_FILTERS}
          value={kind}
          onChange={setKind}
          srLabel="Filter by activity type"
          size="md"
          className="w-[150px]"
        />

        {/* One labelled range rather than two labelled fields: "From / To"
            above two boxes reads as two filters that happen to sit together.
            The em dash between them is what says it is one.

            Native date inputs — the platform picker is keyboard-accessible,
            localised and understood, and this is a range filter on a dashboard,
            not a booking flow that would justify a custom calendar. They are
            sized to their own content: a date input renders a fixed-width mask
            (`dd/mm/yyyy`) and a wider box just adds dead space beside it. */}
        <div className="flex items-center gap-2">
          <span className="eyebrow shrink-0 text-ink-400" id="activity-range">
            Between
          </span>
          <Input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="From date"
            aria-describedby="activity-range"
            containerClassName="w-[148px]"
          />
          <span className="text-ink-300" aria-hidden="true">
            —
          </span>
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            aria-label="To date"
            aria-describedby="activity-range"
            containerClassName="w-[148px]"
          />
        </div>

        {/* Pushed right only once the row is wide enough to hold everything on
            one line. Below that it follows the range as the next item on a
            wrapped line — `ml-auto` at every width would strand it alone on the
            right of a line of its own, with the gap still held open above. The
            account sidebar means that happens around 1200px, not at `lg`. */}
        <div className="flex items-center gap-2 xl:ml-auto">
          {isFiltered && (
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Clear
            </Button>
          )}
          <SelectMenu
            options={PER_PAGE}
            value={limit}
            onChange={setLimit}
            srLabel="Events per page"
            size="md"
            className="w-[136px]"
          />
        </div>
      </div>

      {events.length === 0 ? (
        <PanelEmpty
          icon={History}
          title={isFiltered ? 'Nothing matches those filters' : 'No activity yet'}
          body={
            isFiltered
              ? 'Try a wider date range, or a different type of activity.'
              : 'Orders, invoices, payments and credit movements will appear here as they happen.'
          }
          action={
            isFiltered ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Dimmed while the next page loads rather than swapped for a
              skeleton: the rows are the same height and the same shape, so a
              skeleton would flash the layout for no information gained. */}
          <div
            className={cn(
              'transition-opacity duration-[180ms]',
              isFetching ? 'opacity-60' : 'opacity-100',
            )}
            aria-busy={isFetching}
          >
            <ActivityFeed events={events} />
          </div>

          {pages > 1 && (
            <div className="border-t border-line p-4 sm:px-5">
              <Pagination page={page} pages={pages} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export default AccountActivityPage;
