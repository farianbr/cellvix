import { useState } from 'react';
import { MessageSquare, Phone, Plus, Trash2 } from 'lucide-react';

import cn from '@/lib/cn';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useMarketingTemplates, useMarketingSummary, useAdminMutations } from '@/hooks/useAdmin';
import { pressable } from '@/lib/motion';
import SelectMenu from '@/components/ui/SelectMenu';

/**
 * Message Templates (§6.15 category 5, phase 11e).
 *
 * The model and its CRUD landed in phase 9 — this is the screen that was
 * missing. Templates are **fully functional on email from day one**: a template
 * picked on the SMS screen fills the textarea perfectly well, and it is the
 * *sending* that waits on Twilio, not the text. So this is not on the §6b
 * register.
 *
 * **Call templates are a script for staff to read**, not a message anybody
 * sends — §6.15 keeps that and so does this, because it is the reason the Calls
 * screen logs rather than dials.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/settings/templates'], icon: adminIcon('MessageSquare') };

const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Call' },
];

const DOCUMENTS = [
  { value: 'none', label: 'Any' },
  { value: 'order', label: 'Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote' },
  { value: 'rma', label: 'RMA' },
];

const TOKENS = [
  { token: '{{businessName}}', label: 'Business name' },
  { token: '{{contactName}}', label: 'Contact name' },
  { token: '{{email}}', label: 'Email address' },
  { token: '{{companyName}}', label: 'Cellvix' },
];

const EMPTY = { name: '', channel: 'email', document: 'none', subject: '', body: '', isActive: true };

function TemplateDialog({ template, onClose }) {
  const editing = Boolean(template.id);
  const [form, setForm] = useState({ ...EMPTY, ...template });
  const [error, setError] = useState(null);
  const { createTemplate, updateTemplate } = useAdminMutations();

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const isCall = form.channel === 'call';

  async function save(event) {
    event.preventDefault();
    setError(null);
    try {
      const payload = {
        name: form.name,
        channel: form.channel,
        document: form.document,
        subject: form.subject,
        body: form.body,
        isActive: form.isActive,
      };
      if (editing) await updateTemplate.mutateAsync({ id: template.id, ...payload });
      else await createTemplate.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Edit “${template.name}”` : 'New template'} size="lg">
      <form onSubmit={save} className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => set({ name: e.target.value })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Channel</span>
            <SelectMenu
              srLabel="Channel"
              size="md"
              value={form.channel}
              onChange={(next) => set({ channel: next })}
              options={CHANNELS}
              containerClassName="w-full"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Document</span>
            <SelectMenu
              srLabel="Document"
              size="md"
              value={form.document}
              onChange={(next) => set({ document: next })}
              options={DOCUMENTS}
              containerClassName="w-full"
            />
            <span className="mt-1.5 block text-sm text-ink-400">
              Tying a template to a record type is what lets a screen offer the ones that make sense
              there instead of the whole list.
            </span>
          </label>
        </div>

        {form.channel === 'email' && (
          <Input
            label="Subject"
            value={form.subject}
            onChange={(e) => set({ subject: e.target.value })}
          />
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            {isCall ? 'Script' : 'Message'}
          </span>
          <textarea
            rows={8}
            value={form.body}
            onChange={(e) => set({ body: e.target.value })}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-md leading-relaxed text-ink-900 focus:border-ink-400 focus:ring-2 focus:ring-ink-900/15 focus:outline-none"
          />
          {/* A call template is read aloud, not transmitted. Saying so at the
              point of writing it stops somebody composing it as an SMS. */}
          {isCall && (
            <span className="mt-1.5 flex items-start gap-1.5 text-sm text-ink-500">
              <Phone className="mt-px size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              A call template is a script for staff to read on the phone. Nothing is sent.
            </span>
          )}
        </label>

        <div className="rounded-md bg-surface-2 px-3 py-2.5">
          <p className="mb-1.5 text-sm font-medium text-ink-700">Placeholders</p>
          <div className="flex flex-wrap gap-1.5">
            {TOKENS.map((token) => (
              <button
                key={token.token}
                type="button"
                title={token.label}
                onClick={() => set({ body: `${form.body}${token.token}` })}
                className={cn(pressable, 'rounded-sm bg-surface px-1.5 py-1 font-mono text-xs text-ink-600 hover:bg-brand-50 hover:text-brand')}
              >
                {token.token}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Filled against the account the message is for. An unrecognised placeholder is left as
            written rather than blanked, so a typo is visible.
          </p>
        </div>

        <label className="flex items-start gap-2.5 rounded-md bg-surface-2 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set({ isActive: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--color-brand)]"
          />
          <span className="text-sm leading-relaxed text-ink-700">
            <span className="font-medium">Active</span>
            <span className="mt-0.5 block text-sm text-ink-500">
              Offered in the template picker on the compose screens.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" loading={createTemplate.isPending || updateTemplate.isPending}>
            {editing ? 'Save' : 'Create'}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className={cn(pressable, 'inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-ink-600 hover:border-line-strong hover:text-ink-900')}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminTemplatesPage() {
  const [channel, setChannel] = useState('email');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  // The trash icon used to delete on the click itself.
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useMarketingTemplates();
  const { data: summary } = useMarketingSummary();
  const { deleteTemplate } = useAdminMutations();

  const all = data?.templates ?? [];
  const shown = all.filter((template) => template.channel === channel);
  const status = summary?.channels?.[channel];

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <Button size="sm" onClick={() => setEditing({ ...EMPTY, channel })}>
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            New template
          </Button>
        }
      />

      {/* Channel tabs with a count each, as §6.15 specifies — the count is what
          makes an empty channel visible without opening it. */}
      {/* The measure wraps the tabs and the notice as well as the list.

          They sat outside the capped container, so the channel tabs and a
          full-bleed warning ran to 1400px above a panel that stopped at 760 —
          the page disagreed with itself about where its own edge was. */}
      <div className="max-w-form">
      <nav aria-label="Channels" className="mb-4 -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {CHANNELS.map((tab) => {
          const count = all.filter((template) => template.channel === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setChannel(tab.value)}
              aria-current={tab.value === channel ? 'page' : undefined}
              className={cn(
                pressable,
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 font-display text-sm font-semibold',
                tab.value === channel
                  ? 'bg-ink-900 text-white'
                  : 'text-ink-500 hover:bg-surface-2 hover:text-ink-700',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'tnum rounded-full px-1.5 text-2xs',
                  tab.value === channel ? 'bg-white/20' : 'bg-surface-3 text-ink-500',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Templates work on every channel; only *sending* waits on a provider.
          Said here so an operator writing an SMS template is not left wondering
          whether the text is going anywhere. */}
      {status && !status.delivers && channel !== 'call' && (
        <p className="mb-4 rounded-lg border border-warn/25 bg-warn-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
          Templates on this channel are saved and can be picked when composing — {status.reason}
        </p>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-ink-500">Loading templates…</p>
        ) : shown.length === 0 ? (
          <Panel>
            <PanelEmpty
              icon={MessageSquare}
              title={`No ${channel} templates`}
              body="Templates fill the compose box on the marketing screens, so a message that gets written often only gets written once."
            />
          </Panel>
        ) : (
          shown.map((template) => (
            <Panel key={template.id}>
              <div className="flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(template)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-md font-semibold text-ink-900">
                      {template.name}
                    </span>
                    {template.document !== 'none' && (
                      <Badge tone="neutral">
                        {DOCUMENTS.find((d) => d.value === template.document)?.label}
                      </Badge>
                    )}
                    {!template.isActive && <Badge tone="warn">Inactive</Badge>}
                  </span>
                  {template.subject && (
                    <span className="mt-1 block truncate text-sm font-medium text-ink-600">
                      {template.subject}
                    </span>
                  )}
                  <span className="mt-1 block line-clamp-2 text-sm leading-relaxed whitespace-pre-wrap text-ink-500">
                    {template.body}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleting(template)}
                  aria-label={`Delete ${template.name}`}
                  className={cn(pressable, 'flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-400 hover:border-danger hover:bg-danger-50 hover:text-danger')}
                >
                  <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
            </Panel>
          ))
        )}

        {error && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {editing && <TemplateDialog template={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleteTemplate
            .mutateAsync(deleting.id)
            .then(() => setDeleting(null))
            .catch((e) => setError(e.message))
        }
        title="Delete this template?"
        body={deleting ? `“${deleting.name}” will be removed permanently.` : ''}
        confirmLabel="Delete template"
        loading={deleteTemplate.isPending}
      />
      </div>
    </>
  );
}

export default AdminTemplatesPage;
