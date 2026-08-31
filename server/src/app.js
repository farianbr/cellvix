const path = require('node:path');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { default: env } = require('./config/env.js');
const { default: routes } = require('./routes/index.js');
const { authenticate } = require('./middleware/auth.js');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.js');

const here = __dirname;
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

  // Every route can read req.user; individual routes decide whether it is required.
  app.use(authenticate);

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

// --- CommonJS exports -------------------------------------------------
exports.createApp = createApp;
exports.default = createApp;
