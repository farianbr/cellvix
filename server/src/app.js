import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import env from './config/env.js';
import routes from './routes/index.js';
import { authenticate } from './middleware/auth.js';
import { authenticateSupplier } from './middleware/supplierAuth.js';
import { authenticateSuperAdmin } from './middleware/superAdminAuth.js';
import { authenticateImpersonation } from './middleware/impersonationAuth.js';
import { attachFeatures } from './middleware/feature.js';
import { resolveBusinessScope } from './middleware/businessScope.js';
import { resolveBusiness } from './middleware/resolveBusiness.js';
import { enforceTenantStatus } from './middleware/tenantStatus.js';
import { openBusinessDb } from './middleware/businessDb.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(here, '..', '..', 'client', 'dist');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Express defaults to the `qs` parser, which turns `?brand[$ne]=x` into a
  // nested OBJECT. Several list endpoints drop query values straight into a
  // Mongo filter, so that object would arrive as a live query operator. The
  // simple parser yields strings and arrays only, which closes the whole class
  // in one line. Nothing on the client sends bracket syntax — `lib/api.js`
  // builds every query string with `URLSearchParams`.
  app.set('query parser', 'simple');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.origins,
      credentials: true, // the session is an httpOnly cookie
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  /**
   * Which business this request is for — **before anybody is authenticated**
   * (SAAS_PLATFORM §4.2).
   *
   * This is the ordering phase 2 exists to establish. A buyer signs in at the
   * storefront before any business is known, so authentication cannot be what
   * resolves it; the host (or an explicit header) decides first, and the session
   * is then read inside that business. Until this ran first, the storefront
   * carried no business at all and `businessScope` was an admin-only concept.
   *
   * It only ever *sets* `req.businessScope`. `resolveBusinessScope` still runs
   * further down and remains the one place that decides a staff member cannot
   * widen their own scope.
   */
  app.use(resolveBusiness);

  /**
   * Open that business's database — **before anybody is authenticated**
   * (SAAS_PLATFORM §4.1, §4.2).
   *
   * This sat after the whole authentication stack until the flip proved it
   * could not: `authenticate` resolves a `User`, `User` is a per-business
   * collection, and with the context opened later it read the default
   * connection instead. Every sign-in failed with `INVALID_CREDENTIALS`
   * against an account that plainly existed — the account was simply in
   * another database.
   *
   * So the order is: work out which business, open its database, then read the
   * session from it. The three authentication middlewares below all run inside
   * that context; the supplier and super-admin ones resolve control-plane
   * collections, which the model registry routes regardless of what is ambient.
   */
  app.use(openBusinessDb);

  // Every route can read req.user; individual routes decide whether it is required.
  app.use(authenticate);

  /**
   * The supplier portal's session, resolved alongside the buyer/admin one and
   * kept entirely separate from it (§6.8a).
   *
   * Two cookies, two collections. `authenticate` above sets `req.user` from
   * `User`; this sets `req.supplier` from `Supplier`, and neither can produce
   * the other. That is what makes "a supplier cannot reach a buyer route" a
   * property of the wiring rather than a rule somebody has to remember when
   * adding the next route.
   *
   * Both run on every request so one browser can hold both sessions — which is
   * what a Cellvix employee testing the portal actually needs.
   */
  app.use(authenticateSupplier);

  /**
   * The super-admin console's session — a third cookie into a third collection
   * (SAAS_PLATFORM §4.5).
   *
   * Resolved alongside the other two and separate from both. All three run on
   * every request so one browser can hold any combination, which is what an
   * operator testing the platform actually needs.
   */
  app.use(authenticateSuperAdmin);

  /**
   * A support session — a fourth cookie, and the only one that crosses from the
   * platform into a tenant's data (SAAS_PLATFORM §4.5).
   *
   * **Mounted after the console's session and before business scope**, and both
   * halves of that are load-bearing. After, because entering a business is an
   * act performed on the console session and the two coexist — leaving must
   * return the operator to a console they are still signed in to. Before,
   * because this pins `req.businessScope` to the business the grant names, and
   * `resolveBusinessScope` must not then overwrite it from the query string.
   */
  app.use(authenticateImpersonation);

  /**
   * Which business this request is about, then what that business can do.
   *
   * **The order is load-bearing and this is why they are mounted together.**
   * `attachFeatures` reads `req.businessScope`, so scope has to be resolved
   * first — and `resolveBusinessScope` is *also* listed in the per-route
   * `admin` guard array, where it runs again harmlessly. Mounting it here as
   * well is what makes the feature set correct: without it the scope was still
   * undefined when features resolved, and every request silently got the union
   * of every business's sections instead of the selected business's.
   *
   * Both are cheap: scope is a query-string read, and features is one indexed
   * lookup cached on the request (§3.2 rule 5).
   */
  app.use(resolveBusinessScope);
  app.use(attachFeatures);

  /**
   * What the tenant behind that business is still entitled to (§6 phase 19).
   *
   * **After scope, because it reads the business to find the tenant.** Mounted
   * here rather than per-route for the reason the feature gate is not: this is
   * a property of the whole account, so a route that forgot it would be a hole
   * in a billing rule rather than a missing decoration.
   *
   * Note that only requests carrying a business are covered — the storefront
   * sends no scope today, which the middleware's own header explains.
   */
  app.use(enforceTenantStatus);

  app.use('/api', routes);

  /**
   * In production this one service is the whole site: the API above, and the
   * built React app below it. Keeping them on a single origin is what lets the
   * session cookie stay `sameSite: 'lax'` — split across two hosts it would have
   * to become `sameSite: 'none'`, which is a strictly weaker cookie.
   *
   * In development Vite serves the client on :5173 and proxies `/api` here, so
   * there is no build to serve and this block stays out of the way.
   */
  if (env.isProd) {
    // Vite fingerprints every asset filename, so a year is safe. `index.html` is
    // deliberately excluded and served by the fallback below with no max-age —
    // cached, it would pin browsers to the previous deploy's asset names.
    app.use(express.static(CLIENT_DIST, { maxAge: '1y', index: false }));

    app.get('*', (req, res, next) => {
      // An unknown /api path is a client error, not a page. Let it fall through
      // to notFoundHandler and answer JSON rather than the SPA shell.
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { createApp };
export default createApp;
