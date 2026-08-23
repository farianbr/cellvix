import { asyncHandler } from '../utils/ApiError.js';
import * as authService from '../services/authService.js';

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  // Deliberately no session: sign-up does not grant access until an admin
  // approves the business (brief §8.2).
  res.status(201).json({
    user: user.toPublic(),
    message:
      'Thanks for signing up — your account is pending admin approval. We will email you once it is verified.',
  });
});

export const login = asyncHandler(async (req, res) => {
  const user = await authService.login(req.body);
  authService.issueSession(res, user, req.body.remember);
  res.json({ user: user.toPublic() });
});

export const logout = asyncHandler(async (_req, res) => {
  authService.clearSession(res);
  res.status(204).end();
});

/**
 * Who is signed in, if anyone.
 *
 * A guest gets 200 with `user: null`, not 401. "Nobody is signed in" is a valid
 * answer to this question rather than a failure, and every visitor asks it on
 * first paint — answering with an error meant a red entry in the browser console
 * on every anonymous page load, which no client-side catch can suppress.
 */
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user ? req.user.toPublic() : null });
});

export const forgotPassword = asyncHandler(async (_req, res) => {
  // Always 204 — never reveal whether an address is registered.
  // TODO: wire to a transactional mail provider once the client picks one.
  res.status(204).end();
});
