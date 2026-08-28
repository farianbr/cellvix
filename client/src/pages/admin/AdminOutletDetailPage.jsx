import { Link, useParams } from 'react-router';
import { Building2, Mail, MapPin, Pencil, Phone, Star, UserRound } from 'lucide-react';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminOutlet, useAdminMutations } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { canEdit } from '@/lib/permissions';
import { useSetRecordLabel } from '@/components/admin/shell/recordLabel';

/** One store: its details and the staff standing in it (§6.14). */
const STATUS_TONE = { active: 'ok', inactive: 'neutral', maintenance: 'warn' };
const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', maintenance: 'Maintenance' };

const DAY_LABEL = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export function AdminOutletDetailPage() {
  const { id } = useParams();
  const { data: outlet, isLoading } = useAdminOutlet(id);
  const { setDefaultOutlet } = useAdminMutations();
  const { permissions } = useAuth();
  const editable = canEdit(permissions, 'outlet');

  // The breadcrumb is a sibling of this page, not a child, so the record name
  // is published rather than passed down.
  useSetRecordLabel(outlet?.name);

  if (isLoading) return <p className="text-[13px] text-ink-500">Loading outlet…</p>;
  if (!outlet) return <PanelEmpty icon={Building2} title="Outlet not found" body="It may have been deleted." />;

  const address = [outlet.address?.street, outlet.address?.line2, outlet.address?.city, outlet.address?.region, outlet.address?.postal, outlet.address?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <PageHeader
        icon={adminIcon('Store')}
        title={outlet.name}
        description={outlet.code}
        badge={
          <div className="flex gap-1.5">
            <Badge tone={STATUS_TONE[outlet.status] ?? 'neutral'} size="sm">
              {STATUS_LABEL[outlet.status] ?? outlet.status}
            </Badge>
            {outlet.isDefault && (
              <Badge tone="brand" size="sm">
                Default
              </Badge>
            )}
          </div>
        }
        action={
          editable && (
            <div className="flex gap-2">
              {!outlet.isDefault && outlet.status === 'active' && (
                <Button variant="outline" size="sm" onClick={() => setDefaultOutlet.mutate(outlet.id)}>
                  <Star className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  Make default
                </Button>
              )}
              <Link
                to={`/admin/outlets/${outlet.id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-ink-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-800"
              >
                <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Edit
              </Link>
            </div>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-4">
          <Panel title="Contact & location">
            <dl className="flex flex-col gap-3 text-[13.5px]">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <dt className="text-[12px] text-ink-400">Address</dt>
                  <dd className="text-ink-900">{address || 'Not set'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <dt className="text-[12px] text-ink-400">Phone</dt>
                  <dd className="text-ink-900">{outlet.phone || 'Not set'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <dt className="text-[12px] text-ink-400">Email</dt>
                  <dd className="text-ink-900">{outlet.email || 'Not set'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 size-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <dt className="text-[12px] text-ink-400">Manager</dt>
                  <dd className="text-ink-900">{outlet.manager || 'Not set'}</dd>
                </div>
              </div>
            </dl>
          </Panel>

          {outlet.hours?.length > 0 && (
            <Panel title="Hours">
              <dl className="flex flex-col gap-1.5 text-[13px]">
                {outlet.hours.map((row) => (
                  <div key={row.day} className="flex justify-between border-b border-line py-1.5 last:border-0">
                    <dt className="text-ink-600">{DAY_LABEL[row.day] ?? row.day}</dt>
                    <dd className={row.closed ? 'text-ink-400' : 'text-ink-900'}>
                      {row.closed ? 'Closed' : `${row.open ?? '—'} – ${row.close ?? '—'}`}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          {outlet.notes && (
            <Panel title="Notes">
              <p className="text-[13.5px] leading-relaxed text-ink-600">{outlet.notes}</p>
            </Panel>
          )}
        </div>

        <Panel
          title="Staff"
          description="Assigned from the Users screen."
        >
          {outlet.staff?.length ? (
            <ul className="flex flex-col gap-2">
              {outlet.staff.map((member) => (
                <li
                  key={member._id ?? member.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-ink-900">{member.contactName}</p>
                    <p className="truncate text-[12px] text-ink-400">{member.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {member.lockedAt && (
                      <Badge tone="danger" size="sm">
                        Locked
                      </Badge>
                    )}
                    <Badge tone="neutral" size="sm">
                      {member.staffRole?.name ?? 'No role'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-500">Nobody is assigned to this outlet yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

export default AdminOutletDetailPage;
