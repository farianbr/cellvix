import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESS_INFO } from '../../../shared/business.js';

/**
 * The invoice document.
 *
 * One renderer, two consumers: the copy emailed to the buyer when the order is
 * placed, and `GET /api/invoices/:number/document`, which the dashboard's PDF
 * button opens for print-to-PDF. Both have to be the same piece of paper, so
 * neither builds its own markup.
 *
 * Styling is INLINE on purpose. Mail clients strip <style> blocks with no
 * warning, and an invoice that arrives as unstyled text is not an invoice. The
 * <style> block that is here carries print rules only — nothing the layout
 * depends on.
 */

/**
 * The masthead logo, inlined as a data URI.
 *
 * A mail client will not fetch a remote image until the reader asks it to, and
 * plenty never ask — an invoice whose letterhead is a broken-image icon is the
 * one thing worse than no letterhead. Read once at boot; if the file is not
 * there the masthead falls back to the wordmark set in type.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const LOGO = (() => {
  try {
    const file = path.resolve(here, '..', '..', '..', 'client', 'public', 'brand', 'logo.png');
    return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
})();

const CAD = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
});

const LONG_DATE = new Intl.DateTimeFormat('en-CA', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const money = (cents) => CAD.format((cents ?? 0) / 100);
const day = (value) => (value ? LONG_DATE.format(new Date(value)) : '—');

const TERMS_COPY = {
  prepaid: 'Paid at checkout. No credit is extended on this account.',
  net15: 'Payment is due 15 days from the issue date.',
  net30: 'Payment is due 30 days from the issue date.',
  net60: 'Payment is due 60 days from the issue date.',
};

/** Everything interpolated below is account-authored, so it all escapes. */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const INK = '#111113';
const MUTED = '#6b6b73';
const LINE = '#e4e4e8';
const BRAND = '#CF3429';

function addressBlock(title, address) {
  if (!address) return '';
  const rows = [
    address.contactName,
    address.company,
    address.line1,
    address.line2,
    [address.city, address.region].filter(Boolean).join(', ') +
      (address.postal ? ` ${address.postal}` : ''),
    address.country,
    address.phone,
  ]
    .filter((line) => line && String(line).trim())
    .map(
      (line) =>
        `<div style="font-size:12px;line-height:1.65;color:${MUTED};">${escapeHtml(line)}</div>`,
    )
    .join('');

  return `
    <td style="vertical-align:top;padding:22px 24px;width:50%;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${INK};margin-bottom:10px;">${escapeHtml(title)}</div>
      ${rows}
    </td>`;
}

function itemRows(order) {
  return (order?.items ?? [])
    .map(
      (item, index) => `
        <tr>
          <td style="padding:11px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${MUTED};vertical-align:top;">${index + 1}.</td>
          <td style="padding:11px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${INK};vertical-align:top;">
            <div style="font-weight:600;">${escapeHtml(item.name)}</div>
            <div style="font-size:11px;color:${MUTED};margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
              ${escapeHtml(item.sku ?? '')}${item.grade ? ` · ${escapeHtml(item.grade)}` : ''}
            </div>
          </td>
          <td style="padding:11px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${MUTED};text-align:right;vertical-align:top;white-space:nowrap;">${money(item.unitPrice)}</td>
          <td style="padding:11px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${MUTED};text-align:right;vertical-align:top;">${item.qty}</td>
          <td style="padding:11px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${INK};text-align:right;vertical-align:top;white-space:nowrap;font-weight:600;">${money(item.lineTotal)}</td>
        </tr>`,
    )
    .join('');
}

function totalsRow(label, value, { strong = false, tone } = {}) {
  return `
    <tr>
      <td style="padding:5px 0;font-size:${strong ? '12.5px' : '12px'};letter-spacing:.04em;text-transform:uppercase;color:${strong ? INK : MUTED};font-weight:${strong ? 700 : 500};">${escapeHtml(label)}</td>
      <td style="padding:5px 0 5px 28px;font-size:${strong ? '13.5px' : '12.5px'};text-align:right;white-space:nowrap;color:${tone ?? (strong ? INK : MUTED)};font-weight:${strong ? 700 : 600};">${escapeHtml(value)}</td>
    </tr>`;
}

