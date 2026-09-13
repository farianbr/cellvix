import mongoose from 'mongoose';

/**
 * One supplier's signature against one agreement template.
 *
 * **Signed once, not once per purchase order.** The earlier per-PO terms gate
 * asked a supplier to agree on every single order, which is not how a master
 * supply agreement works and taught them to click past it. This is the master
 * agreement: signed before their first proforma, held in their profile, and
 * asked for again only when we issue a new version of the document.
 *
 * **The snapshot is the record, not the link.** `templateVersion` and
 * `clauses[].title`/`body` copy the wording as it stood at signing, because a
 * signature is evidence of agreement to *specific words* - and a template that
 * could be edited underneath it would let us claim a supplier agreed to clauses
 * they never read. The `template` reference is kept for lineage; the snapshot
 * is what a dispute reads.
 *
 * **A supplier's exceptions are part of the agreement, not feedback on it.**
 * Every clause carries their note and their initials, because the paper form
 * this replaces is negotiated that way: eight clauses accepted, one qualified
 * with "MOQ is 500, not 300". Storing the note beside the clause it qualifies
 * is what makes that readable later; a single "comments" box at the end would
 * not say which clause it answered.
 */
const signedClauseSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },

    // The wording as it stood when they signed. See the note above.
    title: String,
    body: String,

    /** Their exception or qualification, if any. Free text, theirs, kept verbatim. */
    note: { type: String, trim: true, maxlength: 2000 },

    /**
     * What they typed as their initials, and when.
     *
     * Typed rather than drawn: a full signature is drawn or uploaded once at
     * the foot of the document, and asking somebody to draw nine sets of
     * initials on a phone is how a signing flow gets abandoned half-way. The
     * initials are an acknowledgement that this clause was read; the signature
     * is the execution.
     */
    initials: { type: String, trim: true, maxlength: 10 },
    initialledAt: Date,
  },
  { _id: false },
);

const SIGNATURE_KINDS = ['drawn', 'uploaded'];

const supplierAgreementSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },

    template: { type: mongoose.Schema.Types.ObjectId, ref: 'AgreementTemplate', required: true },
    templateName: String,
    templateVersion: { type: Number, default: 1 },

    /** The preamble as it stood, for the same reason the clauses are snapshotted. */
    preamble: String,
    clauses: [signedClauseSchema],

    status: {
      type: String,
      enum: ['pending', 'signed'],
      default: 'pending',
      index: true,
    },

    /**
     * The signature itself, as a data URL.
     *
     * **Stored on the record rather than in a file store**, matching the
     * decision `proformaDocument` already makes about documents: this app has
     * no file-storage path, and adding one for a single 20KB PNG would be a
     * deployment dependency bought for nothing. Capped hard by the schema so a
     * pasted 5MB photo cannot land in a document every read of the agreement
     * pulls back.
     *
     * `drawn` came from the canvas, `uploaded` from a file they chose. Recorded
     * because they are different kinds of evidence and a dispute may care.
     */
    signature: {
      kind: { type: String, enum: SIGNATURE_KINDS },
      // `data:image/png;base64,...`. Validated on write; never rendered as HTML.
      image: { type: String, maxlength: 2_000_000 },
    },

    /** Who signed, in their own words - the printed name under the pen. */
    signedName: { type: String, trim: true, maxlength: 200 },
    signedTitle: { type: String, trim: true, maxlength: 120 },
    signedCompany: { type: String, trim: true, maxlength: 200 },
    signedAt: Date,

    /**
     * Where the signature came from.
     *
     * Not security theatre - it is the one thing that distinguishes a signature
     * made by the supplier from one made by whoever had their password, and it
     * costs a request header to keep.
     */
    signedIp: String,
    signedUserAgent: String,

    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  },
  { timestamps: true },
);

// The question every gate asks: has this supplier signed anything current?
supplierAgreementSchema.index({ supplier: 1, status: 1 });

const SupplierAgreement = mongoose.model('SupplierAgreement', supplierAgreementSchema);

export { SIGNATURE_KINDS, SupplierAgreement };
export default SupplierAgreement;
