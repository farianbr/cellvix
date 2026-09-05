import env from '../config/env.js';
import { sendMail } from './mailer.js';
import { MAIL, escapeHtml } from './welcomeMail.js';
import { BUSINESS_INFO } from '../../../shared/business.js';

/**
 * Mail to suppliers — the portal invitation, and a request for quote
 * (supplier process flow, §6.8a).
 *
 * Same contract as `welcomeMail.js` and for the same reason: **never throws**.
 * Every message here is a side effect of something already written to the
 * database — a supplier that exists, an RFQ that has been sent — and a dead
 * SMTP host must not turn any of those into an error. Callers read `delivered`.
 *
 * Sent from `MAIL_FROM_ADMIN`, not `MAIL_FROM`. A supplier replying to their
 * portal credentials should reach whoever handles accounts, not the billing
 * desk.
 *
 * The palette, the shell and the escaping come from `welcomeMail.js` rather
 * than being redefined here, so supplier mail and customer mail stay one
 * design. What differs is only what these messages have to say.
 */

/** The card shell every message below fills. Kept in one place, as in the buyer mail. */
function shell({ preheader, title, intro, blocks, footerNote }) {
  const { display, body, ink900, ink500, ink300, line, surface2 } = MAIL;

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${surface2};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${surface2};">
    <tr><td align="center" style="padding:32px 16px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${line};border-radius:${MAIL.radiusCard};overflow:hidden;">

        <!-- The compact brand ramp as a hairline, matching the buyer mail. The
             full ramp spends its first third near black, which across 3px reads
             as a dark stub rather than as depth. -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${MAIL.brand};">
          <div style="height:3px;background:linear-gradient(90deg,#8f221b 0%,#cf3429 55%,#e8564a 100%);">&nbsp;</div>
        </td></tr>

        <tr><td style="padding:36px 36px 8px;">
          <div style="font:700 ${MAIL.micro}/1 ${display};letter-spacing:0.14em;text-transform:uppercase;color:${ink300};">
            ${escapeHtml(BUSINESS_INFO.name)}
          </div>
          <h1 style="margin:14px 0 0;font:700 ${MAIL.hero}/1.2 ${display};letter-spacing:-0.02em;color:${ink900};">
            ${escapeHtml(title)}
          </h1>
          <p style="margin:12px 0 0;font:400 ${MAIL.base}/1.65 ${body};color:${ink500};">${intro}</p>
        </td></tr>

        ${blocks}

        <tr><td style="padding:28px 36px 36px;">
          <p style="margin:0;font:400 ${MAIL.small}/1.6 ${body};color:${ink300};border-top:1px solid ${line};padding-top:16px;">
            ${footerNote}<br />
            ${escapeHtml(BUSINESS_INFO.name)} · ${escapeHtml(BUSINESS_INFO.address.city)}, ${escapeHtml(BUSINESS_INFO.address.region)}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href, label) {
  const { display } = MAIL;
  return `
        <tr><td style="padding:24px 36px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:${MAIL.radiusInner};background:${MAIL.brand};">
              <a href="${href}" style="display:inline-block;padding:13px 26px;font:600 ${MAIL.base}/1 ${display};color:#ffffff;text-decoration:none;">
                ${escapeHtml(label)}
              </a>
            </td>
          </tr></table>
        </td></tr>`;
}

/** A label/value table, the same one the welcome mail's credentials block uses. */
function detailTable(rows) {
  const { body, mono, ink900, ink500, line } = MAIL;

  const cells = rows
    .map(
      ([label, value, isMono]) => `
          <tr>
            <td style="padding:11px 16px;border-top:1px solid ${line};font:400 ${MAIL.small}/1.4 ${body};color:${ink500};white-space:nowrap;">${escapeHtml(label)}</td>
            <td style="padding:11px 16px;border-top:1px solid ${line};font:${isMono ? `700 ${MAIL.lead}/1.4 ${mono};letter-spacing:0.4px` : `600 ${MAIL.base}/1.4 ${body}`};color:${ink900};">${escapeHtml(String(value))}</td>
          </tr>`,
    )
    .join('');

  return `
        <tr><td style="padding:22px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};border-radius:${MAIL.radiusInner};overflow:hidden;">
            ${cells.replace(`border-top:1px solid ${line};`, '')}
          </table>
        </td></tr>`;
}

