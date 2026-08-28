import mongoose from 'mongoose';
import { MESSAGE_CHANNELS } from './MessageLog.js';

/**
 * Reusable message bodies (ERP rework §6.13, §8, §6.15).
 *
 * Not on the §6b register, deliberately: templates are **fully functional on
 * email from day one**, because email works in this codebase. A template picked
 * on the SMS screen fills the textarea perfectly well — it is the *sending*
 * that waits on Twilio, not the text. So this is a real feature with one
 * channel's delivery pending, rather than a UI-only surface.
 *
 * `document` optionally ties a template to a record type, which is what lets
 * the quote and invoice screens offer "the ones that make sense here" instead
 * of the whole list.
 */

export const TEMPLATE_DOCUMENTS = ['none', 'order', 'invoice', 'quote', 'rma'];

/**
 * Placeholders a body may contain. Substitution is literal and total — an
 * unknown token is left as written rather than replaced with an empty string,
 * so a typo shows up in the preview as `{{bussiness}}` instead of silently
 * sending a sentence with a hole in it.
 */
export const TEMPLATE_TOKENS = [
  { token: '{{businessName}}', label: 'Business name' },
  { token: '{{contactName}}', label: 'Contact name' },
  { token: '{{email}}', label: 'Email address' },
  { token: '{{companyName}}', label: 'Cellvix' },
];

const messageTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    channel: { type: String, enum: MESSAGE_CHANNELS, required: true, index: true },
    document: { type: String, enum: TEMPLATE_DOCUMENTS, default: 'none' },

    // Email only; ignored on the other channels rather than being conditionally
    // required, because a template that changes channel should not lose text.
    subject: { type: String, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

messageTemplateSchema.index({ channel: 1, isActive: 1 });

/**
 * Fills a body against one account. Unknown tokens survive untouched — see the
 * note on TEMPLATE_TOKENS.
 */
messageTemplateSchema.statics.render = function render(body, user) {
  const values = {
    '{{businessName}}': user?.businessName ?? '',
    '{{contactName}}': user?.contactName ?? '',
    '{{email}}': user?.email ?? '',
    '{{companyName}}': 'Cellvix',
  };

  return String(body ?? '').replace(
    /\{\{\s*\w+\s*\}\}/g,
    (match) => values[match.replace(/\s/g, '')] ?? match,
  );
};

export const MessageTemplate = mongoose.model('MessageTemplate', messageTemplateSchema);
export default MessageTemplate;
