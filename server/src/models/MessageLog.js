const mongoose = require('mongoose');

/**
 * Every outbound and inbound message, on every channel (ERP rework §6.13, §8).
 *
 * **Log-first, send-later.** Three of the four channels have no provider wired
 * yet (§6b, U3–U5), and the decision that makes that honest rather than broken
 * is this collection: a message composed on an unconfigured channel is still
 * written here, with a status that says exactly what happened to it. The
 * operator gets a complete contact history from day one, and connecting Twilio
 * later is a service swap rather than a migration.
 *
 * `queued_unconfigured` exists so the history list can be truthful. Nothing in
 * this system ever reports "Sent" for a message that was not sent — §6b rule 4,
 * and the reason that status is in the enum rather than being approximated by
 * `failed` (it did not fail; nobody tried) or `logged` (that is a phone call
 * somebody made, which is a different fact).
 */

const MESSAGE_CHANNELS = ['call', 'sms', 'whatsapp', 'email'];
const MESSAGE_DIRECTIONS = ['inbound', 'outbound'];

/**
 * `logged`               a call that happened; there is nothing to send
 * `queued_unconfigured`  saved, provider not connected (§6b)
 * `sent` / `delivered`   a provider accepted / confirmed it
 * `failed`               a provider was asked and refused
 */
const MESSAGE_STATUSES = ['logged', 'queued_unconfigured', 'sent', 'delivered', 'failed'];

const messageLogSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: MESSAGE_CHANNELS, required: true, index: true },
    direction: { type: String, enum: MESSAGE_DIRECTIONS, default: 'outbound' },

    // The account this concerns. Required: a message with no counterparty is
    // not contact history, and history is the entire point of the collection.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Denormalised so the history list renders without populating, and so the
    // row still reads correctly if the account is later renamed — what was
    // written is what was true when it was sent.
    businessName: String,
    to: String,

    // Who at Cellvix did it.
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffName: String,

    subject: { type: String, trim: true, maxlength: 200 },
    body: { type: String, trim: true, maxlength: 5000 },

    status: { type: String, enum: MESSAGE_STATUSES, default: 'queued_unconfigured', index: true },

    // Set when the status is `queued_unconfigured`, so the screen can say which
    // provider is missing rather than a generic "not configured".
    unconfiguredReason: String,

    // Calls only. A URL, never a file — Cellvix has no asset store (§0).
    recordingUrl: String,

    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', index: true },

    provider: String,
    providerRef: String,
  },
  { timestamps: true },
);

// The history panel's query: one account, or one channel, newest first.
messageLogSchema.index({ channel: 1, createdAt: -1 });
messageLogSchema.index({ user: 1, createdAt: -1 });

const MessageLog = mongoose.model('MessageLog', messageLogSchema);

// --- CommonJS exports -------------------------------------------------
exports.MESSAGE_CHANNELS = MESSAGE_CHANNELS;
exports.MESSAGE_DIRECTIONS = MESSAGE_DIRECTIONS;
exports.MESSAGE_STATUSES = MESSAGE_STATUSES;
exports.MessageLog = MessageLog;
exports.default = MessageLog;