/**
 * The portal invitation.
 *
 * **The password travels in the body**, exactly as the buyer's admin-created
 * welcome does, and for the same reason and at the same cost: a supplier has no
 * other way to receive a credential they did not choose, and the message tells
 * them to change it. `sendSupplierPortalInvite` is called both when a supplier
 * is created and from the admin's **Resend portal link** button — the second
 * one always mints a fresh password, because the old one cannot be read back
 * out of the hash to be re-sent.
 */
async function sendSupplierPortalInvite({ supplier, password }) {
  if (!supplier?.email) {
    return { delivered: false, via: null, error: 'No email address on file.' };
  }

  try {
    const origin = env.publicOrigin;
    const portal = `${origin}/supplier`;

    const intro = `Your supplier portal for <strong style="color:${MAIL.ink900};font-weight:600;">${escapeHtml(supplier.name)}</strong> is open. Sign in to see the requests for quote we send you and to price them.`;

    const rows = [
      ['Portal', portal, false],
      ['Email', supplier.email, false],
    ];
    if (password) rows.push(['Password', password, true]);

    const blocks =
      detailTable(rows) +
      (password
        ? `
        <tr><td style="padding:14px 36px 0;">
          <p style="margin:0;font:400 ${MAIL.small}/1.6 ${MAIL.body};color:${MAIL.ink500};">
            This password is written in this email — anyone who can read the message can sign in as you.
            Please change it from the portal once you are in, and delete this message afterwards.
          </p>
        </td></tr>`
        : '') +
      button(portal, 'Open the supplier portal');

    const text = [
      `Your ${BUSINESS_INFO.name} supplier portal is open.`,
      '',
      `  Portal    ${portal}`,
      `  Email     ${supplier.email}`,
      ...(password ? [`  Password  ${password}`] : []),
      '',
      ...(password
        ? [
            'This password is written in this email. Please change it once you are in',
            'and delete this message afterwards.',
            '',
          ]
        : []),
      'Sign in to see the requests for quote we send you and to price them.',
      '',
      `${BUSINESS_INFO.name} · ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.region}`,
      'Reply to this email and it reaches our purchasing team.',
    ].join('\n');

    return await sendMail({
      to: supplier.email,
      from: env.MAIL_FROM_ADMIN,
      subject: `Your ${BUSINESS_INFO.name} supplier portal`,
      html: shell({
        preheader: 'Your sign-in details for the supplier portal are inside.',
        title: 'Your supplier portal is ready',
        intro,
        blocks,
        footerNote: 'Reply to this email and it reaches our purchasing team.',
      }),
      text,
    });
  } catch (error) {
    console.error(
      `  Mail: portal invite for ${supplier?.email} could not be built — ${error.message}`,
    );
    return { delivered: false, via: null, error: error.message };
  }
}

/**
 * The portal password reset.
 *
 * **The link is the secret** — unlike the invite there is no password in the
 * body, because this one is answering a request from somebody who already has
 * an account. The token is single-use and expires, so a message left sitting in
 * a mailbox stops working on its own.
 */
