import { FileSignature } from 'lucide-react';
import { date } from '@/lib/format';
import RichText from '@/lib/richText.jsx';

/**
 * A signed agreement, rendered as the executed document.
 *
 * **Laid out like the paper form it replaces**, because that is what a person
 * reaching for it expects to see: parties at the top, numbered clauses with the
 * supplier's own notes and initials against each, and both signature blocks at
 * the foot. A summary table of the same facts would be easier to build and
 * useless in the one situation this screen exists for, which is somebody
 * checking what was actually agreed.
 *
 * **Shared by the portal and the admin panel.** The supplier reads their copy
 * and the buyer reads the same thing; two components rendering one contract is
 * how the two sides end up looking at subtly different documents.
 *
 * Clause bodies go through `lib/richText.jsx` like every other admin-authored
 * block. No `dangerouslySetInnerHTML`, anywhere.
 */
export function AgreementDocument({ agreement, buyer, supplierName }) {
  if (!agreement) return null;

  return (
    <article className="rounded-lg border border-line bg-surface">
      <header className="border-b border-line px-5 py-4 text-center">
        <h2 className="font-display text-md font-bold uppercase tracking-wide text-ink-900">
          {agreement.templateName}
        </h2>
        <p className="mt-1 text-2xs text-ink-400">
          Version {agreement.templateVersion}
          {agreement.signedAt && <> · executed {date(agreement.signedAt)}</>}
        </p>
      </header>

      {/* The parties, as the form heads them. */}
      <dl className="grid gap-3 border-b border-line px-5 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-2xs uppercase tracking-wide text-ink-400">Buyer</dt>
          <dd className="mt-0.5 text-ink-900">{buyer?.company || 'CellVix INC'}</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-wide text-ink-400">Supplier</dt>
          <dd className="mt-0.5 text-ink-900">
            {agreement.signedCompany || supplierName || '–'}
          </dd>
        </div>
      </dl>

      {agreement.preamble && (
        <div className="border-b border-line px-5 py-4 text-sm leading-relaxed text-ink-700">
          <RichText tone="document">{agreement.preamble}</RichText>
        </div>
      )}

      <ol className="divide-y divide-line">
        {agreement.clauses.map((clause, index) => (
          <li key={clause.key} className="px-5 py-4">
            <h3 className="font-display text-sm font-semibold text-ink-900">
              {index + 1}. {clause.title}
            </h3>

            <div className="mt-1.5 text-sm leading-relaxed text-ink-700">
              <RichText tone="document">{clause.body}</RichText>
            </div>

            {/* The supplier's exception, in the place the paper form puts it.
                An exception is part of the agreement, not a comment on it, so
                it sits with the clause it qualifies rather than in a footnote
                somebody has to cross-reference. */}
            <div className="mt-3 rounded-md bg-surface-2 px-3 py-2.5">
              <p className="text-2xs uppercase tracking-wide text-ink-400">
                Supplier notes / exceptions
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">
                {clause.note || <span className="text-ink-300">None recorded.</span>}
              </p>

              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-500">
                <span>
                  Initials:{' '}
                  <span className="font-mono font-semibold text-ink-900">
                    {clause.initials || '–'}
                  </span>
                </span>
                <span>
                  Date:{' '}
                  <span className="text-ink-900">
                    {clause.initialledAt ? date(clause.initialledAt) : '–'}
                  </span>
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Execution, both sides, as the form closes. */}
      <footer className="grid gap-5 border-t border-line px-5 py-5 sm:grid-cols-2">
        <div>
          <p className="text-2xs uppercase tracking-wide text-ink-400">Buyer</p>
          {/* Our own signature, executed when the agreement was written. An
              empty rule here made the buyer look like the party who had not
              signed, which is the opposite of the truth. */}
          <div className="mt-2 flex h-16 items-end border-b border-line-strong">
            {buyer?.signatureImage ? (
              <img
                src={buyer.signatureImage}
                alt={`Signature of ${buyer.name}`}
                className="max-h-15 w-auto"
              />
            ) : (
              <span className="pb-1 text-2xs text-ink-300">Signed on file</span>
            )}
          </div>
          <dl className="mt-2 space-y-0.5 text-xs">
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Name</dt>
              <dd className="text-ink-900">{buyer?.name || '–'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Title</dt>
              <dd className="text-ink-900">{buyer?.title || '–'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Company</dt>
              <dd className="text-ink-900">{buyer?.company || '–'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Date</dt>
              <dd className="text-ink-900">
                {buyer?.signedAt ? date(buyer.signedAt) : '–'}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-2xs uppercase tracking-wide text-ink-400">Supplier</p>
          {/* The signature itself, on the rule where a pen would have gone. */}
          <div className="mt-2 flex h-16 items-end border-b border-line-strong">
            {agreement.signatureImage ? (
              <img
                src={agreement.signatureImage}
                alt={`Signature of ${agreement.signedName}`}
                className="max-h-15 w-auto"
              />
            ) : (
              <span className="pb-1 text-2xs text-ink-300">
                <FileSignature className="mr-1 inline size-3" aria-hidden="true" />
                signed electronically
              </span>
            )}
          </div>
          <dl className="mt-2 space-y-0.5 text-xs">
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Name</dt>
              <dd className="text-ink-900">{agreement.signedName || '–'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Title</dt>
              <dd className="text-ink-900">{agreement.signedTitle || '–'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Company</dt>
              <dd className="text-ink-900">{agreement.signedCompany || '–'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Date</dt>
              <dd className="text-ink-900">
                {agreement.signedAt ? date(agreement.signedAt) : '–'}
              </dd>
            </div>
          </dl>
        </div>
      </footer>
    </article>
  );
}

export default AgreementDocument;
