import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import cn from '@/lib/cn';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { PanelEmpty } from '@/components/ui/Panel';
import PageHeader from '@/components/admin/PageHeader';
import DataTable, { CountLine } from '@/components/admin/DataTable';
import FilterStrip from '@/components/admin/FilterStrip';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuditLog } from '@/hooks/useAdmin';
import { dateTime } from '@/lib/format';
import SelectMenu from '@/components/ui/SelectMenu';

/**
 * The Activity and Security logs (§6.15, category 6, phase 11b).
 *
 * **One component, two screens.** They are the same table with a different
 * `kind` and one extra column, and forking them would mean two places to fix
 * the next time a column is added. §6.15 describes them as a pair for the same
 * reason.
 *
 * **Read-only, with no affordance suggesting otherwise** — no row menu, no
 * selection checkboxes, no delete. Both are append-only by construction, and a
 * disabled delete button would imply the capability exists somewhere.
 *
 * Rows expand to show what changed. The diff is the whole point of the screen:
 * "Priya updated a role" is a notification, while "Priya changed Warehouse's
 * purchase access from view to full" is an audit trail.
 */

/**
 * An action verb to a tone. Destructive and permission-granting actions are
 * coloured because they are what somebody scanning this screen is looking for.
 */
function actionTone(action) {
  if (/delete|reject|void|refund|failed|locked/.test(action)) return 'danger';
  if (/create|approve|login\b/.test(action)) return 'ok';
  if (/role|staff|status|credit|rate/.test(action)) return 'warn';
  return 'neutral';
}

