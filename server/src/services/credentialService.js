import ProviderCredential, {
  PROVIDER_FIELDS,
  PROVIDER_BY_KEY,
} from '../models/ProviderCredential.js';
import ApiError from '../utils/ApiError.js';
import { encrypt, decrypt, maskPreview } from '../utils/secrets.js';
import env from '../config/env.js';

/**
 * Provider credentials (ERP rework §6.15 category 7, phase 11c).
 *
 * **The read side cannot return a secret, structurally.** `list()` selects
 * `preview` and never `value`; the only function that decrypts is `valuesFor`,
 * which is called by server code that is about to talk to a provider and by
 * nothing else. There is no route that reaches it and no serializer that
 * includes it — §6.15 says a stored secret never comes back to the client, not
 * even to an admin, and the way to hold that line is to make the leak
 * impossible rather than to remember not to do it.
 *
 * **Environment variables still win.** `TWILIO_ACCOUNT_SID` and friends already
 * configure these providers, and a deployment that sets them must not be
 * silently overridden by a value typed into a screen months earlier. So the
 * resolution order is env first, database second, and the screen says which is
 * in force — otherwise an operator changes a key, nothing happens, and there is
 * nothing on screen to explain why.
 */

/** Env vars that already configure a provider field, by `provider.field`. */
const ENV_OVERRIDES = {
  'twilio.accountSid': 'TWILIO_ACCOUNT_SID',
  'twilio.authToken': 'TWILIO_AUTH_TOKEN',
  'whatsapp.token': 'WHATSAPP_TOKEN',
  'email.smtpUrl': 'SMTP_URL',
  'email.fromAddress': 'MAIL_FROM',
};

function envValue(provider, field) {
  const name = ENV_OVERRIDES[`${provider}.${field}`];
  return name ? (env[name] ?? null) : null;
}

function definitionFor(provider, field) {
  const entry = PROVIDER_BY_KEY.get(provider);
  if (!entry) throw ApiError.notFound(`There is no provider called “${provider}”.`, 'UNKNOWN_PROVIDER');

  const definition = entry.fields.find((candidate) => candidate.key === field);
  if (!definition) {
    throw ApiError.badRequest(`“${provider}” has no field called “${field}”.`, 'UNKNOWN_FIELD');
  }
  return definition;
}

/**
 * Every provider and the state of each field. **Never a value.**
 *
 * `source` is the important column: `env` means a variable is in force and the
 * screen must say a database value would be ignored; `stored` means this screen
 * is what is being used; `unset` means the provider cannot work yet.
 */
export async function list() {
  // No `.select('+value')`, so the ciphertext is not even loaded.
  const rows = await ProviderCredential.find().lean();
  const stored = new Map(rows.map((row) => [`${row.provider}.${row.field}`, row]));

  return {
    providers: PROVIDER_FIELDS.map((entry) => {
      const fields = entry.fields.map((definition) => {
        const key = `${entry.provider}.${definition.key}`;
        const fromEnv = envValue(entry.provider, definition.key);
        const row = stored.get(key);

        return {
          key: definition.key,
          label: definition.label,
          hint: definition.hint ?? null,
          secret: Boolean(definition.secret),
          // Env wins, so its presence is reported even when a stored row exists.
          source: fromEnv ? 'env' : row ? 'stored' : 'unset',
          configured: Boolean(fromEnv || row),
          // A preview of the env value is derived on the fly rather than stored:
          // nothing writes an env var into this collection. Masked only when
          // the field is actually a secret, matching what `save` stores.
          preview: fromEnv
            ? (definition.secret ? maskPreview(fromEnv) : fromEnv)
            : (row?.preview ?? ''),
          envName: ENV_OVERRIDES[key] ?? null,
          updatedAt: row?.updatedAt ?? null,
        };
      });

      return {
        provider: entry.provider,
        label: entry.label,
        description: entry.description,
        unblocks: entry.unblocks,
        // A provider is configured only when **every** field it needs is set —
        // Twilio with a SID and no auth token cannot send anything, and a card
        // reading CONFIGURED there would be a lie.
        configured: fields.every((field) => field.configured),
        // True when any field is set but not all of them: worth calling out,
        // because it looks like progress and behaves like nothing.
        partial: fields.some((field) => field.configured) && !fields.every((f) => f.configured),
        fields,
      };
    }),
  };
}

