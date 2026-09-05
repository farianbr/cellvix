import jwt from 'jsonwebtoken';

import Supplier from '../models/Supplier.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import { SUPPLIER_COOKIE, clearSupplierSession } from '../services/supplierPortalService.js';

/**
 * The supplier portal's guard (supplier process flow, §6.8a).
 *
 * The mirror of `middleware/auth.js`, reading a **different cookie into a
 * different collection**. That separation is the whole security argument for
 * keeping supplier logins on `Supplier` rather than adding a `User.role`: a
 * token minted for a supplier cannot satisfy `requireAuth` — not because every
 * buyer and admin route was audited, but because `authenticate` reads
 * `env.COOKIE_NAME` and resolves the subject in `User`, where no supplier
 * exists. The guarantee is structural, so it cannot be lost by somebody adding
 * a route later.
 *
 * `kind: 'supplier'` is checked on the payload as well as the collection. Both
 * cookies are signed with the same `JWT_SECRET`, so without it a buyer's token
 * pasted into the supplier cookie would resolve here to whatever `Supplier`
 * document happened to share that id — vanishingly unlikely, and still not a
 * thing to leave to chance.
 */
async function authenticateSupplier(req, res, next) {
  const token = req.cookies?.[SUPPLIER_COOKIE];
  req.supplier = null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.kind !== 'supplier') {
      clearSupplierSession(res);
      return next();
    }

    const supplier = await Supplier.findById(payload.sub);
    // A supplier that was deactivated keeps a valid signature until it expires,
    // so activity is re-checked here rather than only at sign-in — otherwise
    // ending a supplier relationship leaves them reading requests for quote for
    // up to thirty days.
    if (supplier?.isActive) {
      req.supplier = supplier;
    } else {
      clearSupplierSession(res);
    }
  } catch {
    clearSupplierSession(res);
  }

  return next();
}

function requireSupplier(req, _res, next) {
  if (!req.supplier) {
    return next(
      ApiError.unauthorized('Sign in to the supplier portal to do that.', 'SUPPLIER_NOT_AUTHENTICATED'),
    );
  }
  return next();
}

export { authenticateSupplier, requireSupplier };
