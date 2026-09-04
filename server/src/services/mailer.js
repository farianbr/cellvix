import env from '../config/env.js';

/**
 * Outbound mail. `SMTP_URL` plus nodemailer sends; anything else cannot.
 *
 * Mail is a side effect of placing an order, and a side effect must never be
 * able to fail the order: a dead SMTP host, a bad credential or a missing
 * dependency has to end in a logged failure, not a rejected checkout. Every
 * path through `sendMail` resolves — callers read `delivered` to know what
 * happened, and none of them may throw on a false.
 */

/** Resolved once. `null` means no transport is available. */
let transportPromise = null;

async function getTransport() {
  if (!env.SMTP_URL) return null;

  transportPromise ??= (async () => {
    try {
      const { default: nodemailer } = await import('nodemailer');
      /**
       * `secure` is decided here rather than left to the URL scheme.
       *
       * A typical outgoing server is mail.<domain> on port 465, which is
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
              // A hosted mailbox name is usually a full address, so the `@` arrives
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
      console.warn('  Mail: nothing can be sent. Run `npm i nodemailer -w server`.');
      return null;
    }
  })();

  return transportPromise;
}

/**
 * Whether a real transport is available, without sending anything.
 *
 * Exists for the invoice-message dry run (phase 11d): a preview that says
 * "would send" against a server that cannot send is a preview that disagrees
 * with the thing it previews. Resolves the transport through the same path
 * `sendMail` uses, so the two can never differ.
 */
async function mailerConfigured() {
  return Boolean(await getTransport());
}

/**
 * Sends a message. Never throws — a caller reads the result instead.
 *
 * @returns {Promise<{ delivered: boolean, via: 'smtp' | null, error?: string }>}
 *   `via` is `'smtp'` only on a real delivery. A `false` `delivered` carries
 *   `error` saying why, and the message is gone — there is no local copy.
 */
async function sendMail({ to, subject, html, text, from = env.MAIL_FROM }) {
  const transport = await getTransport();

  if (!transport) {
    const error = 'No SMTP transport is configured.';
    console.error(`  Mail: "${subject}" for ${to} not sent — ${error}`);
    return { delivered: false, via: null, error };
  }

  try {
    await transport.sendMail({ from, to, subject, html, text });
    return { delivered: true, via: 'smtp' };
  } catch (error) {
    console.error(`  Mail: send to ${to} failed — ${error.message}`);
    return { delivered: false, via: null, error: error.message };
  }
}

export { mailerConfigured, sendMail };
export default sendMail;