/**
 * Writes one provider's fields. Encrypts on the way in.
 *
 * An empty string **clears** the field rather than storing an empty secret —
 * that is how an operator removes a key, and it has to be distinguishable from
 * "leave this alone", which is what an absent key means.
 */
export async function save(provider, values, actorId) {
  const entry = PROVIDER_BY_KEY.get(provider);
  if (!entry) throw ApiError.notFound(`There is no provider called “${provider}”.`, 'UNKNOWN_PROVIDER');

  const written = [];
  const cleared = [];

  for (const [field, raw] of Object.entries(values ?? {})) {
    // Throws on anything not in the provider's definition, so an unknown field
    // is refused rather than stored where nothing will ever read it.
    const definition = definitionFor(provider, field);

    const value = typeof raw === 'string' ? raw.trim() : '';

    if (!value) {
      const result = await ProviderCredential.deleteOne({ provider, field });
      if (result.deletedCount) cleared.push(field);
      continue;
    }

    // A non-secret field is previewed in full. `fromNumber` and `fromAddress`
    // are operational config, not credentials — masking them would mean an
    // operator cannot check which number a channel sends from without
    // re-typing it, and there is nothing there worth hiding. They are still
    // encrypted at rest: one storage path is easier to keep correct than two,
    // and the preview is what decides what an operator sees.
    await ProviderCredential.updateOne(
      { provider, field },
      {
        $set: {
          value: encrypt(value),
          preview: definition.secret ? maskPreview(value) : value,
          updatedBy: actorId ?? null,
        },
      },
      { upsert: true },
    );
    written.push(field);
  }

  // Returns the public shape, so a caller cannot accidentally hand back what it
  // just wrote.
  return { written, cleared, ...(await list()) };
}

/** Removes every field for one provider. */
export async function clear(provider) {
  if (!PROVIDER_BY_KEY.has(provider)) {
    throw ApiError.notFound(`There is no provider called “${provider}”.`, 'UNKNOWN_PROVIDER');
  }

  const result = await ProviderCredential.deleteMany({ provider });
  return { cleared: result.deletedCount, ...(await list()) };
}

/**
 * The decrypted values for one provider. **Server-side callers only.**
 *
 * This is the only function in the codebase that decrypts a credential, and
 * nothing routes to it: it exists for the code that is about to call Twilio or
 * an SMTP host. If a future change makes a controller call this, that change is
 * the bug — §6.15 has no exception for "the admin asked nicely".
 *
 * Env wins over a stored value, matching `list()`'s `source`.
 */
export async function valuesFor(provider) {
  const entry = PROVIDER_BY_KEY.get(provider);
  if (!entry) return {};

  const rows = await ProviderCredential.find({ provider }).select('+value').lean();
  const stored = new Map(rows.map((row) => [row.field, row.value]));

  const out = {};
  for (const definition of entry.fields) {
    const fromEnv = envValue(provider, definition.key);
    if (fromEnv) {
      out[definition.key] = fromEnv;
      continue;
    }

    const ciphertext = stored.get(definition.key);
    // Null on a failed decrypt — a rotated key, a tampered row — which reads
    // downstream as "not configured" rather than as a usable credential.
    if (ciphertext) out[definition.key] = decrypt(ciphertext);
  }

  return out;
}

/**
 * Whether a provider has everything it needs to run.
 *
 * `marketingService` calls this so a key typed into the API Keys screen
 * actually switches a channel on. Without it the screen would store credentials
 * that nothing reads, which is exactly the two-sources-of-truth problem §10
 * warns about.
 */
export async function isConfigured(provider) {
  const entry = PROVIDER_BY_KEY.get(provider);
  if (!entry) return false;

  const values = await valuesFor(provider);
  return entry.fields.every((definition) => Boolean(values[definition.key]));
}

export default { list, save, clear, valuesFor, isConfigured };
