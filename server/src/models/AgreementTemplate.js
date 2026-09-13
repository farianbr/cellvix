import mongoose from 'mongoose';

/**
 * A document a supplier is asked to sign before they may trade with us.
 *
 * **Authored here, signed in the portal, and versioned by content.** The admin
 * writes the clauses on the Purchase Terms screen; a supplier is assigned one
 * when they are created and signs it once - not once per purchase order, which
 * is what the first cut of this did and what made the gate feel like a toll
 * booth rather than an agreement.
 *
 * **Clauses are rows, not a blob of prose.** The paper form this replaces gives
 * every clause its own *Supplier Notes / Exceptions* box and its own initials,
 * which is the whole shape of how these get negotiated: a supplier agrees to
 * eight clauses and writes "MOQ is 500 not 300" against the ninth. A single
 * rich-text body could not hold that, and would have turned a negotiable
 * document into a take-it-or-leave-it one.
 *
 * **A template is never edited in place once signed against.** `version` counts
 * up and the old row stays, because a signature points at the words that were on
 * the screen when it was made - editing those afterwards would retroactively put
 * clauses into an agreement somebody already signed. `supersededBy` links
 * forward so the admin screen can show the chain.
 */
const clauseSchema = new mongoose.Schema(
  {
    /**
     * Stable across versions, so a supplier's note against clause 3 can still
     * be found after clause 2 is deleted and everything renumbers. The display
     * number is the array index; this is the identity.
     */
    key: { type: String, required: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },

    // Rendered through `lib/richText.jsx` in the portal, like every other
    // admin-authored block. No `dangerouslySetInnerHTML`, anywhere.
    body: { type: String, required: true, trim: true, maxlength: 10_000 },

    /**
     * Whether this clause takes initials of its own.
     *
     * True for every clause on the Cellvix agreement, but a preamble or a
     * definitions section is a clause somebody reads rather than one they
     * initial, and forcing initials on it would teach a supplier to click
     * through the ones that matter.
     */
    requiresInitials: { type: Boolean, default: true },
  },
  { _id: false },
);

const agreementTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },

    /**
     * What this document is for, in the admin's own words. Shown when picking
     * one on the supplier form, where "which of these three do I attach" is
     * the only question being asked.
     */
    description: { type: String, trim: true, maxlength: 500 },

    /** Everything above clause 1 - parties, effective date, the framing. */
    preamble: { type: String, trim: true, maxlength: 5_000 },

    clauses: [clauseSchema],

    /**
     * What the signature block says above the pen, for each side.
     *
     * The buyer's half is fixed text - a name and a title that do not change
     * per supplier - and is stored rather than hard-coded so a director's name
     * is not a deploy away from being corrected.
     */
    buyerSignatory: {
      name: { type: String, trim: true, maxlength: 200 },
      title: { type: String, trim: true, maxlength: 120 },
      company: { type: String, trim: true, maxlength: 200 },

      /**
       * Our own signature, executed once when the agreement is written.
       *
       * **A contract signed by one party is a draft.** The supplier was being
       * asked to sign a document whose buyer block was three lines of text and
       * an empty rule, which is not something a counterparty should be asked to
       * countersign. Drawing it here means the version they read is already
       * executed on our side.
       *
       * Same shape and the same validation as a supplier's: a data URL, checked
       * against an image allowlist and a size cap in `agreementService`, never
       * rendered as HTML.
       */
      signatureImage: { type: String, maxlength: 2_000_000 },

      /**
       * The date on our half of the execution block.
       *
       * Stored rather than derived from `createdAt`: a document is often dated
       * the day it was agreed rather than the day somebody typed it up, and a
       * date that silently disagrees with the paper copy is worse than a blank.
       */
      signedAt: Date,
    },

    version: { type: Number, default: 1, min: 1 },

    /**
     * Whether this template may be assigned to a supplier.
     *
     * A superseded version is `false` but is never deleted: signatures point at
     * it, and a document nobody can read is a signature nobody can verify.
     */
    isActive: { type: Boolean, default: true, index: true },

    /** The version that replaced this one, if any. */
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AgreementTemplate' },
    supersededAt: Date,

    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

agreementTemplateSchema.index({ business: 1, isActive: 1, name: 1 });

const AgreementTemplate = mongoose.model('AgreementTemplate', agreementTemplateSchema);

export { AgreementTemplate };
export default AgreementTemplate;
