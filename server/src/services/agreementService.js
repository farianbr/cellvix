import { db } from '../db/models.js';
import '../models/AgreementTemplate.js';
import '../models/SupplierAgreement.js';
import '../models/Supplier.js';
import ApiError from '../utils/ApiError.js';

/**
 * Supplier agreements - authored in admin, signed in the portal.
 *
 * **Signed once, before their first proforma.** The gate this replaces asked a
 * supplier to accept terms on every purchase order, which is not how a master
 * supply agreement works: it is one document covering the relationship, and
 * asking again on each order taught suppliers to click past it. Here they sign
 * once, it sits in their profile, and they are asked again only when we publish
 * a new version.
 *
 * Three rules:
 *
 * **1. Signing snapshots the wording.** A signature is evidence of agreement to
 * *specific words*, so `SupplierAgreement` copies every clause as it stood
 * rather than pointing at a template that can be edited underneath it.
 *
 * **2. A template with signatures against it is never edited in place.**
 * `publishRevision` creates the next version and supersedes the old one, which
 * stays readable because the signatures point at it.
 *
 * **3. The gate is enforced on the write, not on the page.** `assertSigned` is
 * called by the quoting and proforma paths - the same posture as the price gate
 * and the old terms check: a supplier who never loaded the portal must not be
 * able to POST past a wall they never saw.
 */

/** How big a signature image may be, decoded. Roughly 1.4MB of base64. */
const MAX_SIGNATURE_BYTES = 1_000_000;

/** The image types a signature may be. Anything else is refused outright. */
const SIGNATURE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// ---- templates --------------------------------------------------------------