async function sendSupplierResetEmail({ supplier, link, expiresDays = 7 }) {
  if (!supplier?.email || !link) {
    return { delivered: false, via: null, error: 'No email address or link.' };
  }

  try {
    const text = [
      `Somebody asked to reset the supplier portal password for ${supplier.email}.`,
      '',
      `  Choose a new password  ${link}`,
      '',
      `The link works once and expires in ${expiresDays} days.`,
      'If this was not you, ignore this message — nothing has changed.',
      '',
      `${BUSINESS_INFO.name} · ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.region}`,
    ].join('\n');

    return await sendMail({
      to: supplier.email,
      from: env.MAIL_FROM_ADMIN,
      subject: 'Reset your supplier portal password',
      html: shell({
        preheader: `Choose a new password. The link expires in ${expiresDays} days.`,
        title: 'Reset your password',
        intro: `Somebody asked to reset the supplier portal password for <strong style="color:${MAIL.ink900};font-weight:600;">${escapeHtml(supplier.email)}</strong>. Use the button below within ${expiresDays} days.`,
        blocks: button(link, 'Choose a new password'),
        footerNote:
          'If this was not you, ignore this message — nothing has changed until the link is used.',
      }),
      text,
    });
  } catch (error) {
    console.error(`  Mail: portal reset for ${supplier?.email} could not be built — ${error.message}`);
    return { delivered: false, via: null, error: error.message };
  }
}

/**
 * "We would like a price for these parts."
 *
 * Carries the line list but **no prices at all** — not ours, not another
 * supplier's. The whole document is a question, and a number in it would be an
 * anchor we did not mean to set.
 */
async function sendRfqInvitation({ supplier, rfq }) {
  if (!supplier?.email) {
    return { delivered: false, via: null, error: 'No email address on file.' };
  }

  try {
    const origin = env.publicOrigin;
    const link = `${origin}/supplier/rfq/${rfq._id ?? rfq.id}`;

    const lineRows = (rfq.items ?? [])
      .slice(0, 12)
      .map(
        (item) => `
            <tr>
              <td style="padding:9px 16px;border-top:1px solid ${MAIL.line};font:400 ${MAIL.small}/1.4 ${MAIL.body};color:${MAIL.ink900};">${escapeHtml(item.name ?? item.sku ?? '')}</td>
              <td style="padding:9px 16px;border-top:1px solid ${MAIL.line};font:400 ${MAIL.small}/1.4 ${MAIL.mono};color:${MAIL.ink500};">${escapeHtml(item.sku ?? '')}</td>
              <td align="right" style="padding:9px 16px;border-top:1px solid ${MAIL.line};font:600 ${MAIL.small}/1.4 ${MAIL.body};color:${MAIL.ink900};">${item.qty}</td>
            </tr>`,
      )
      .join('');

    const more = (rfq.items ?? []).length > 12 ? (rfq.items ?? []).length - 12 : 0;

    const blocks =
      `
        <tr><td style="padding:22px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${MAIL.line};border-radius:${MAIL.radiusInner};overflow:hidden;">
            <tr>
              <td style="padding:9px 16px;background:${MAIL.surface2};font:600 ${MAIL.micro}/1.4 ${MAIL.display};letter-spacing:0.08em;text-transform:uppercase;color:${MAIL.ink300};">Part</td>
              <td style="padding:9px 16px;background:${MAIL.surface2};font:600 ${MAIL.micro}/1.4 ${MAIL.display};letter-spacing:0.08em;text-transform:uppercase;color:${MAIL.ink300};">SKU</td>
              <td align="right" style="padding:9px 16px;background:${MAIL.surface2};font:600 ${MAIL.micro}/1.4 ${MAIL.display};letter-spacing:0.08em;text-transform:uppercase;color:${MAIL.ink300};">Qty</td>
            </tr>
            ${lineRows}
          </table>
          ${more ? `<p style="margin:10px 0 0;font:400 ${MAIL.small}/1.5 ${MAIL.body};color:${MAIL.ink300};">and ${more} more line${more === 1 ? '' : 's'} in the portal.</p>` : ''}
        </td></tr>` + button(link, 'Send us your price');

    const text = [
      `${BUSINESS_INFO.name} is asking for a price — ${rfq.rfqNumber}.`,
      '',
      ...(rfq.items ?? []).map((item) => `  ${item.qty} x ${item.name ?? ''} (${item.sku ?? ''})`),
      '',
      ...(rfq.closesAt ? [`Answers close ${new Date(rfq.closesAt).toDateString()}.`, ''] : []),
      `  Quote here  ${link}`,
      '',
      `${BUSINESS_INFO.name} · ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.region}`,
    ].join('\n');

    return await sendMail({
      to: supplier.email,
      from: env.MAIL_FROM_ADMIN,
      subject: `Request for quote ${rfq.rfqNumber}`,
      html: shell({
        preheader: `We would like a price for ${(rfq.items ?? []).length} line${(rfq.items ?? []).length === 1 ? '' : 's'}.`,
        title: 'Request for quote',
        intro: `We would like a price from <strong style="color:${MAIL.ink900};font-weight:600;">${escapeHtml(supplier.name)}</strong> for the parts below${rfq.closesAt ? `, by ${escapeHtml(new Date(rfq.closesAt).toDateString())}` : ''}. Prices go in the portal — the button is at the bottom.`,
        blocks,
        footerNote: `Reference ${escapeHtml(rfq.rfqNumber)}. Reply to this email and it reaches our purchasing team.`,
      }),
      text,
    });
  } catch (error) {
    console.error(`  Mail: RFQ invite for ${supplier?.email} could not be built — ${error.message}`);
    return { delivered: false, via: null, error: error.message };
  }
}