/** `invoice.void` → `Invoice void`. The stored verb stays stable; the label is display. */
function actionLabel(action) {
  return action
    .replace(/[._]/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

/**
 * One changed field, before and after.
 *
 * Values are rendered as JSON rather than coerced to strings: a tax table and a
 * role's area map are objects, and `[object Object]` in an audit trail is worse
 * than no row at all.
 */
function DiffValue({ value }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-ink-400 italic">empty</span>;
  }
  if (typeof value === 'object') {
    return (
      <code className="block break-all whitespace-pre-wrap">{JSON.stringify(value, null, 1)}</code>
    );
  }
  return <code className="break-all">{String(value)}</code>;
}

function Diff({ before, after }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (!keys.length) return null;

  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]">
      {keys.map((key) => (
        <div key={key} className="contents">
          <dt className="font-display font-semibold text-ink-600">{key}</dt>
          <dd className="flex min-w-0 flex-wrap items-start gap-2">
            {before && key in before && (
              <span className="min-w-0 rounded-sm bg-danger-50 px-1.5 py-0.5 text-danger">
                <DiffValue value={before[key]} />
              </span>
            )}
            {after && key in after && (
              <span className="min-w-0 rounded-sm bg-ok-50 px-1.5 py-0.5 text-ok">
                <DiffValue value={after[key]} />
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditLogScreen({ kind, page: meta, notice }) {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState(null);

  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useAuditLog(kind, {
    q: debounced || undefined,
    action: action === 'all' ? undefined : action,
    page,
  });

  const entries = data?.entries ?? [];

  const columns = [
    {
      key: 'createdAt',
      header: 'Time',
      width: '160px',
      sortable: false,
      render: (row) => <span className="tnum text-ink-600">{dateTime(row.createdAt)}</span>,
    },
    {
      key: 'actorEmail',
      header: 'User',
      sortable: false,
      render: (row) =>
        row.actorEmail ? (
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink-900">
              {row.actorName || row.actorEmail}
            </span>
            {/*
              A platform operator is called out, not left to look like staff.
              This row is the owner's only evidence that somebody outside their
              business acted inside it (SAAS_PLATFORM §4.5), so it has to be
              legible at a glance — an email nobody recognises, sitting in a
              column of colleagues, is not.
            */}
            {row.actorKind === 'superadmin' && (
              <Badge tone="warn" size="sm" className="mt-0.5">
                Platform support
              </Badge>
            )}
            {row.actorName && (
              <span className="block truncate text-xs text-ink-500">{row.actorEmail}</span>
            )}
          </span>
        ) : (
          // Not "system" and not blank: an unauthenticated event genuinely had
          // nobody signed in, and saying so is more honest than inventing an
          // actor for it.
          <span className="text-ink-400 italic">not signed in</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: false,
      render: (row) => <Badge tone={actionTone(row.action)}>{actionLabel(row.action)}</Badge>,
    },
    {
      key: 'entity',
      header: 'Entity',
      priority: 2,
      sortable: false,
      render: (row) => (
        <span className="min-w-0">
          <span className="block text-ink-700 capitalize">{row.entity?.kind}</span>
          {(row.entity?.label || row.entity?.id) && (
            <span className="block truncate font-mono text-xs text-ink-500">
              {row.entity.label || row.entity.id}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      priority: 2,
      sortable: false,
      render: (row) => <span className="text-ink-600">{row.description}</span>,
    },
    {
      key: 'ip',
      header: 'IP',
      priority: 3,
      width: '140px',
      sortable: false,
      render: (row) => <span className="font-mono text-xs text-ink-500">{row.ip || '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader icon={meta.icon} title={meta.title} description={meta.description} />

      {notice}

      <FilterStrip
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by user, action, entity or IP…"
        // No export: §7.4 gives every list one, but an export here writes its
        // own audit row and would be the only mutation on a read-only screen.
        exportFormats={[]}
        filters={
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <span className="shrink-0">Action</span>
            <SelectMenu
              srLabel="Filter by action"
              value={action}
              onChange={(next) => {
                setAction(next);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All actions' },
                ...(data?.actions ?? []).map((value) => ({ value, label: value })),
              ]}
            />
          </label>
        }
        activeFilterCount={action === 'all' ? 0 : 1}
        onClearFilters={() => {
          setAction('all');
          setPage(1);
        }}
      />

      <div className="border-b border-line px-3 py-2 sm:px-4">
        <CountLine
          total={entries.length}
          noun={entries.length === 1 ? 'entry' : 'entries'}
        />
      </div>

      <DataTable
        columns={columns}
        rows={entries}
        loading={isLoading}
        sortable={false}
        // Rows open to show the diff rather than navigating: the change *is*
        // the record here, and there is no detail page behind it.
        onRowClick={(row) => setOpenRow(openRow === row.id ? null : row.id)}
        empty={
          <PanelEmpty
            icon={ShieldAlert}
            title="Nothing logged yet"
            body={
              debounced || action !== 'all'
                ? 'No entries match those filters.'
                : 'Entries appear here as soon as somebody changes something.'
            }
          />
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              {data?.total ?? 0} {data?.total === 1 ? 'entry' : 'entries'}
            </p>
            <Pagination
              page={data?.page ?? 1}
              pages={data?.pages ?? 1}
              onChange={setPage}
            />
          </div>
        }
      />

      {/* The diff for the open row. Below the table rather than inside it: a
          nested grid inside a cell collapses badly on a phone, and this reads
          the same at every width. */}
      {openRow && (
        <div className="mt-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
          {(() => {
            const row = entries.find((entry) => entry.id === openRow);
            if (!row) return null;

            const hasDiff =
              (row.before && Object.keys(row.before).length) ||
              (row.after && Object.keys(row.after).length);

            return (
              <>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                  <h2 className="font-display text-md font-bold">
                    {actionLabel(row.action)}
                    {row.entity?.label ? ` — ${row.entity.label}` : ''}
                  </h2>
                  <p className="tnum text-sm text-ink-500">{dateTime(row.createdAt)}</p>
                </div>

                <p className="mb-3 text-sm text-ink-600">{row.description}</p>

                {hasDiff ? (
                  <Diff before={row.before} after={row.after} />
                ) : (
                  <p className="text-sm text-ink-500">
                    No field-level detail was recorded for this entry.
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}
    </>
  );
}

export default AuditLogScreen;
