import mongoose from 'mongoose';

/**
 * A bulk email campaign (ERP rework §6.13, §8).
 *
 * Email is the one marketing channel that is **fully wired** — this codebase
 * already sends mail (`services/mailer.js`), so there is no provider to wait
 * for and no reason to stub it. The other three channels log; this one sends.
 *
 * **The audience is stored as a filter, not as a list of recipients.** Two
 * reasons: a list captured at compose time is stale by the time it is sent, and
 * more importantly consent has to be checked at *send* time. A business that
 * unsubscribes after a campaign is drafted must not receive it, and the only
 * way to guarantee that is to resolve the audience when the send runs.
 *
 * `stats` counts what actually happened. `sent` is incremented per accepted
 * message, never set to the audience size up front — CASL compliance is not a
 * good look on a number we assumed.
 */

const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed'];

/**
 * Who a campaign goes to, before consent is applied.
 *
 * Consent and unsubscribe are NOT audience options — they are applied on top of
 * whatever this selects, always, and cannot be turned off from the UI. See
 * `marketingService.resolveAudience`.
 */
const CAMPAIGN_AUDIENCES = ['approved', 'pending', 'all_customers', 'with_orders'];

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 20000 },

    audience: {
      filter: { type: String, enum: CAMPAIGN_AUDIENCES, default: 'approved' },
      // A snapshot of the eligible count when the campaign was last saved, so
      // the list can show "≈ 42 recipients" without recounting on every render.
      // Recomputed at send; this is a display figure, never the send list.
      count: { type: Number, default: 0 },
    },

    status: { type: String, enum: CAMPAIGN_STATUSES, default: 'draft', index: true },
    scheduledAt: Date,
    sentAt: Date,

    stats: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      // Open and click tracking needs a tracking pixel and rewritten links,
      // neither of which exists. These stay zero and the screen says so rather
      // than showing an invented engagement rate.
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      unsubscribed: { type: Number, default: 0 },
      // Saved but not sent, because the channel has no provider connected —
      // SMS and WhatsApp (§6b). Its own field rather than being folded into
      // `sent`, because a campaign that reads "sent 0" with no further
      // explanation looks like a failure when it is a configuration state. The
      // list column shows this beside the sent count so the row explains
      // itself without anyone having to reopen the send dialog.
      queued: { type: Number, default: 0 },
      // Recipients the audience matched but consent excluded. Shown on the
      // detail so a small send against a large audience is explained rather
      // than looking like a bug.
      skipped: { type: Number, default: 0 },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

campaignSchema.index({ createdAt: -1 });

const Campaign = mongoose.model('Campaign', campaignSchema);

export { CAMPAIGN_STATUSES, CAMPAIGN_AUDIENCES, Campaign };
export default Campaign;
