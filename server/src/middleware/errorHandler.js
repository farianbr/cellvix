import { ZodError } from 'zod';
import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

/** The single error exit. Must stay the last middleware registered. */
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our end.';
  let fields = null;

  if (err instanceof ApiError) {
    ({ status, code, message, fields } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please check the highlighted fields.';
    fields = Object.fromEntries(
      err.issues.map((issue) => [issue.path.join('.') || '_', issue.message]),
    );
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please check the highlighted fields.';
    fields = Object.fromEntries(
      Object.entries(err.errors).map(([key, value]) => [key, value.message]),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_ID';
    message = 'That identifier is not valid.';
  } else if (err?.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `That ${field} is already in use.`;
    fields = { [field]: 'Already in use.' };
  }

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
      ...(env.isProd || status < 500 ? {} : { stack: err.stack }),
    },
  });
}
