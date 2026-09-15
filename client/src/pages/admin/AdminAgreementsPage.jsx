import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  FileSignature,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';

import cn from '@/lib/cn';
import { date } from '@/lib/format';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SignaturePad from '@/components/ui/SignaturePad';
import PageHeader from '@/components/admin/PageHeader';
import AgreementDocument from '@/components/supplier/AgreementDocument';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { toast } from '@/store/toastStore';
import { pressable } from '@/lib/motion';
import { useAdminAgreements, useAdminAgreement, useAdminMutations } from '@/hooks/useAdmin';

/**
 * Supplier agreements - the documents a supplier signs before they may trade.
 *
 * **Three views on one route**, switched by `?agreement=` and `?new=1` rather
 * than by a modal. Writing a nine-clause contract in a dialog was the wrong
 * shape: it is long-form work with a dozen fields, it wants the width, and a
 * half-written agreement should survive a misplaced click on the backdrop.
 *
 *   (list)              every agreement, with how many hold and have signed it
 *   `?new=1` / `?edit=` the authoring form, full width
 *   `?agreement=<id>`   one agreement: its clauses, and the supplier roster
 *
 * **The roster is the half that was missing.** An agreement with no list of who
 * holds it is a document nobody can chase, so each row says where that supplier
 * has got to and opens the executed copy - notes, initials and signature - as
 * the document rather than as a summary.
 */
const ADMIN_PAGE = {
  ...ADMIN_ROUTES['/admin/settings/agreements'],
  icon: adminIcon('FileSignature'),
};

const emptyClause = () => ({ title: '', body: '', requiresInitials: true });

export function AdminAgreementsPage() {
  const [params, setParams] = useSearchParams();

  const creating = params.get('new') === '1';
  const editingId = params.get('edit');
  const publishingId = params.get('publish');
  const viewingId = params.get('agreement');

  function go(next) {
    setParams(next ? new URLSearchParams(next) : new URLSearchParams(), { replace: false });
  }

  if (creating) return <AgreementForm mode="create" onDone={() => go(null)} />;
  if (editingId) return <AgreementForm mode="edit" id={editingId} onDone={() => go(null)} />;
  if (publishingId) {
    return <AgreementForm mode="publish" id={publishingId} onDone={() => go(null)} />;
  }
  if (viewingId) return <AgreementDetail id={viewingId} onBack={() => go(null)} />;

  return <AgreementList onNew={() => go({ new: '1' })} />;
}

