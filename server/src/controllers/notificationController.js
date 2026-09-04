import { asyncHandler } from '../utils/ApiError.js';
import notificationService from '../services/notificationService.js';

/**
 * The notification bell (§7.3, phase 12c).
 *
 * Role filtering happens **inside the service, per request**, from `req.user` —
 * never from anything the caller sends, exactly as global search does. An
 * `areas` parameter that let the client choose what to fetch would be a way to
 * ask for the alerts its role cannot see.
 */

const list = asyncHandler(async (req, res) => {
  res.json(await notificationService.list(req.user));
});

/**
 * Marks read. An empty body means "everything I can see" — the dropdown sends
 * that when it opens, and specific ids when a single row is clicked.
 */
const markRead = asyncHandler(async (req, res) => {
  res.json(await notificationService.markRead(req.user, req.body?.ids));
});

const clearAll = asyncHandler(async (req, res) => {
  res.json(await notificationService.clearAll(req.user));
});

export { list, markRead, clearAll };
