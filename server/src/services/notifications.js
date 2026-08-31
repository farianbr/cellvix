const { default: env } = require('../config/env.js');
const { sendMail } = require('./mailer.js');
const { renderInvoiceHtml, renderInvoiceText } = require('./invoiceDocument.js');

/**
 * Transactional mail the buyer gets without asking for it.
 *
 * Called fire-and-forget from `orderService.placeOrder`: the order is already
 * written and paid by the time this runs, so nothing here is allowed to reject.
 */

/** Emails the invoice for a freshly placed order. Never throws. */
async function sendInvoiceEmail({ invoice, order, user }) {
  if (!user?.email) return { delivered: false, via: 'outbox' };

  try {
    const html = renderInvoiceHtml({ invoice, order, user, origin: env.publicOrigin });
    const text = renderInvoiceText({ invoice, order });

    return await sendMail({
      to: user.email,
      subject: `Invoice ${invoice.number} · order ${order.orderNumber}`,
      html,
      text,
    });
  } catch (error) {
    console.error(`  Mail: invoice ${invoice?.number} could not be built — ${error.message}`);
    return { delivered: false, via: 'outbox' };
  }
}

// --- CommonJS exports -------------------------------------------------
exports.sendInvoiceEmail = sendInvoiceEmail;
exports.default = sendInvoiceEmail;