function shapeTemplate(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? null,
    preamble: doc.preamble ?? '',
    clauses: (doc.clauses ?? []).map((clause) => ({
      key: clause.key,
      title: clause.title,
      body: clause.body,
      requiresInitials: clause.requiresInitials !== false,
    })),
    buyerSignatory: {
      name: doc.buyerSignatory?.name ?? '',
      title: doc.buyerSignatory?.title ?? '',
      company: doc.buyerSignatory?.company ?? '',
      // Our own executed signature, so the supplier reads a document that is
      // already signed on our side rather than a draft.
      signatureImage: doc.buyerSignatory?.signatureImage ?? null,
      signedAt: doc.buyerSignatory?.signedAt ?? null,
    },
    version: doc.version ?? 1,
    isActive: doc.isActive !== false,
    supersededBy: doc.supersededBy?.toString() ?? null,
    supersededAt: doc.supersededAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function listTemplates({ includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  const templates = await db().AgreementTemplate.find(query).sort({ name: 1, version: -1 }).lean();

  // How many suppliers each one is attached to, so the admin screen can say
  // what deleting or revising a template would affect rather than leaving it to
  // be discovered afterwards.
  const counts = await db().Supplier.aggregate([
    { $match: { agreementTemplates: { $exists: true, $ne: [] } } },
    { $unwind: '$agreementTemplates' },
    { $group: { _id: '$agreementTemplates', count: { $sum: 1 } } },
  ]);
  const byTemplate = new Map(counts.map((row) => [String(row._id), row.count]));

  const signed = await db().SupplierAgreement.aggregate([
    { $match: { status: 'signed' } },
    { $group: { _id: '$template', count: { $sum: 1 } } },
  ]);
  const signedBy = new Map(signed.map((row) => [String(row._id), row.count]));

  return {
    templates: templates.map((doc) => ({
      ...shapeTemplate(doc),
      supplierCount: byTemplate.get(doc._id.toString()) ?? 0,
      signedCount: signedBy.get(doc._id.toString()) ?? 0,
    })),
  };
}

/**
 * One template, with **who holds it and who has signed it**.
 *
 * The roster is the half of this screen that was missing: an agreement with no
 * list of suppliers is a document a staff member cannot chase. Each row says where
 * that supplier has got to, and carries the signed record so the admin can read
 * the executed document - the notes and initials included - without a second
 * request per supplier.
 */
async function getTemplate(id) {
  const doc = await db().AgreementTemplate.findById(id).lean();
  if (!doc) throw ApiError.notFound('Agreement not found.', 'AGREEMENT_NOT_FOUND');

  const [suppliers, signatures] = await Promise.all([
    db()
      .Supplier.find({ agreementTemplates: doc._id })
      .select('name code email isActive')
      .sort({ name: 1 })
      .lean(),
    db().SupplierAgreement.find({ template: doc._id }).lean(),
  ]);

  const bySupplier = new Map(signatures.map((row) => [String(row.supplier), row]));

  const roster = suppliers.map((supplier) => {
    const signature = bySupplier.get(String(supplier._id));
    return {
      supplier: {
        id: supplier._id.toString(),
        name: supplier.name,
        code: supplier.code ?? null,
        email: supplier.email ?? null,
        isActive: supplier.isActive !== false,
      },
      signed: signature?.status === 'signed',
      signedAt: signature?.signedAt ?? null,
      agreement: signature
        ? { ...shapeAgreement(signature), signatureImage: signature.signature?.image ?? null }
        : null,
    };
  });

  return {
    template: shapeTemplate(doc),
    roster,
    counts: {
      total: roster.length,
      signed: roster.filter((row) => row.signed).length,
      outstanding: roster.filter((row) => !row.signed).length,
    },
  };
}

/**
 * Clause keys, assigned once and kept.
 *
 * Stable identity is what lets a supplier's note against clause 3 still be
 * found after clause 2 is deleted and the numbering shifts. A client may send a
 * key it already knows; a new clause gets one here rather than being trusted to
 * invent a unique one.
 */
function withKeys(clauses = []) {
  const used = new Set();
  return clauses.map((clause, index) => {
    let key = String(clause.key ?? '').trim();
    if (!key || used.has(key)) key = `c${index + 1}-${Math.random().toString(36).slice(2, 8)}`;
    used.add(key);
    return {
      key,
      title: clause.title,
      body: clause.body,
      requiresInitials: clause.requiresInitials !== false,
    };
  });
}

/**
 * Our half of the execution block, validated.
 *
 * The signature is checked the same way a supplier's is - an image allowlist
 * and a size cap - because it is stored and later rendered in an `<img>`, and
 * a `data:text/html` URL reaching a page would be a script this app went to
 * some trouble never to have.
 */
function buyerSignatoryFrom(input = {}) {
  if (input.signatureImage) assertSignatureImage(input.signatureImage);
  return {
    name: input.name,
    title: input.title,
    company: input.company,
    signatureImage: input.signatureImage || undefined,
    signedAt: input.signedAt ? new Date(input.signedAt) : undefined,
  };
}

async function createTemplate(body, createdBy) {
  const doc = await db().AgreementTemplate.create({
    name: body.name,
    description: body.description,
    preamble: body.preamble,
    clauses: withKeys(body.clauses),
    buyerSignatory: buyerSignatoryFrom(body.buyerSignatory),
    version: 1,
    isActive: true,
    createdBy,
  });

  return { template: shapeTemplate(doc.toObject()) };
}

/**
 * Edit a template that nobody has signed yet.
 *
 * **Refused once a signature exists**, because editing the words a signature
 * points at is how an agreement stops being evidence of anything. Past that
 * point the only honest change is a new version - `publishRevision` - which is
 * what the error says.
 */
async function updateTemplate(id, body) {
  const signed = await db().SupplierAgreement.countDocuments({ template: id, status: 'signed' });
  if (signed > 0) {
    throw ApiError.badRequest(
      `${signed} supplier${signed === 1 ? ' has' : 's have'} already signed this agreement. Publish a new version instead - the signed wording has to stay as it was.`,
      'AGREEMENT_ALREADY_SIGNED',
    );
  }

  const doc = await db().AgreementTemplate.findByIdAndUpdate(
    id,
    {
      $set: {
        name: body.name,
        description: body.description,
        preamble: body.preamble,
        clauses: withKeys(body.clauses),
        buyerSignatory: buyerSignatoryFrom(body.buyerSignatory),
      },
    },
    { new: true },
  ).lean();

  if (!doc) throw ApiError.notFound('Agreement not found.', 'AGREEMENT_NOT_FOUND');
  return { template: shapeTemplate(doc) };
}

/**
 * Publish the next version of a template.
 *
 * The old row stays and is marked superseded, because signatures point at it.
 * Every supplier carrying the old one is moved to the new one, which is what
 * makes their existing signature go stale - `pendingFor` will then ask them to
 * sign the new wording on their next visit.
 */
async function publishRevision(id, body, createdBy) {
  const current = await db().AgreementTemplate.findById(id).lean();
  if (!current) throw ApiError.notFound('Agreement not found.', 'AGREEMENT_NOT_FOUND');

  const next = await db().AgreementTemplate.create({
    name: body.name ?? current.name,
    description: body.description ?? current.description,
    preamble: body.preamble ?? current.preamble,
    clauses: withKeys(body.clauses ?? current.clauses),
    buyerSignatory: body.buyerSignatory
      ? buyerSignatoryFrom(body.buyerSignatory)
      : current.buyerSignatory,
    version: (current.version ?? 1) + 1,
    isActive: true,
    createdBy,
  });

  await db().AgreementTemplate.updateOne(
    { _id: id },
    { $set: { isActive: false, supersededBy: next._id, supersededAt: new Date() } },
  );

  // Everybody on the old version follows to the new one. Their signature is not
  // deleted - it stays as the record of what they agreed to - but it no longer
  // satisfies the gate, because it is against superseded wording.
  // Swapped inside the array rather than assigned over it: a supplier may
  // carry three agreements, and only the one being revised moves.
  const moved = await db().Supplier.updateMany(
    { agreementTemplates: id },
    { $set: { [`agreementTemplates.$`]: next._id } },
  );

  return {
    template: shapeTemplate(next.toObject()),
    suppliersMoved: moved.modifiedCount ?? 0,
  };
}

// ---- the supplier's side ----------------------------------------------------

function shapeAgreement(doc) {
  return {
    id: doc._id.toString(),
    supplier: doc.supplier?.toString?.() ?? String(doc.supplier ?? ''),
    template: doc.template?.toString?.() ?? String(doc.template ?? ''),
    templateName: doc.templateName ?? null,
    templateVersion: doc.templateVersion ?? 1,
    preamble: doc.preamble ?? '',
    clauses: (doc.clauses ?? []).map((clause) => ({
      key: clause.key,
      title: clause.title,
      body: clause.body,
      note: clause.note ?? null,
      initials: clause.initials ?? null,
      initialledAt: clause.initialledAt ?? null,
    })),
    status: doc.status,
    // The image is deliberately NOT in the list shape - see `getAgreement`.
    hasSignature: Boolean(doc.signature?.image),
    signatureKind: doc.signature?.kind ?? null,
    signedName: doc.signedName ?? null,
    signedTitle: doc.signedTitle ?? null,
    signedCompany: doc.signedCompany ?? null,
    signedAt: doc.signedAt ?? null,
    createdAt: doc.createdAt,
  };
}

/**
 * Everything this supplier still has to sign.
 *
 * Returns an **array**, empty when they are clear. A supplier may carry several
 * agreements - a master supply agreement, an NDA, a quality annex - and each is
 * signed separately, so "what do you still owe us" cannot be answered with one
 * document.
 *
 * **Compared on the template id, not a date.** A supplier who signed version 1
 * and was moved to version 2 has a signature, and a check for "have they ever
 * signed" would wave them through wording they have not read.
 */
async function pendingFor(supplierId) {
  const supplier = await db().Supplier.findById(supplierId).select('name agreementTemplates').lean();
  const required = supplier?.agreementTemplates ?? [];
  if (!required.length) return [];

  const signed = await db()
    .SupplierAgreement.find({
      supplier: supplierId,
      template: { $in: required },
      status: 'signed',
    })
    .select('template')
    .lean();
  const have = new Set(signed.map((row) => String(row.template)));

  const outstanding = required.filter((id) => !have.has(String(id)));
  if (!outstanding.length) return [];

  const templates = await db()
    .AgreementTemplate.find({ _id: { $in: outstanding } })
    .lean();

  return templates.map((template) => ({ template: shapeTemplate(template) }));
}

/**
 * The gate, enforced on every write a supplier makes that commits them.
 *
 * **Quoting and proformas, not reading.** A supplier may look at what they have
 * been invited to price - they cannot judge whether the agreement is worth
 * signing otherwise - but a price is a commercial commitment and a proforma is
 * the document that formalises it, so both sit behind the signature.
 *
 * Called from the service rather than trusted to the page, for the reason every
 * gate in this codebase is: these endpoints take an order id straight from the
 * request, and a caller who never opened the portal could otherwise commit to
 * prices under an agreement they never signed.
 */
async function assertSigned(supplierId) {
  const pending = await pendingFor(supplierId);
  if (!pending.length) return;

  // Named, all of them: "you have outstanding agreements" sends a supplier
  // hunting, and a list of two is no harder to read than a list of one.
  const names = pending.map((row) => row.template.name).join(', ');
  throw ApiError.badRequest(
    `Sign ${names} before sending a price or a proforma invoice.`,
    'AGREEMENT_NOT_SIGNED',
  );
}

/**
 * Every agreement this supplier carries, signed or outstanding.
 *
 * One list rather than a signed/pending split, because the portal and the admin
 * profile both want the same thing: the roster, with each row's state on it. A
 * caller that needs only the outstanding ones filters on `status`.
 *
 * Signature images ride along here - this is the screen that renders them, and
 * a second round trip per agreement to fetch one 20KB PNG is worse than the
 * payload.
 */
async function getAgreement(supplierId) {
  const supplier = await db().Supplier.findById(supplierId).select('agreementTemplates').lean();
  const required = supplier?.agreementTemplates ?? [];

  const [templates, signatures] = await Promise.all([
    required.length
      ? db().AgreementTemplate.find({ _id: { $in: required } }).lean()
      : [],
    db().SupplierAgreement.find({ supplier: supplierId }).sort({ signedAt: -1 }).lean(),
  ]);

  const byTemplate = new Map(signatures.map((row) => [String(row.template), row]));

  const agreements = templates.map((template) => {
    const signature = byTemplate.get(String(template._id));
    return {
      template: shapeTemplate(template),
      // Their own name, so the document's party block reads as the contract it
      // is rather than as a form with a blank in it.
      supplierName: supplier?.name ?? null,
      agreement: signature
        ? { ...shapeAgreement(signature), signatureImage: signature.signature?.image ?? null }
        : null,
      signed: signature?.status === 'signed',
    };
  });

  return {
    agreements,
    // Still returned for the gate's own use and for the dashboard warning.
    pending: agreements.filter((row) => !row.signed).map((row) => ({ template: row.template })),
    // Signatures against templates this supplier no longer carries - the history
    // a dispute reads, which must not disappear because somebody detached a
    // document from them afterwards.
    history: signatures
      .filter((row) => row.status === 'signed' && !required.some((id) => String(id) === String(row.template)))
      .map(shapeAgreement),
  };
}

/**
 * A data URL that is actually an image, and is actually small enough.
 *
 * **Validated rather than trusted**, because this string is stored and later
 * rendered in an `<img>`: a `data:text/html` URL that reached a page would be a
 * script this app went to some trouble never to have. The prefix is checked
 * against an allowlist of image types, and the decoded size against a cap, so a
 * pasted photograph cannot become a megabyte on every read of the agreement.
 */
function assertSignatureImage(image) {
  const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(image ?? ''));
  if (!match) {
    throw ApiError.badRequest('That signature could not be read.', 'SIGNATURE_INVALID');
  }

  const [, type, payload] = match;
  if (!SIGNATURE_TYPES.has(type)) {
    throw ApiError.badRequest(
      'A signature must be a PNG, JPEG or WebP image.',
      'SIGNATURE_TYPE',
    );
  }

  // base64 carries 3 bytes per 4 characters.
  const bytes = Math.floor((payload.length * 3) / 4);
  if (bytes > MAX_SIGNATURE_BYTES) {
    throw ApiError.badRequest(
      'That signature image is too large - keep it under 1MB.',
      'SIGNATURE_TOO_LARGE',
    );
  }
}

/**
 * A supplier signs their agreement.
 *
 * Everything the supplier sends is theirs to send - their initials, their
 * exceptions, their signature, their printed name. What is **not** taken from
 * them is the wording: the clauses are copied from the template server-side, so
 * a client cannot sign a document it rewrote on the way past.
 *
 * Initials are required on every clause that asks for them, because the paper
 * form requires them and a half-initialled agreement is one nobody can rely on.
 */
async function sign(supplierId, body, { ip, userAgent } = {}) {
  const supplier = await db().Supplier.findById(supplierId).select('name agreementTemplates').lean();
  const required = supplier?.agreementTemplates ?? [];
  if (!required.length) {
    throw ApiError.badRequest('There is no agreement to sign.', 'AGREEMENT_NOT_ASSIGNED');
  }

  /**
   * Which one they are signing.
   *
   * Required once a supplier can carry several: signing "their agreement" was
   * unambiguous with one document and is a guess with three. The id is checked
   * against what they actually carry, so a supplier cannot sign a document that
   * was never put to them.
   */
  const wanted = String(body.template ?? '');
  if (!required.some((id) => String(id) === wanted)) {
    throw ApiError.badRequest(
      'That agreement was not sent to you.',
      'AGREEMENT_NOT_ASSIGNED',
    );
  }

  const template = await db().AgreementTemplate.findById(wanted).lean();
  if (!template) throw ApiError.notFound('Agreement not found.', 'AGREEMENT_NOT_FOUND');

  const existing = await db().SupplierAgreement.findOne({
    supplier: supplierId,
    template: template._id,
    status: 'signed',
  }).lean();
  if (existing) {
    throw ApiError.badRequest('You have already signed this agreement.', 'AGREEMENT_SIGNED');
  }

  assertSignatureImage(body.signature?.image);

  const sent = new Map((body.clauses ?? []).map((clause) => [clause.key, clause]));
  const now = new Date();

  const clauses = (template.clauses ?? []).map((clause) => {
    const answer = sent.get(clause.key);
    const initials = String(answer?.initials ?? '').trim();

    if (clause.requiresInitials !== false && !initials) {
      throw ApiError.badRequest(
        `Initial every clause - "${clause.title}" is not initialled.`,
        'CLAUSE_NOT_INITIALLED',
      );
    }

    return {
      key: clause.key,
      // From the template, never from the request: see the note above.
      title: clause.title,
      body: clause.body,
      note: answer?.note,
      initials: initials || undefined,
      initialledAt: initials ? now : undefined,
    };
  });

  const doc = await db().SupplierAgreement.findOneAndUpdate(
    { supplier: supplierId, template: template._id },
    {
      $set: {
        supplier: supplierId,
        template: template._id,
        templateName: template.name,
        templateVersion: template.version ?? 1,
        preamble: template.preamble,
        clauses,
        status: 'signed',
        signature: { kind: body.signature.kind, image: body.signature.image },
        signedName: body.signedName,
        signedTitle: body.signedTitle,
        signedCompany: body.signedCompany ?? supplier.name,
        signedAt: now,
        signedIp: ip,
        signedUserAgent: userAgent,
      },
    },
    { new: true, upsert: true },
  ).lean();

  return { agreement: shapeAgreement(doc) };
}

export {
  assertSigned,
  createTemplate,
  getAgreement,
  getTemplate,
  listTemplates,
  pendingFor,
  publishRevision,
  shapeTemplate,
  sign,
  updateTemplate,
};
