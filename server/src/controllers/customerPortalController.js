import { asyncHandler } from '../utils/ApiError.js';
import * as portal from '../services/customerPortalService.js';
import auditService from '../services/auditService.js';

/**
 * The customer portal's two ends (§6.13a).
 *
 * **`profile` is public and `link` is not**, and the split is the whole design:
 * anybody holding the URL may read one customer's own record, and only a signed
 * in admin may find out what that URL is.
 */

/**
 * The portal page itself. No session, no cookie, no `req.user`.
 *
 * Mounted outside the authenticated stack, so `businessScope` and
 * `openBusinessDb` never ran - the service opens the right database itself from
 * the code in the signed token.
 */
const profile = asyncHandler(async (req, res) => {
  const { business, token } = req.params;
  res.json(await portal.portalProfile(business, token));
});

/**
 * Mint or reveal a customer's link, for an admin to copy.
 *
 * **Reading the link is audited.** The URL is the credential, so asking for it
 * is materially the same act as reading the customer's record as them, and the
 * trail should say who did. Rotating is audited for the opposite reason: it
 * breaks a link somebody is relying on, and the next person to be asked "why
 * did my link stop working" needs an answer.
 */
const link = asyncHandler(async (req, res) => {
  const rotate = String(req.query.rotate ?? '') === '1';
  const result = await portal.portalLink(req.params.id, { rotate });

  await auditService.record({
    req,
    action: rotate ? 'customer.portal_rotate' : 'customer.portal_link',
    entity: { kind: 'user', id: req.params.id },
    description: rotate
      ? 'Rotated the customer portal link, invalidating the previous one.'
      : 'Read the customer portal link.',
  });

  res.json(result);
});

/**
 * Mail the customer their own link.
 *
 * Audited like reading it, and for a stronger reason: this puts a working key
 * into an inbox. The trail records who sent it and to which address, which is
 * the question asked if the link later turns up somewhere it should not have.
 */
const email = asyncHandler(async (req, res) => {
  const result = await portal.emailPortalLink(req.params.id);

  await auditService.record({
    req,
    action: 'customer.portal_email',
    entity: { kind: 'user', id: req.params.id },
    after: { to: result.to, sent: result.sent },
    description: result.sent
      ? `Emailed the customer portal link to ${result.to}.`
      : `Tried to email the customer portal link to ${result.to}; the mailer did not send it.`,
  });

  res.json(result);
});

export { email, link, profile };