/** Every agreement, with how many suppliers hold and have signed it. */
function AgreementList({ onNew }) {
  const { data, isLoading } = useAdminAgreements();
  const templates = data?.templates ?? [];

  if (isLoading) return <p className="text-sm text-ink-500">Loading agreements…</p>;

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
        action={
          <Button size="sm" icon={Plus} onClick={onNew}>
            New agreement
          </Button>
        }
      />

      {!templates.length ? (
        <Panel>
          <PanelEmpty
            icon={FileSignature}
            title="No agreements yet"
            body="Write the document your suppliers sign before they can quote - clauses, exceptions and all."
            action={
              <Button size="sm" icon={Plus} onClick={onNew}>
                New agreement
              </Button>
            }
          />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => {
            const outstanding = template.supplierCount - template.signedCount;
            return (
              <li key={template.id}>
                <Link
                  to={`/admin/settings/agreements?agreement=${template.id}`}
                  className={cn(
                    pressable,
                    'block rounded-lg border border-line bg-surface p-4 hover:border-line-strong',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-md font-semibold text-ink-900">
                          {template.name}
                        </span>
                        <Badge tone="neutral" size="sm">
                          v{template.version}
                        </Badge>
                        {!template.isActive && (
                          <Badge tone="neutral" size="sm">
                            superseded
                          </Badge>
                        )}
                      </p>
                      {template.description && (
                        <p className="mt-1 text-sm text-ink-500">{template.description}</p>
                      )}
                      <p className="mt-1 text-xs text-ink-400">
                        {template.clauses.length} clause
                        {template.clauses.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    {/* The two figures that matter at a glance: how many hold
                        it, and how many still owe a signature. */}
                    <div className="flex shrink-0 items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-ok">
                        <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                        {template.signedCount} signed
                      </span>
                      {outstanding > 0 && (
                        <span className="flex items-center gap-1.5 text-warn">
                          <Clock className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                          {outstanding} outstanding
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** One agreement: what it says, and who has signed it. */
function AgreementDetail({ id, onBack }) {
  const { data, isLoading } = useAdminAgreement(id);
  const [reading, setReading] = useState(null);

  if (isLoading) return <p className="text-sm text-ink-500">Loading agreement…</p>;

  const template = data?.template;
  if (!template) return <p className="text-sm text-ink-500">That agreement is not here.</p>;

  const roster = data?.roster ?? [];
  const counts = data?.counts ?? { total: 0, signed: 0, outstanding: 0 };

  // Reading one supplier's executed copy.
  if (reading) {
    return (
      <>
        <button
          type="button"
          onClick={() => setReading(null)}
          className={cn(
            pressable,
            'mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900',
          )}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {template.name}
        </button>

        <AgreementDocument
          agreement={reading.agreement}
          buyer={template.buyerSignatory}
          supplierName={reading.supplier.name}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className={cn(
          pressable,
          'mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        All agreements
      </button>

      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={template.name}
        description={template.description ?? `Version ${template.version}.`}
        badge={
          <Badge tone={template.isActive ? 'ok' : 'neutral'} size="sm">
            {template.isActive ? `v${template.version}` : 'superseded'}
          </Badge>
        }
        action={
          template.isActive && (
            <div className="flex flex-wrap gap-2">
              {/* Editing is offered only while nobody has signed. Past that the
                  server refuses it, and a button that always errors is worse
                  than no button. */}
              {counts.signed === 0 ? (
                <Link
                  to={`/admin/settings/agreements?edit=${template.id}`}
                  className={cn(
                    pressable,
                    'inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink-600 hover:border-ink-300',
                  )}
                >
                  Edit
                </Link>
              ) : (
                <Link
                  to={`/admin/settings/agreements?publish=${template.id}`}
                  className={cn(
                    pressable,
                    'inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink-600 hover:border-ink-300',
                  )}
                >
                  <Send className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                  New version
                </Link>
              )}
            </div>
          )
        }
      />

      {/* Who holds it, and where each of them has got to. */}
      <Panel
        title="Suppliers"
        description={
          counts.total
            ? `${counts.signed} of ${counts.total} signed.`
            : 'Nobody has been given this agreement yet.'
        }
        className="mb-3"
      >
        {!roster.length ? (
          <p className="text-sm text-ink-400">
            Attach it to a supplier on the{' '}
            <Link to="/admin/suppliers" className="font-semibold text-brand hover:underline">
              Suppliers
            </Link>{' '}
            screen.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {roster.map((row) => (
              <li key={row.supplier.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {row.supplier.name}
                  </span>
                  {row.supplier.email && (
                    <span className="block truncate text-xs text-ink-400">
                      {row.supplier.email}
                    </span>
                  )}
                </span>

                {row.signed ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-ok">
                    <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    Signed {date(row.signedAt)}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-warn">
                    <Clock className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    Not signed yet
                  </span>
                )}

                {row.signed && (
                  <Button size="xs" variant="outline" onClick={() => setReading(row)}>
                    View signed copy
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* The document itself, as authored. */}
      <Panel title="The document">
        {template.preamble && (
          <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">
            {template.preamble}
          </p>
        )}
        <ol className="space-y-3">
          {template.clauses.map((clause, index) => (
            <li key={clause.key} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="font-display text-sm font-semibold text-ink-900">
                {index + 1}. {clause.title}
                {!clause.requiresInitials && (
                  <span className="ml-2 text-2xs font-normal text-ink-400">no initials</span>
                )}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                {clause.body}
              </p>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}

/**
 * Write, edit or revise an agreement - **a page, not a modal**.
 *
 * A nine-clause contract is long-form work with a dozen fields. In a dialog it
 * was cramped, it fought the page's own scroll, and a misplaced click on the
 * backdrop threw away a half-written document. It also has a URL now, so an
 * unfinished agreement is something to come back to.
 */
function AgreementForm({ mode, id, onDone }) {
  const navigate = useNavigate();
  const { data, isLoading } = useAdminAgreement(mode === 'create' ? null : id);
  const { createAgreement, updateAgreement, publishAgreement } = useAdminMutations();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preamble, setPreamble] = useState('');
  const [clauses, setClauses] = useState([emptyClause()]);
  // Our own half of the execution block. A contract signed by one party is a
  // draft, so this is filled in when the agreement is written rather than left
  // as an empty rule for the supplier to countersign.
  const [buyerName, setBuyerName] = useState('');
  const [buyerTitle, setBuyerTitle] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [buyerDate, setBuyerDate] = useState('');
  const [buyerSignature, setBuyerSignature] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const source = data?.template ?? null;

  // Seeded once the template arrives. Keyed on a flag rather than an effect so
  // a half-written revision is not wiped by a background refetch.
  if (!seeded && source) {
    setSeeded(true);
    setName(source.name ?? '');
    setDescription(source.description ?? '');
    setPreamble(source.preamble ?? '');
    setClauses(source.clauses?.length ? source.clauses.map((c) => ({ ...c })) : [emptyClause()]);
    setBuyerName(source.buyerSignatory?.name ?? '');
    setBuyerTitle(source.buyerSignatory?.title ?? '');
    setBuyerCompany(source.buyerSignatory?.company ?? '');
    setBuyerDate(
      source.buyerSignatory?.signedAt
        ? new Date(source.buyerSignatory.signedAt).toISOString().slice(0, 10)
        : '',
    );
    setBuyerSignature(
      source.buyerSignatory?.signatureImage
        ? { kind: 'drawn', image: source.buyerSignatory.signatureImage }
        : null,
    );
  }

  if (mode !== 'create' && isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-64 w-full" />
      </>
    );
  }

  const pending =
    createAgreement.isPending || updateAgreement.isPending || publishAgreement.isPending;

  function setClause(index, patch) {
    setClauses((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function submit(event) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name the agreement.');
      return;
    }
    if (!clauses.some((c) => c.title.trim() && c.body.trim())) {
      setError('Write at least one clause, with a heading and a body.');
      return;
    }

    setConfirming(true);
  }

  function save() {
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      preamble: preamble.trim() || undefined,
      clauses: clauses
        .filter((c) => c.title.trim() && c.body.trim())
        .map((c) => ({
          key: c.key,
          title: c.title.trim(),
          body: c.body.trim(),
          requiresInitials: c.requiresInitials !== false,
        })),
      buyerSignatory: {
        name: buyerName.trim() || undefined,
        title: buyerTitle.trim() || undefined,
        company: buyerCompany.trim() || undefined,
        signatureImage: buyerSignature?.image || undefined,
        signedAt: buyerDate || undefined,
      },
    };

    const handlers = {
      onSuccess: (result) => {
        setConfirming(false);
        toast.ok(
          mode === 'publish'
            ? `Version ${result.template.version} published`
            : mode === 'create'
              ? 'Agreement created'
              : 'Agreement saved',
          mode === 'publish'
            ? `${result.suppliersMoved} supplier${result.suppliersMoved === 1 ? '' : 's'} will be asked to sign it.`
            : undefined,
        );
        navigate(`/admin/settings/agreements?agreement=${result.template.id}`);
      },
      onError: (err) => {
        setConfirming(false);
        setError(err.message);
      },
    };

    if (mode === 'publish') publishAgreement.mutate({ id, ...body }, handlers);
    else if (mode === 'create') createAgreement.mutate(body, handlers);
    else updateAgreement.mutate({ id, ...body }, handlers);
  }

  const heading =
    mode === 'publish'
      ? `New version of ${source?.name ?? 'agreement'}`
      : mode === 'create'
        ? 'New agreement'
        : `Edit ${source?.name ?? 'agreement'}`;

  return (
    <form onSubmit={submit}>
      <button
        type="button"
        onClick={onDone}
        className={cn(
          pressable,
          'mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        All agreements
      </button>

      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={heading}
        description="Suppliers read this, qualify each clause and sign it in their portal."
      />

      {mode === 'publish' && (
        // Said before the form, not after the save: this is the consequence a
        // staff member most needs to know and least expects.
        <p className="mb-3 flex items-start gap-2 rounded-md bg-warn-50 px-3 py-2.5 text-sm text-ink-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden="true" />
          <span>
            Publishing supersedes version {source?.version} and moves every supplier onto the new
            wording. Signatures already given stay on record, but each supplier will be asked to
            sign this version before their next quote.
          </span>
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Panel title="The agreement" className="mb-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="What the supplier sees at the top."
          />
          <Input
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            hint="Optional. Shown when picking one for a supplier."
          />
        </div>

        <Textarea
          label="Preamble"
          rows={3}
          containerClassName="mt-3"
          value={preamble}
          onChange={(event) => setPreamble(event.target.value)}
          hint="Everything above clause 1 - the parties and the framing. Optional."
        />
      </Panel>

      <Panel
        title="Clauses"
        description="Each one takes the supplier's own notes and initials."
        action={
          <Button
            type="button"
            size="xs"
            variant="outline"
            icon={Plus}
            onClick={() => setClauses((current) => [...current, emptyClause()])}
          >
            Add clause
          </Button>
        }
      >
        <ol className="space-y-3">
          {clauses.map((clause, index) => (
            <li key={clause.key ?? index} className="rounded-md border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="tnum text-xs font-medium text-ink-400">Clause {index + 1}</span>

                <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-ink-500">
                  <input
                    type="checkbox"
                    checked={clause.requiresInitials !== false}
                    onChange={(event) =>
                      setClause(index, { requiresInitials: event.target.checked })
                    }
                    className="size-3.5 cursor-pointer rounded-sm border border-line-strong accent-brand"
                  />
                  Takes initials
                </label>

                {clauses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setClauses((c) => c.filter((_, i) => i !== index))}
                    aria-label={`Remove clause ${index + 1}`}
                    className={cn(pressable, 'shrink-0 rounded-sm p-1 text-ink-400 hover:text-danger')}
                  >
                    <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>

              <Input
                label="Heading"
                value={clause.title}
                onChange={(event) => setClause(index, { title: event.target.value })}
              />
              <Textarea
                label="Clause"
                rows={5}
                containerClassName="mt-2"
                value={clause.body}
                onChange={(event) => setClause(index, { body: event.target.value })}
              />
            </li>
          ))}
        </ol>

      </Panel>

      {/**
       * Our half of the execution block.
       *
       * **A contract signed by one party is a draft.** The supplier was being
       * asked to countersign a document whose buyer block was three lines of
       * text and an empty rule, which is not something a counterparty should be
       * asked to put their name to. Signing it here means the version they open
       * is already executed on our side, and their own signature completes it.
       *
       * The same `SignaturePad` the portal uses: one signing control in the app,
       * so a drawn signature behaves identically on both sides of the contract.
       */}
      <Panel
        title="Execution and formal signatures"
        description="Your side of the agreement. Suppliers see this above their own signature block."
        className="mt-3"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Input
              label="Printed name"
              value={buyerName}
              onChange={(event) => setBuyerName(event.target.value)}
              hint="Who signs on behalf of the business."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Title"
                value={buyerTitle}
                onChange={(event) => setBuyerTitle(event.target.value)}
                placeholder="Director"
              />
              <Input
                label="Date"
                type="date"
                value={buyerDate}
                onChange={(event) => setBuyerDate(event.target.value)}
                hint="Dated when agreed, not when typed."
              />
            </div>
            <Input
              label="Company"
              value={buyerCompany}
              onChange={(event) => setBuyerCompany(event.target.value)}
              placeholder="CellVix INC"
            />
          </div>

          <div>
            <p className="mb-1.5 font-display text-sm font-semibold text-ink-900">Signature</p>
            <SignaturePad
              value={buyerSignature}
              onChange={setBuyerSignature}
              disabled={pending}
            />
            <p className="mt-1.5 text-xs text-ink-400">
              Drawn once and reused on every copy of this version. Publishing a new version is
              where it gets signed again.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button type="submit" loading={pending}>
            {mode === 'publish'
              ? 'Publish new version'
              : mode === 'create'
                ? 'Create agreement'
                : 'Save'}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </Panel>

      {/**
       * Publishing is **critical**: it moves every supplier onto new wording and
       * invalidates signatures they have already given. Creating and editing an
       * unsigned draft are ordinary (Instructions §3.0.1).
       */}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={save}
        tone={mode === 'publish' ? 'danger' : 'warn'}
        title={
          mode === 'publish'
            ? `Publish version ${(source?.version ?? 1) + 1}?`
            : mode === 'create'
              ? 'Create this agreement?'
              : 'Save these changes?'
        }
        body={`${clauses.filter((c) => c.title.trim() && c.body.trim()).length} clauses.`}
        confirmPhrase={mode === 'publish' ? source?.name : undefined}
        confirmPhraseLabel="the agreement name"
        confirmLabel={
          mode === 'publish' ? 'Publish it' : mode === 'create' ? 'Create it' : 'Save'
        }
        loading={pending}
      />
    </form>
  );
}

export default AdminAgreementsPage;