/**
 * @param {object}  args
 * @param {object}  args.invoice  Invoice document (lean or hydrated)
 * @param {object}  args.order    The order it bills, if there is one
 * @param {object}  args.user     The buyer
 * @param {string}  [args.origin] Public site origin, for the "view online" link
 * @param {string}  [args.nonce]  CSP nonce. Present only for the browser copy —
 *                                without one the print button is not rendered,
 *                                which is exactly what the emailed copy wants.
 */
function renderInvoiceHtml({ invoice, order, user, origin, nonce }) {
  const balance = (invoice.amount ?? 0) - (invoice.amountPaid ?? 0);
  const settled = balance <= 0;
  const business = BUSINESS_INFO;

  // What this document calls itself. A tax invoice is issued only against money
  // that arrived; before that the same row is an amount due, and a receipt for
  // a store-credit movement is neither. Calling all three "invoice" is what the
  // `kind` field on the model exists to stop.
  const kind = invoice.kind ?? 'invoice';
  const docLabel =
    kind === 'receipt' ? 'Receipt' : kind === 'due' ? 'Statement of amount due' : 'Invoice';
  const numberLabel = kind === 'receipt' ? 'Receipt no.' : kind === 'due' ? 'Reference' : 'Invoice no.';

  const payments = (invoice.payments ?? [])
    .map(
      (payment) => `
        <div style="font-size:12px;line-height:1.7;color:${MUTED};">
          ${escapeHtml(day(payment.at))} · ${escapeHtml(payment.method ?? 'payment')} · ${money(payment.amount)}
        </div>`,
    )
    .join('');

  const discountRows = [
    order?.bundleDiscount > 0 ? totalsRow('Combo savings', `−${money(order.bundleDiscount)}`) : '',
    order?.promoDiscount > 0
      ? totalsRow(
          order?.promo?.code ? `Promo ${order.promo.code}` : 'Promotion',
          `−${money(order.promoDiscount)}`,
        )
      : '',
  ].join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(docLabel)} ${escapeHtml(invoice.number)} · ${escapeHtml(business.name)}</title>
