/**
 * Validates a request against a Zod schema. Anything that mutates state must use it.
 * Zod failures are converted to a 400 VALIDATION_ERROR by the error handler.
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  req[source] = result.data;
  return next();
};

// --- CommonJS exports -------------------------------------------------
exports.validate = validate;
exports.default = validate;
