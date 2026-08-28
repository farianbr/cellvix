import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import {
  roleSchema,
  PERMISSION_AREAS,
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABELS,
} from '@shared/schemas/admin';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminRoles, useAdminMutations } from '@/hooks/useAdmin';
import cn from '@/lib/cn';

/**
 * Roles & Access (§6.15/3, §7.6).
 *
 * A **named role carries the permission map**, and staff hold the role — so
 * changing what "Warehouse" may do updates everyone on it in one edit. That is
 * the operator's own mental model: they think in job titles, not in per-user
 * checkboxes.
 *
 * Access is **per area, not per page**. A twenty-row matrix is one nobody
 * maintains correctly, and an unmaintained permission system gets set to full
 * access and forgotten.
 *
 * Everything here is a courtesy: `requirePermission` decides on the server for
 * every request. A role edited in this screen changes what the server allows,
 * not merely what the sidebar shows.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/settings/roles'], icon: adminIcon('ShieldCheck') };

const AREA_LABELS = {
  clients: 'Clients',
  sales: 'Sales',
  purchase: 'Purchase',
  reports: 'Reports',
  marketing: 'Marketing',
  outlet: 'Outlet',
  settings: 'Settings',
};

const LEVEL_TONE = { none: 'neutral', view: 'info', full: 'ok' };

function emptyAreas() {
  return PERMISSION_AREAS.reduce((out, area) => ({ ...out, [area]: 'none' }), {});
}

function RoleForm({ role, onSubmit, onCancel, isPending, error }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? '',
      areas: role?.areas ?? emptyAreas(),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Input label="Role name" placeholder="Shipping Clerk" error={errors.name?.message} {...register('name')} />

      <div>
        <span className="mb-2 block text-[13px] font-medium text-ink-700">Access by area</span>
        <div className="flex flex-col gap-1.5">
          {PERMISSION_AREAS.map((area) => (
            <Controller
              key={area}
              control={control}
              name={`areas.${area}`}
              render={({ field }) => (
                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-line px-3 py-2">
                  <span className="text-[13px] text-ink-700">{AREA_LABELS[area]}</span>
                  {/* Three explicit buttons rather than a select: the whole
                      point of this screen is seeing a role's shape at a glance,
                      and seven collapsed dropdowns show nothing. */}
                  <div className="flex rounded-[8px] border border-line p-0.5">
                    {PERMISSION_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => field.onChange(level)}
                        aria-pressed={field.value === level}
                        className={cn(
                          'rounded-[6px] px-2.5 py-1 text-[12.5px] transition-colors',
                          field.value === level
                            ? 'bg-ink-900 text-white'
                            : 'text-ink-500 hover:bg-surface-2',
                        )}
                      >
                        {PERMISSION_LEVEL_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {role ? 'Save role' : 'Create role'}
        </Button>
      </div>
    </form>
  );
}

function RoleCard({ role, onEdit, onDelete }) {
  return (
    <article className="flex flex-col rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-medium text-ink-900">{role.name}</h3>
            {role.isSystem && (
              <Badge tone="dark" size="sm">
                Full access
              </Badge>
            )}
            {role.isBuiltIn && !role.isSystem && (
              <Badge tone="neutral" size="sm">
                Built-in
              </Badge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-400">
            <Users className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>

        {/* The Admin role is never editable and never deletable — enforced on
            the server too, because a hidden button is a suggestion. */}
        {!role.isSystem && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(role)} aria-label={`Edit ${role.name}`}>
              <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
            {!role.isBuiltIn && (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => onDelete(role)}
                aria-label={`Delete ${role.name}`}
              >
                <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        {PERMISSION_AREAS.map((area) => (
          <Badge key={area} tone={LEVEL_TONE[role.areas?.[area] ?? 'none']} size="sm">
            {AREA_LABELS[area]}: {PERMISSION_LEVEL_LABELS[role.areas?.[area] ?? 'none']}
          </Badge>
        ))}
      </div>
    </article>
  );
}

export function AdminRolesPage() {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState(null);

  const { data, isLoading } = useAdminRoles();
  const { createRole, updateRole, deleteRole } = useAdminMutations();

  const roles = data?.roles ?? [];

  async function handleCreate(values) {
    setError(null);
    try {
      await createRole.mutateAsync(values);
      setAdding(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdate(values) {
    setError(null);
    try {
      await updateRole.mutateAsync({ id: editing.id, ...values });
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    setError(null);
    try {
      await deleteRole.mutateAsync(confirming.id);
      setConfirming(null);
    } catch (err) {
      // A role still held by somebody is refused, and the message names how
      // many hold it — reassigning them is the operator's next move.
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            Add role
          </Button>
        }
      />

      <Panel flush>
        {isLoading ? (
          <div className="p-4 text-[13px] text-ink-500">Loading roles…</div>
        ) : roles.length === 0 ? (
          <PanelEmpty icon={ShieldCheck} title="No roles" body="Add a role to start granting access." />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} onEdit={setEditing} onDelete={setConfirming} />
            ))}
          </div>
        )}
      </Panel>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a new role" size="lg">
        <RoleForm
          onSubmit={handleCreate}
          onCancel={() => setAdding(false)}
          isPending={createRole.isPending}
          error={error}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? 'role'}`}
        size="lg"
      >
        {editing && (
          <RoleForm
            role={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            isPending={updateRole.isPending}
            error={error}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={confirmDelete}
        title={`Delete ${confirming?.name ?? 'role'}?`}
        body="Staff holding this role must be reassigned before it can be removed."
        confirmLabel="Delete role"
        loading={deleteRole.isPending}
        error={error}
      />
    </>
  );
}

export default AdminRolesPage;
