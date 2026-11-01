'use strict';

/**
 * Validates a request payload against a zod schema and exposes the parsed
 * (trimmed/coerced) value on `req.validated`. The raw body is never trusted.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    req.validated = result.data;
    return next();
  };
}

module.exports = { validate };
