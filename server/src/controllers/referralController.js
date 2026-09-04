import { asyncHandler } from '../utils/ApiError.js';
import referralService from '../services/referralService.js';
import auditService from '../services/auditService.js';

/**
 * Referral commission (ERP rework §6.13, phase 10).
 *
 * Read and rate-setting only. **There is no route here that creates, edits or
 * deletes an accrual**, and that is the design: commission is earned by a
 * payment being recorded and reversed by that money going back, both of which
 * happen inside the services that own those events. An endpoint that could
 * write a commission by hand would be a way to move money without a payment
 * behind it.
 *
 * Attribution is likewise absent: `referredBy` is set once at registration and
 * is never editable (§6.13).
 */

const list = asyncHandler(async (req, res) => {
  res.json(await referralService.listReferrals(req.query));
});

/**
 * The commission rate — audited, which phase 10 recorded as a gap waiting on
 * `AuditLog`. This one number multiplies every future payout, so "who raised
 * it, and when" is exactly the question a log has to be able to answer.
 */
const setRate = asyncHandler(async (req, res) => {
  const before = await referralService.currentPercent();
  const result = await referralService.setPercent(req.body.percent);

  await auditService.record({
    req,
    action: 'referral.rate',
    entity: { kind: 'referral', id: 'settings', label: 'Commission rate' },
    before: { percent: before },
    after: { percent: result.percent },
    // Said on the row for the same reason it is said on the screen: it is the
    // first thing anyone reading this back will want to know.
    description: `Referral commission set to ${result.percent}%. Not retroactive — existing accruals keep the rate they were earned at.`,
  });

  res.json(result);
});

export { list, setRate };
