import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import env from './config/env.js';
import routes from './routes/index.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
