import { asyncHandler } from '../utils/ApiError.js';
import ContactMessage from '../models/ContactMessage.js';

/**
 * Accepts a contact enquiry.
 *
 * Stored, not emailed — no mail provider is configured yet. Storing means the
 * message survives until one is, which a fire-and-forget stub would not.
 * TODO(email): notify the trade desk once a provider is chosen (PROGRESS.md Q7).
 */
export const submit = asyncHandler(async (req, res) => {
  await ContactMessage.create({ ...req.body, user: req.user?._id ?? null });

  res.status(201).json({
    message: 'Thanks — the trade desk has your message and will reply within one business day.',
  });
});
