import mongoose from 'mongoose';

/**
 * The conversation between a tenant and the platform (SAAS_PLATFORM §4.5).
 *
 * **One thread per tenant, in the control plane.** Both halves of that are
 * deliberate.
 *
 * *One thread*, because a tenant raising an issue about one of its businesses
 * is still the same account talking to the same operators. Threading per
 * business would fragment a conversation that is really about the subscription,
 * and it would leave "which thread does this reply belong to" as a question
 * somebody has to answer on every message. The business a message concerns is a
 * field on the message instead, so it can be said when it matters and omitted
 * when it does not.
 *
 * *Control plane*, because the conversation is about the account: it outlives
 * any one business, must survive a business being deleted, and has to stay
 * readable while the tenant is suspended or past due — which is exactly when
 * they most need to reach us. A thread living in a business database would
 * vanish with the business and be unreachable precisely when it mattered.
 *
 * **Messages are embedded, not a second collection.** A support conversation is
 * bounded — tens of messages, not thousands — and the screen always wants the
 * whole thread. A separate collection would buy pagination nobody needs and
 * cost a join on every read. `messages` is capped in the service rather than
 * the schema, so the limit can change without a migration.
 */

const supportMessageSchema = new mongoose.Schema(
  {
    /**
     * Who wrote it.
     *
     * `tenant` is somebody inside the customer's business; `platform` is one of
     * us. Stored rather than derived from whether `superAdmin` is set, because
     * a message's side is a fact about the conversation and should not depend
     * on which id field happens to be populated.
     */
    side: { type: String, enum: ['tenant', 'platform'], required: true },

    /**
     * The author's id, in whichever collection their side implies — `User` for
     * a tenant, `SuperAdmin` for the platform.
     *
     * **No `ref`**, for the reason `AuditLog.actor` has none: it points into two
     * different collections, which Mongoose cannot express, and the denormalised
     * name below means nothing needs to resolve it.
     */
    author: { type: mongoose.Schema.Types.ObjectId, default: null },
    authorName: { type: String, default: '' },
    authorEmail: { type: String, default: '' },

    body: { type: String, required: true, trim: true, maxlength: 5000 },

    /**
     * Which of the tenant's businesses this message is about, when that is
     * meaningful. Optional on purpose — most of a support conversation is about
     * the account rather than about one shop.
     */
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
    businessName: { type: String, default: '' },

    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const supportThreadSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    // Denormalised so the console's thread list renders without populating
    // every tenant, and so a closed account's thread still reads correctly.
    tenantName: { type: String, default: '' },

    messages: [supportMessageSchema],

    /**
     * Read state, one timestamp per side.
     *
     * Two fields rather than a per-message flag: "has the other side seen this"
     * is a question about the conversation, and a timestamp answers it for
     * every message at once. Comparing against the last message's `createdAt`
     * is what produces an unread count, so nothing has to be written when a
     * message is merely displayed.
     */
    platformReadAt: { type: Date, default: null },
    tenantReadAt: { type: Date, default: null },

    /** Set from the last message, so the list can sort without touching `messages`. */
    lastMessageAt: { type: Date, default: null },

    /**
     * A resolved thread stays readable and can be reopened by anybody posting.
     *
     * Never deleted: a support history that can be cleared is not a history,
     * and the argument is the one `AuditLog` makes about its own rows.
     */
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
  },
  { timestamps: true },
);

// The console reads newest-activity-first across every tenant.
supportThreadSchema.index({ lastMessageAt: -1 });

/** Messages the given side has not seen. */
supportThreadSchema.methods.unreadFor = function unreadFor(side) {
  const seenAt = side === 'platform' ? this.platformReadAt : this.tenantReadAt;
  return this.messages.filter(
    (message) => message.side !== side && (!seenAt || message.createdAt > seenAt),
  ).length;
};

supportThreadSchema.methods.toPublic = function toPublic(side = 'platform') {
  return {
    id: this._id.toString(),
    tenant: this.tenant?.toString() ?? null,
    tenantName: this.tenantName,
    status: this.status,
    lastMessageAt: this.lastMessageAt,
    unread: this.unreadFor(side),
    messages: this.messages.map((message) => ({
      id: message._id.toString(),
      side: message.side,
      authorName: message.authorName,
      authorEmail: message.authorEmail,
      body: message.body,
      business: message.business?.toString() ?? null,
      businessName: message.businessName,
      createdAt: message.createdAt,
    })),
  };
};

const SupportThread = mongoose.model('SupportThread', supportThreadSchema);

export { SupportThread };
export default SupportThread;
