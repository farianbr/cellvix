import { asyncHandler } from '../utils/ApiError.js';
import * as supportService from '../services/supportService.js';

/**
 * The tenant's half of the support conversation (SAAS_PLATFORM §4.5).
 *
 * Separate from `superAdminController` because this is the **admin panel**
 * talking, on the ordinary session: `req.user` and `req.businessScope`, never
 * `req.superAdmin`. The console's half lives over there and writes to the same
 * thread from the other side.
 *
 * **Nothing here takes a tenant id.** It is resolved from the business the
 * request is scoped to, server-side — a client-supplied tenant would be a way
 * to read somebody else's conversation.
 */

const myThread = asyncHandler(async (req, res) => {
  res.json(await supportService.getMyThread(req));
});

const postMessage = asyncHandler(async (req, res) => {
  res.json(await supportService.postAsTenant(req, req.body));
});

/** Just the count, for the panel's badge — the thread itself is a heavier read. */
const unread = asyncHandler(async (req, res) => {
  res.json(await supportService.myUnread(req));
});

export { myThread, postMessage, unread };