<style>
  @media print {
    body { background: #fff !important; padding: 0 !important; }
    .sheet { box-shadow: none !important; margin: 0 !important; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body style="margin:0;padding:24px 12px;background:#f4f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

${
  nonce
    ? `<div class="no-print" style="max-width:760px;margin:0 auto 14px;text-align:right;">
  <button type="button" id="print-invoice" style="cursor:pointer;border:0;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:600;color:#fff;background:${BRAND};">
    Print / save as PDF
  </button>
</div>
<script nonce="${escapeHtml(nonce)}">
  document.getElementById('print-invoice').addEventListener('click', function () { window.print(); });
</script>`
    : ''
}

<table role="presentation" class="sheet" cellpadding="0" cellspacing="0" style="max-width:760px;width:100%;margin:0 auto;background:#fff;border-collapse:collapse;box-shadow:0 1px 3px rgba(0,0,0,.08);">
  <tr>
    <td style="padding:34px 34px 0;">

      <!-- ---- masthead ------------------------------------------------- -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            ${
              LOGO
                ? `<img src="${LOGO}" alt="${escapeHtml(business.name)}" width="190" height="48"
                     style="display:block;width:190px;height:auto;border:0;" />`
                : `<table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:34px;height:34px;background:${INK};border-radius:6px;"></td>
                <td style="padding-left:11px;vertical-align:middle;">
                  <div style="font-size:17px;font-weight:800;letter-spacing:.02em;color:${INK};">${escapeHtml(business.name.toUpperCase())}</div>
                  <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:${MUTED};margin-top:2px;">${escapeHtml(business.tagline)}</div>
                </td>
              </tr>
            </table>`
            }
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:30px;font-weight:800;letter-spacing:.02em;color:${INK};line-height:1;">INVOICE</div>
            <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};margin-top:7px;">Issued ${escapeHtml(day(invoice.issuedAt))}</div>
          </td>
        </tr>
      </table>

      <!-- ---- parties -------------------------------------------------- -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;background:#f7f7f9;border-radius:8px;">
        <tr>
          ${addressBlock('Invoice to', order?.billingAddress ?? { contactName: user?.contactName, company: user?.businessName })}
          ${addressBlock('Ship to', order?.shippingAddress ?? null)}
        </tr>
      </table>

      <!-- ---- meta ----------------------------------------------------- -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
        <tr>
          <td style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};">
            Due ${escapeHtml(day(invoice.dueDate))}${order?.poNumber ? ` &nbsp;·&nbsp; PO ${escapeHtml(order.poNumber)}` : ''}
          </td>
          <td style="text-align:right;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${INK};font-weight:700;">
            ${escapeHtml(numberLabel)} ${escapeHtml(invoice.number)}${order?.orderNumber ? ` &nbsp;·&nbsp; Order ${escapeHtml(order.orderNumber)}` : ''}
          </td>
        </tr>
      </table>

      <!-- ---- lines ---------------------------------------------------- -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:9px 10px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};width:34px;">No</th>
            <th style="text-align:left;padding:9px 10px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Item description</th>
            <th style="text-align:right;padding:9px 10px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Price</th>
            <th style="text-align:right;padding:9px 10px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Qty</th>
            <th style="text-align:right;padding:9px 10px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Total</th>
          </tr>
        </thead>
        <tbody>
          ${
            itemRows(order) ||
            `<tr><td colspan="5" style="padding:16px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${MUTED};">${escapeHtml(`Account charge — ${invoice.number}`)}</td></tr>`
          }
        </tbody>
      </table>

      <!-- ---- totals --------------------------------------------------- -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr>
          <td style="vertical-align:top;width:47%;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${INK};">${settled ? 'Paid in full' : 'Total due'}</div>
            <div style="margin-top:9px;display:inline-block;padding:13px 20px;background:#f7f7f9;border-radius:8px;">
              <span style="font-size:25px;font-weight:800;color:${settled ? INK : BRAND};letter-spacing:-.01em;">${money(settled ? invoice.amount : balance)}</span>
            </div>
            ${
              // Pay from the document itself — the shortest path from "I am
              // looking at what I owe" to having paid it.
              //
              // A LINK, never a form. This page is served under its own
              // Content-Security-Policy carrying `form-action 'none'`
              // (`controllers/accountController.js`), so a posting button here
              // would be silently dead. It carries `?pay=1`, which the invoices
              // screen reads to open the payment sheet on arrival.
              //
              // `.no-print` because a printed sheet with a button on it is a
              // button nobody can press.
              !settled && origin
                ? `<div class="no-print" style="margin-top:12px;">
              <a href="${escapeHtml(origin)}/account/invoices?pay=${encodeURIComponent(invoice.number)}"
                 style="display:inline-block;padding:11px 20px;border-radius:9px;background:${BRAND};color:#fff;font-size:13px;font-weight:700;text-decoration:none;">
                Pay ${money(balance)} now
              </a>
              <div style="margin-top:7px;font-size:11px;line-height:1.6;color:${MUTED};">
                Pay by card or with your store credit.
              </div>
            </div>`
                : ''
            }
          </td>
          <td style="vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${totalsRow('Subtotal', money(order?.subtotal ?? invoice.amount))}
              ${discountRows}
              ${order?.shipping !== undefined ? totalsRow('Shipping', money(order.shipping)) : ''}
              ${order?.tax !== undefined ? totalsRow('GST/HST', money(order.tax)) : ''}
              ${totalsRow('Grand total', money(invoice.amount), { strong: true })}
              ${invoice.amountPaid > 0 ? totalsRow('Paid', `−${money(invoice.amountPaid)}`) : ''}
              ${totalsRow('Balance due', money(Math.max(0, balance)), { strong: true, tone: balance > 0 ? BRAND : INK })}
            </table>
          </td>
        </tr>
      </table>

      <!-- ---- terms ---------------------------------------------------- -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;border-top:1px solid ${LINE};">
        <tr>
          <td style="vertical-align:top;width:50%;padding:20px 20px 0 0;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${INK};margin-bottom:8px;">Payment</div>
            <div style="font-size:12px;line-height:1.7;color:${MUTED};">Terms: ${escapeHtml((invoice.terms ?? 'prepaid').replace('net', 'Net '))}</div>
            <div style="font-size:12px;line-height:1.7;color:${MUTED};">Remit to: ${escapeHtml(business.billingEmail ?? business.email)}</div>
            ${business.gstNumber ? `<div style="font-size:12px;line-height:1.7;color:${MUTED};">GST/HST no. ${escapeHtml(business.gstNumber)}</div>` : ''}
            ${payments}
          </td>
          <td style="vertical-align:top;width:50%;padding:20px 0 0 20px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${INK};margin-bottom:8px;">Terms &amp; conditions</div>
            <div style="font-size:12px;line-height:1.7;color:${MUTED};">
              ${escapeHtml(TERMS_COPY[invoice.terms] ?? TERMS_COPY.prepaid)}
              All amounts are in Canadian dollars. Parts are covered by the warranty stated on the
              product page at the time of purchase.
            </div>
          </td>
        </tr>
      </table>

      <!-- ---- footer --------------------------------------------------- -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${LINE};">
        <tr>
          <td style="padding:16px 0 30px;font-size:11px;line-height:1.7;color:${MUTED};">
            Questions? Email <a href="mailto:${escapeHtml(business.email)}" style="color:${BRAND};text-decoration:none;">${escapeHtml(business.email)}</a>
            or call ${escapeHtml(business.phone)}.<br />
            ${escapeHtml(business.address.line1)}, ${escapeHtml(business.address.city)}, ${escapeHtml(business.address.region)} ${escapeHtml(business.address.postal)} · ${escapeHtml(business.domain)}
            ${
              origin && order?.orderNumber
                ? `<br /><a href="${escapeHtml(origin)}/account/orders/${escapeHtml(order.orderNumber)}" style="color:${BRAND};text-decoration:none;">View this order in your Cellvix account</a>`
                : ''
            }
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Plain-text fallback, for the mail clients that refuse HTML. */
function renderInvoiceText({ invoice, order, origin }) {
  const balance = (invoice.amount ?? 0) - (invoice.amountPaid ?? 0);
  const kind = invoice.kind ?? 'invoice';
  const docLabel = kind === 'receipt' ? 'receipt' : kind === 'due' ? 'amount due' : 'invoice';

  const lines = [
    `${BUSINESS_INFO.name} — ${docLabel} ${invoice.number}`,
    order?.orderNumber ? `Order ${order.orderNumber}` : null,
    `Issued ${day(invoice.issuedAt)} · due ${day(invoice.dueDate)}`,
    '',
    ...(order?.items ?? []).map(
      (item) => `${item.qty} × ${item.name} (${item.sku ?? ''}) — ${money(item.lineTotal)}`,
    ),
    '',
    `Total ${money(invoice.amount)}`,
    invoice.amountPaid > 0 ? `Paid ${money(invoice.amountPaid)}` : null,
    `Balance due ${money(Math.max(0, balance))}`,
    // The plain-text copy gets the same route to paying that the HTML one does.
    // A reader on a mail client that refuses HTML is exactly the reader who
    // needs the URL spelled out.
    balance > 0 && origin
      ? `\nPay online: ${origin}/account/invoices?pay=${encodeURIComponent(invoice.number)}`
      : null,
    '',
    `Questions? ${BUSINESS_INFO.email} · ${BUSINESS_INFO.phone}`,
  ];

  return lines.filter((line) => line !== null).join('\n');
}

export { renderInvoiceHtml, renderInvoiceText };
export default renderInvoiceHtml;
