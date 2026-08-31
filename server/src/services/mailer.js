const fs = require('node:fs/promises');
const path = require('node:path');
const { default: env } = require('../config/env.js');

/**
 * Outbound mail.
 *
 * Two modes, and the difference is configuration rather than code:
 *
 *   - `SMTP_URL` set and nodemailer installed → the message is sent.
 *   - anything else → the message is written to `server/.mail/` and logged.
 *
 * The fallback is not a stub for its own sake. Mail is a side effect of placing
 * an order, and a side effect must never be able to fail the order: a dead SMTP
 * host, a bad credential or a missing dependency has to end in a log line, not
 * a rejected checkout. Every path through `sendMail` resolves.
 */

const here = __dirname;
const OUTBOX = path.resolve(here, '..', '..', '.mail');

/** Resolved once. `null` means "no transport — use the outbox". */
let transportPromise = null;

async function getTransport() {
  if (!env.SMTP_URL) return null;

  transportPromise ??= (async () => {
    try {
      const { default: nodemailer } = await import('nodemailer');
      /**
       * `secure` is decided here rather than left to the URL scheme.
       *
       * cPanel's outgoing server is mail.<domain> on port 465, which is
       * *implicit* TLS: the connection is encrypted from the first byte. A
       * plain `smtp://` URL makes nodemailer default to `secure: false` and
       * open in cleartext expecting a STARTTLS upgrade that a 465 listener
       * never offers, so the socket hangs until it times out. Port 587 is the
       * opposite — cleartext first, then STARTTLS — and must stay
       * `secure: false`. Deriving it from the port means either form of URL
       * works and neither has to be remembered.
       */
      const url = new URL(env.SMTP_URL);
      const port = Number(url.port) || (url.protocol === 'smtps:' ? 465 : 587);
      return nodemailer.createTransport({
        host: url.hostname,
        port,
        secure: port === 465 || url.protocol === 'smtps:',
        auth: url.username
          ? {
              // A cPanel mailbox name is a full address, so the `@` arrives
              // percent-encoded in the URL and must be decoded before it goes
              // out as the AUTH username, or the login is rejected.
              user: decodeURIComponent(url.username),
              pass: decodeURIComponent(url.password),
            }
          : undefined,
      });
    } catch (error) {
      // Optional dependency: SMTP_URL is set but nodemailer was never installed.
      console.warn(`  Mail: SMTP_URL is set but nodemailer is unavailable (${error.message}).`);
      console.warn('  Mail: falling back to the outbox. Run `npm i nodemailer -w server`.');
      return null;
    }
  })();

  return transportPromise;
}

/**
 * Whether a real transport is available, without sending anything.
 *
 * Exists for the invoice-message dry run (phase 11d): a preview that says
 * "would send" against a server whose real run writes to the outbox is a
 * preview that disagrees with the thing it previews. Resolves the transport
 * through the same path `sendMail` uses, so the two can never differ.
 */
async function mailerConfigured() {
  return Boolean(await getTransport());
}

const slug = (value) =>
  String(value ?? 'message')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .toLowerCase();

/**
 * @returns {Promise<{ delivered: boolean, via: 'smtp' | 'outbox', path?: string }>}
 */
async function sendMail({ to, subject, html, text, from = env.MAIL_FROM }) {
  const transport = await getTransport();

  if (transport) {
    try {
      await transport.sendMail({ from, to, subject, html, text });
      return { delivered: true, via: 'smtp' };
    } catch (error) {
      console.error(`  Mail: send to ${to} failed — ${error.message}`);
      // Fall through to the outbox so the message is not simply lost.
    }
  }

  try {
    await fs.mkdir(OUTBOX, { recursive: true });
    const file = path.join(
      OUTBOX,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(subject)}.html`,
    );
    await fs.writeFile(
      file,
      `<!-- to: ${to}\n     from: ${from}\n     subject: ${subject} -->\n${html ?? `<pre>${text ?? ''}</pre>`}`,
      'utf8',
    );
    console.log(`  Mail: "${subject}" for ${to} written to ${path.relative(process.cwd(), file)}`);
    return { delivered: false, via: 'outbox', path: file };
  } catch (error) {
    console.error(`  Mail: could not write the outbox copy — ${error.message}`);
    return { delivered: false, via: 'outbox' };
  }
}

// --- CommonJS exports -------------------------------------------------
exports.mailerConfigured = mailerConfigured;
exports.sendMail = sendMail;
exports.default = sendMail;
