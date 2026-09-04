import { useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, CheckCircle2, Clock, Play, Plus, Trash2 } from 'lucide-react';

import cn from '@/lib/cn';
import Panel from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminInvoiceRules, useAdminMutations } from '@/hooks/useAdmin';
import { dateTime } from '@/lib/format';

/**
 * Time-lapse invoice messages (§6.15 category 2, phase 11d).
 *
 * "Send a reminder three days before an invoice is due." Each rule fires **once
 * per invoice** when its delay elapses.
 *
 * **Everything ships switched off**, matching CellShoppe and for the same
 * reason: anything that emails a customer should be turned on deliberately by
 * somebody who has read what it says, not by installing the software.
 *
 * **There is no scheduler yet**, and the screen says so rather than implying
 * these fire on their own. `Run now` is how they go out today, and a dry run
 * shows what *would* go out without sending anything — which is the first thing
 * anyone wants before switching a rule on against live invoices.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/settings/invoice-status'], icon: adminIcon('FileText') };

const EMPTY_RULE = {
  label: '',
  trigger: 'invoice_due',
  delayDays: -3,
  channel: 'email',
  subject: '',
  message: '',
  isActive: false,
};

/** "3 days before the invoice falls due" — the timing, in words. */
function timingText(rule, triggers) {
  const trigger = triggers.find((t) => t.value === rule.trigger);
  const label = trigger?.label ?? rule.trigger;
  const days = Math.abs(rule.delayDays ?? 0);

  if (!rule.delayDays) return `As soon as ${label}`;
  return `${days} ${days === 1 ? 'day' : 'days'} ${rule.delayDays < 0 ? 'before' : 'after'} ${label}`;
}

