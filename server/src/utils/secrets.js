const crypto = require('node:crypto');

const { default: env } = require('../config/env.js');

/**
 * Encryption at rest for provider credentials (ERP rework §6.15, phase 11c).
 *
 * §6.15 is explicit and not negotiable: a stored secret is **write-only through
 * the API**. The server keeps it encrypted, returns a masked preview and a
 * boolean `configured`, and **never returns the value to a client** — not to an
 * admin, not masked-then-revealed. The reveal toggle in the UI unmasks what the
 * admin just typed into the field, nothing more.
 *
 * So this module has a deliberate asymmetry: `encrypt` is used by the write
 * path, and `decrypt` is used **only** by the server code that actually calls a
 * provider. No controller, no serializer and no route ever calls `decrypt`.
 *
 * **AES-256-GCM, not CBC.** GCM authenticates as well as encrypts, so a
 * tampered ciphertext fails to decrypt rather than yielding plausible garbage
 * that then gets sent to a provider as an API key.
 *
 * **A random IV per encryption**, stored alongside the ciphertext. Reusing an
 * IV under one key is the single worst thing you can do with GCM — it leaks the
 * XOR of the plaintexts and breaks the authentication entirely.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the size GCM is specified for.
const KEY_BYTES = 32;

/**
 * The encryption key, derived once.
 *
 * Falls back to `JWT_SECRET` when `SECRETS_KEY` is unset, through a **key
 * derivation function rather than raw bytes**: `JWT_SECRET` is a passphrase of
 * arbitrary length and entropy, and using it directly as an AES key would mean
 * a short one silently becomes a short key.
 *
 * The salt is fixed and non-secret, which is correct here — its job is domain
 * separation, so the derived encryption key is not the signing key even when
 * both come from the same passphrase. Per-secret salts would mean storing one
 * per row and buys nothing against an attacker who already has the database.
 */
let cachedKey = null;

function key() {
  if (cachedKey) return cachedKey;

  const source = env.SECRETS_KEY || env.JWT_SECRET;
  cachedKey = crypto.scryptSync(source, 'cellvix.secrets.v1', KEY_BYTES);
  return cachedKey;
}

/**
 * Encrypts one secret.
 *
 * Returns a self-describing string — `v1:iv:tag:ciphertext`, all base64url —
 * so the format can be changed later without guessing what an existing row is.
 */
function encrypt(plaintext) {
  const value = String(plaintext ?? '');
  if (!value) return '';

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);

  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

/**
 * Decrypts one secret. **Server-side provider calls only** — never a response.
 *
 * Returns `null` rather than throwing on anything malformed, tampered, or
 * encrypted under a different key. A rotated `JWT_SECRET` makes every stored
 * secret undecryptable, and the right behaviour then is for the provider to
 * report itself unconfigured — which the channel notices already handle — not
 * for every request touching settings to 500.
 */
function decrypt(stored) {
  if (!stored || typeof stored !== 'string') return null;

  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;

  try {
    const [, iv, tag, ciphertext] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Includes the authentication-tag failure, which is the case worth having:
    // a tampered ciphertext must never decrypt to something usable.
    return null;
  }
}

/**
 * The masked preview shown beside a configured key.
 *
 * **Derived from the length and last four characters only.** Enough for an
 * operator to tell which key is in the field — "is this the live one or the
 * test one" — and not enough to be worth stealing. Anything shorter than eight
 * characters is masked completely: showing four of a six-character secret
 * gives away most of it.
 */
function maskPreview(plaintext) {
  const value = String(plaintext ?? '');
  if (!value) return '';
  if (value.length < 8) return '•'.repeat(8);
  return `${'•'.repeat(8)}${value.slice(-4)}`;
}

exports.default = { encrypt, decrypt, maskPreview };

// --- CommonJS exports -------------------------------------------------
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.maskPreview = maskPreview;