/**
 * The award outcome, sent to every supplier who quoted.
 *
 * Losers are told, deliberately. A supplier who priced work and hears nothing
 * learns only that answering is not worth the effort, and the next request gets
 * fewer answers. The message carries no competitor's price and no ranking —
 * what another supplier charges is not this one's business.
 */
async function sendRfqOutcome({ supplier, rfq, won, poNumber = null }) {
  if (!supplier?.email) {
    return { delivered: false, via: null, error: 'No email address on file.' };
  }

  try {
    const origin = env.publicOrigin;
    const link = won && poNumber ? `${origin}/supplier` : `${origin}/supplier`;

    const intro = won
      ? `Thank you for quoting ${escapeHtml(rfq.rfqNumber)} — we would like to go ahead. The purchase order is in your portal.`
      : `Thank you for quoting ${escapeHtml(rfq.rfqNumber)}. We have placed this order elsewhere on this occasion, and we will be in touch with the next one.`;

    const blocks = won
      ? detailTable([
          ['Request', rfq.rfqNumber, false],
          ...(poNumber ? [['Purchase order', poNumber, true]] : []),
        ]) + button(link, 'Open the portal')
      : '';

    const text = [
      won
        ? `Your quote for ${rfq.rfqNumber} was accepted.`
        : `Thank you for quoting ${rfq.rfqNumber}.`,
      '',
      ...(won
        ? [
            ...(poNumber ? [`  Purchase order  ${poNumber}`] : []),
            `  Portal          ${link}`,
          ]
        : ['We have placed this order elsewhere on this occasion, and we will be in touch with the next one.']),
      '',
      `${BUSINESS_INFO.name} · ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.region}`,
    ].join('\n');

    return await sendMail({
      to: supplier.email,
      from: env.MAIL_FROM_ADMIN,
      subject: won ? `Your quote was accepted — ${rfq.rfqNumber}` : `Request for quote ${rfq.rfqNumber}`,
      html: shell({
        preheader: won ? 'We would like to go ahead.' : 'Thank you for quoting.',
        title: won ? 'Your quote was accepted' : 'Thank you for quoting',
        intro,
        blocks,
        footerNote: 'Reply to this email and it reaches our purchasing team.',
      }),
      text,
    });
  } catch (error) {
    console.error(`  Mail: RFQ outcome for ${supplier?.email} could not be built — ${error.message}`);
    return { delivered: false, via: null, error: error.message };
  }
}

export {
  sendSupplierPortalInvite,
  sendSupplierResetEmail,
  sendRfqInvitation,
  sendRfqOutcome,
};