function RuleDialog({ rule, triggers, tokens, channels, onClose }) {
  const editing = Boolean(rule.id);
  const [form, setForm] = useState({ ...EMPTY_RULE, ...rule });
  const [error, setError] = useState(null);
  const { createInvoiceRule, saveInvoiceRule } = useAdminMutations();

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const channelStatus = channels?.[form.channel];

  async function save(event) {
    event.preventDefault();
    setError(null);
    try {
      const payload = {
        label: form.label,
        trigger: form.trigger,
        delayDays: Number(form.delayDays),
        channel: form.channel,
        subject: form.subject,
        message: form.message,
        isActive: form.isActive,
      };
      if (editing) await saveInvoiceRule.mutateAsync({ id: rule.id, ...payload });
      else await createInvoiceRule.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Edit “${rule.label}”` : 'New invoice message'} size="lg">
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Name"
          hint="Only shown here — it is not sent to anybody."
          value={form.label}
          onChange={(event) => set({ label: event.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
          <Input
            type="number"
            min="-365"
            max="365"
            label="Days"
            suffix="days"
            hint="Negative is before."
            value={form.delayDays}
            onChange={(event) => set({ delayDays: event.target.value })}
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Counting from</span>
            <select
              value={form.trigger}
              onChange={(event) => set({ trigger: event.target.value })}
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-md text-ink-900 focus:border-ink-400 focus:ring-2 focus:ring-ink-900/15 focus:outline-none"
            >
              {triggers.map((trigger) => (
                <option key={trigger.value} value={trigger.value}>
                  {trigger.label}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-sm text-ink-400">
              {timingText({ ...form, delayDays: Number(form.delayDays) }, triggers)}.
            </span>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Channel</span>
          <select
            value={form.channel}
            onChange={(event) => set({ channel: event.target.value })}
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-md text-ink-900 focus:border-ink-400 focus:ring-2 focus:ring-ink-900/15 focus:outline-none"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          {/* Named at the point of choosing, not after saving: picking a channel
              that cannot send is a decision worth interrupting. */}
          {channelStatus && !channelStatus.delivers && (
            <span className="mt-1.5 flex items-start gap-1.5 text-sm text-warn">
              <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              {channelStatus.reason}
            </span>
          )}
        </label>

        {form.channel === 'email' && (
          <Input
            label="Subject"
            value={form.subject}
            onChange={(event) => set({ subject: event.target.value })}
          />
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Message</span>
          <textarea
            rows={7}
            value={form.message}
            onChange={(event) => set({ message: event.target.value })}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-md leading-relaxed text-ink-900 focus:border-ink-400 focus:ring-2 focus:ring-ink-900/15 focus:outline-none"
          />
        </label>

        <div className="rounded-md bg-surface-2 px-3 py-2.5">
          <p className="mb-1.5 text-sm font-medium text-ink-700">Placeholders</p>
          <div className="flex flex-wrap gap-1.5">
            {tokens.map((token) => (
              <button
                key={token.token}
                type="button"
                onClick={() => set({ message: `${form.message}${token.token}` })}
                title={token.label}
                className="rounded-sm bg-surface px-1.5 py-1 font-mono text-xs text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand"
              >
                {token.token}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            An unrecognised placeholder is left as written rather than replaced with a blank, so a
            typo is visible instead of silently sending a sentence with a hole in it.
          </p>
        </div>

        <label className="flex items-start gap-2.5 rounded-md bg-surface-2 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => set({ isActive: event.target.checked })}
            className="mt-0.5 size-4 accent-[var(--color-brand)]"
          />
          <span className="text-sm leading-relaxed text-ink-700">
            <span className="font-medium">Active</span>
            <span className="mt-0.5 block text-sm text-ink-500">
              Included the next time the messages are run. Each invoice receives this once.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" loading={createInvoiceRule.isPending || saveInvoiceRule.isPending}>
            {editing ? 'Save' : 'Create'}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-ink-600 transition-colors hover:border-line-strong hover:text-ink-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminInvoiceStatusPage() {
  const { data, isLoading } = useAdminInvoiceRules();
  const { saveInvoiceRule, deleteInvoiceRule, runInvoiceRules } = useAdminMutations();
  const [editing, setEditing] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // The trash icon used to delete on the click itself.
  const [deleting, setDeleting] = useState(null);

  const rules = data?.rules ?? [];
  const triggers = data?.triggers ?? [];

  async function toggle(rule) {
    setError(null);
    try {
      await saveInvoiceRule.mutateAsync({ ...rule, id: rule.id, isActive: !rule.isActive });
    } catch (err) {
      setError(err.message);
    }
  }

  async function run(dryRun) {
    setError(null);
    setResult(null);
    try {
      setResult(await runInvoiceRules.mutateAsync(dryRun));
    } catch (err) {
      setError(err.message);
    }
  }

  if (isLoading) return <p className="text-sm text-ink-500">Loading messages…</p>;

  const activeCount = rules.filter((rule) => rule.isActive).length;

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <Button size="sm" onClick={() => setEditing({ ...EMPTY_RULE })}>
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            New message
          </Button>
        }
      />

      {/* §6b rule 2 in spirit: state plainly what does not happen on its own.
          "Automatic" is the word on the tin, and nothing here is automatic yet. */}
      <p className="mb-5 flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
        <Clock className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
        <span>
          <strong className="font-semibold">These do not send on a schedule yet.</strong> There is no
          cron pass in this build, so active messages go out when somebody presses{' '}
          <em>Run now</em> below. Each invoice still receives each message only once, whenever the
          run happens.
        </span>
      </p>

      <div className="max-w-[860px] space-y-4">
        <Panel
          title="Messages"
          description={`${activeCount} of ${rules.length} switched on. Built-in messages can be edited and switched off, but not deleted.`}
        >
          <ul className="divide-y divide-line">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0">
                <button
                  type="button"
                  onClick={() => toggle(rule)}
                  role="switch"
                  aria-checked={rule.isActive}
                  aria-label={`${rule.isActive ? 'Switch off' : 'Switch on'} ${rule.label}`}
                  className={cn(
                    'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                    rule.isActive ? 'bg-ok' : 'bg-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'size-4 rounded-full bg-white transition-transform',
                      rule.isActive && 'translate-x-4',
                    )}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(rule)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-md font-semibold text-ink-900">
                      {rule.label}
                    </span>
                    {rule.isBuiltIn && <Badge tone="neutral">Built-in</Badge>}
                    <Badge tone={rule.channel === 'email' ? 'info' : 'warn'}>{rule.channel}</Badge>
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-500">
                    {timingText(rule, triggers)}
                    {rule.lastRunAt ? ` · last run ${dateTime(rule.lastRunAt)}` : ''}
                  </span>
                </button>

                {!rule.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => setDeleting(rule)}
                    aria-label={`Delete ${rule.label}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-400 transition-colors hover:border-danger hover:bg-danger-50 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Run now"
          description="A dry run reports what would be sent and sends nothing. Try that first."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => run(true)} loading={runInvoiceRules.isPending}>
              Dry run
            </Button>
            <Button onClick={() => run(false)} disabled={!activeCount || runInvoiceRules.isPending}>
              <Play className="size-4" strokeWidth={2} aria-hidden="true" />
              {activeCount ? 'Send now' : 'Nothing switched on'}
            </Button>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          {result && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-700">
                {result.dryRun ? (
                  <>
                    <Clock className="size-4 text-ink-400" strokeWidth={2} aria-hidden="true" />
                    Dry run — nothing was sent
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 text-ok" strokeWidth={2} aria-hidden="true" />
                    Run complete
                  </>
                )}
              </p>

              {/* The master switch on Email Settings refuses the whole run.
                  Distinguished from "nothing matched" because it has an obvious
                  fix and a link to where the fix lives. */}
              {result.disabled ? (
                <p className="flex items-start gap-2 rounded-md border border-warn/25 bg-warn-50 px-3 py-2.5 text-sm leading-relaxed text-ink-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
                  <span>
                    {result.reason}{' '}
                    <Link to="/admin/settings/email" className="font-semibold text-brand underline">
                      Open Email Settings
                    </Link>
                  </span>
                </p>
              ) : result.results.length === 0 ? (
                <p className="text-sm text-ink-500">No messages are switched on.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {result.results.map((row) => (
                    <li key={row.rule} className="rounded-md bg-surface-2 px-3 py-2.5">
                      <span className="font-medium text-ink-900">{row.rule}</span>
                      <span className="mt-0.5 block text-sm text-ink-600">
                        {row.matched} {row.matched === 1 ? 'invoice' : 'invoices'} matched ·{' '}
                        {result.dryRun ? 'would send' : 'sent'} {row.sent} · skipped {row.skipped}
                      </span>
                      {row.reasons.map((reason) => (
                        <span key={reason} className="mt-1 block text-xs text-warn">
                          {reason}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      </div>

      {editing && (
        <RuleDialog
          rule={editing}
          triggers={triggers}
          tokens={data?.tokens ?? []}
          channels={data?.channels}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleteInvoiceRule
            .mutateAsync(deleting.id)
            .then(() => setDeleting(null))
            .catch((e) => setError(e.message))
        }
        title="Delete this rule?"
        body={
          deleting
            ? `“${deleting.label}” stops running. To pause it without losing the setup, switch it inactive instead.`
            : ''
        }
        confirmLabel="Delete rule"
        loading={deleteInvoiceRule.isPending}
      />
    </>
  );
}

export default AdminInvoiceStatusPage;
