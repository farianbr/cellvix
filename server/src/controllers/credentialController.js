const { asyncHandler } = require('../utils/ApiError.js');
const credentialService = require('../services/credentialService.js');
const auditService = require('../services/auditService.js');

/**
 * API Keys (ERP rework §6.15 category 7, phase 11c).
 *
 * **There is no read route for a secret, and that is the whole design.** `list`
 * returns previews and a `configured` flag; nothing here calls
 * `credentialService.valuesFor`, which is the only function that decrypts and
 * exists for the server code that talks to a provider. §6.15 has no exception
 * for "an admin asked" — a reveal endpoint would be one, so there isn't one.
 *
 * **Every write is audit-logged with the actor and IP but never the value**
 * (§6.15). The row names which fields were set or cleared, which is what makes
 * "who connected this account" answerable without the log becoming the thing
 * worth stealing.
 */

const list = asyncHandler(async (req, res) => {
  res.json(await credentialService.list());
});

const save = asyncHandler(async (req, res) => {
  const result = await credentialService.save(req.params.provider, req.body, req.user._id);

  await auditService.record({
    req,
    kind: 'security',
    action: 'api_key.save',
    entity: { kind: 'settings', id: `credentials.${req.params.provider}`, label: req.params.provider },
    // Field **names** only. Putting the values here would move the secret from
    // a collection nothing serializes into one two screens can read.
    after: { set: result.written, cleared: result.cleared },
    description: `Updated credentials for ${req.params.provider}.`,
  });

  res.json(result);
});

const clear = asyncHandler(async (req, res) => {
  const result = await credentialService.clear(req.params.provider);

  await auditService.record({
    req,
    kind: 'security',
    action: 'api_key.clear',
    entity: { kind: 'settings', id: `credentials.${req.params.provider}`, label: req.params.provider },
    after: { cleared: result.cleared },
    description: `Removed all credentials for ${req.params.provider}.`,
  });

  res.json(result);
});

// --- CommonJS exports -------------------------------------------------
exports.list = list;
exports.save = save;
exports.clear = clear;
