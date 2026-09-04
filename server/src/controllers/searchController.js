import { asyncHandler } from '../utils/ApiError.js';
import searchService from '../services/searchService.js';

/**
 * Global search (§7.1, phase 12).
 *
 * Permission filtering happens **inside the service, per request**, from
 * `req.user` — not from anything the caller sends. A `groups` parameter that
 * let the client pick which record types to search would be a way to ask for
 * the ones its role cannot see.
 */
const search = asyncHandler(async (req, res) => {
  res.json(await searchService.search(req.query.q, req.user));
});

export { search };
